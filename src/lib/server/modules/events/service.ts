import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { DAY_MS, config, db, findCity, normalizeLocal, uniqueSlug } from '$lib/server/platform';
import { deleteImage, imageBelongsTo } from '../media';
import { organizations } from '../organizations/schema';
import { expandOccurrences } from './recurrence';
import { eventOccurrences, eventTerms, events, type EventStatus } from './schema';
import type { EventInput } from './validation';

/** Occurrences are materialized from 30 days back to a year ahead. */
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 365;

function resolveLocation(input: EventInput) {
	if (input.lat != null && input.lng != null) return { lat: input.lat, lng: input.lng };
	const city = findCity(input.city);
	if (!city) throw new Error(`Unknown city "${input.city}" and no coordinates given`);
	return { lat: city.lat, lng: city.lng };
}

function eventValues(input: EventInput) {
	return {
		title: input.title,
		extract: input.extract,
		description: input.description,
		dtstartLocal: input.dtstartLocal,
		durationMinutes: input.durationMinutes,
		rrule: input.rrule,
		venueName: input.venueName,
		streetAddress: input.streetAddress,
		city: input.city,
		...resolveLocation(input),
		url: input.url
	};
}

async function slugTaken(orgId: string, slug: string, exceptId?: string): Promise<boolean> {
	const [row] = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.orgId, orgId), eq(events.slug, slug)));
	return !!row && row.id !== exceptId;
}

async function setTerms(eventId: string, termIds: string[]) {
	await db.delete(eventTerms).where(eq(eventTerms.eventId, eventId));
	if (termIds.length) {
		await db
			.insert(eventTerms)
			.values([...new Set(termIds)].map((termId) => ({ eventId, termId })));
	}
}

async function ownedEvent(orgId: string, eventId: string) {
	const [event] = await db
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.orgId, orgId)));
	if (!event) throw new Error('Event not found');
	return event;
}

export async function createEvent(
	orgId: string,
	input: EventInput,
	status: EventStatus = 'draft'
): Promise<string> {
	const [org] = await db
		.select({ timezone: organizations.timezone, slug: organizations.slug })
		.from(organizations)
		.where(eq(organizations.id, orgId));
	const slug = await uniqueSlug(input.title, (s) => slugTaken(orgId, s));
	const host = new URL(config.publicUrl).hostname;
	const [event] = await db
		.insert(events)
		.values({
			...eventValues(input),
			uid: `${randomUUID()}@${host}`,
			orgId,
			slug,
			status,
			tzid: org?.timezone ?? config.defaultTimezone
		})
		.returning({ id: events.id });
	await setTerms(event.id, input.termIds);
	await materializeEvent(event.id);
	return event.id;
}

/** Updates the master event. Slugs stay stable so published URLs keep working. */
export async function updateEvent(orgId: string, eventId: string, input: EventInput) {
	await ownedEvent(orgId, eventId);
	await db
		.update(events)
		.set({ ...eventValues(input), sequence: sql`${events.sequence} + 1`, updatedAt: new Date() })
		.where(eq(events.id, eventId));
	await setTerms(eventId, input.termIds);
	await materializeEvent(eventId);
}

export async function setEventStatus(orgId: string, eventId: string, status: EventStatus) {
	await ownedEvent(orgId, eventId);
	await db
		.update(events)
		.set({ status, sequence: sql`${events.sequence} + 1`, updatedAt: new Date() })
		.where(eq(events.id, eventId));
}

/** Cancels (EXDATE) or restores a single occurrence, identified by its local date. */
export async function setOccurrenceCancelled(
	orgId: string,
	eventId: string,
	localDate: string,
	cancelled: boolean
) {
	const event = await ownedEvent(orgId, eventId);
	const exdates = new Set(event.exdates);
	if (cancelled) exdates.add(localDate);
	else exdates.delete(localDate);
	await db
		.update(events)
		.set({
			exdates: [...exdates].sort(),
			sequence: sql`${events.sequence} + 1`,
			updatedAt: new Date()
		})
		.where(eq(events.id, eventId));
	await materializeEvent(eventId);
}

/**
 * Sets or removes an event's image. The image must belong to the same organization.
 * The replaced image is deleted (images are not shared between events in v0.1).
 */
export async function setEventImage(orgId: string, eventId: string, imageId: string | null) {
	const event = await ownedEvent(orgId, eventId);
	if (imageId && !(await imageBelongsTo(imageId, orgId))) throw new Error('Image not found');
	if (event.imageId === imageId) return;
	await db
		.update(events)
		.set({ imageId, sequence: sql`${events.sequence} + 1`, updatedAt: new Date() })
		.where(eq(events.id, eventId));
	if (event.imageId) await deleteImage(event.imageId, orgId);
}

export async function deleteEvent(orgId: string, eventId: string) {
	const [deleted] = await db
		.delete(events)
		.where(and(eq(events.id, eventId), eq(events.orgId, orgId)))
		.returning({ imageId: events.imageId });
	if (deleted?.imageId) await deleteImage(deleted.imageId, orgId);
}

/** Regenerates the materialized occurrences of one event. */
export async function materializeEvent(eventId: string): Promise<void> {
	const [event] = await db.select().from(events).where(eq(events.id, eventId));
	if (!event) return;
	const now = Date.now();
	const occurrences = expandOccurrences(
		{
			dtstartLocal: normalizeLocal(event.dtstartLocal),
			tzid: event.tzid,
			durationMinutes: event.durationMinutes,
			rrule: event.rrule,
			exdates: event.exdates
		},
		new Date(now - WINDOW_PAST_DAYS * DAY_MS),
		new Date(now + WINDOW_FUTURE_DAYS * DAY_MS)
	);
	await db.transaction(async (tx) => {
		await tx.delete(eventOccurrences).where(eq(eventOccurrences.eventId, eventId));
		if (occurrences.length) {
			await tx.insert(eventOccurrences).values(occurrences.map((o) => ({ eventId, ...o })));
		}
	});
}

/** Rolls the materialization window forward for every recurring event. Run daily. */
export async function materializeAll(): Promise<number> {
	const rows = await db
		.select({ id: events.id })
		.from(events)
		.where(sql`${events.rrule} is not null`);
	for (const row of rows) await materializeEvent(row.id);
	// Drop occurrences that fell out of the window.
	await db
		.delete(eventOccurrences)
		.where(sql`${eventOccurrences.endsAt} < now() - make_interval(days => ${WINDOW_PAST_DAYS})`);
	return rows.length;
}

/** Seed helper: are there any events at all? */
export async function hasEvents(): Promise<boolean> {
	const [row] = await db.select({ id: events.id }).from(events).limit(1);
	return !!row;
}
