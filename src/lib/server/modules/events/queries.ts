import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { DAY_MS, db, normalizeLocal } from '$lib/server/platform';
import { organizations } from '../organizations/schema';
import { taxonomyTerms } from '../taxonomy/schema';
import { describeRecurrence, expandOccurrences, parseRRule } from './recurrence';
import { eventOccurrences, eventTerms, events } from './schema';

export type EventRow = typeof events.$inferSelect;

export interface EventTag {
	kind: string;
	slug: string;
	label: string;
}

export interface OccurrenceView {
	startsAt: Date;
	endsAt: Date;
	localDate: string;
}

const nextOccurrence = sql<Date | null>`(
	select min(o.starts_at) from event_occurrences o
	where o.event_id = ${events.id} and o.ends_at >= now()
)`.mapWith((v) => (v ? new Date(v) : null));

async function tagsFor(eventIds: string[], locale = 'fi'): Promise<Map<string, EventTag[]>> {
	const map = new Map<string, EventTag[]>();
	if (eventIds.length === 0) return map;
	const rows = await db
		.select({ eventId: eventTerms.eventId, term: taxonomyTerms })
		.from(eventTerms)
		.innerJoin(taxonomyTerms, eq(taxonomyTerms.id, eventTerms.termId))
		.where(inArray(eventTerms.eventId, eventIds))
		.orderBy(asc(taxonomyTerms.kind), asc(taxonomyTerms.sort));
	for (const { eventId, term } of rows) {
		const list = map.get(eventId) ?? [];
		list.push({ kind: term.kind, slug: term.slug, label: term.labels[locale] ?? term.slug });
		map.set(eventId, list);
	}
	return map;
}

export { tagsFor as getEventTags };

/** Dashboard list of an organization's events, including drafts. */
export async function listOrgEvents(orgId: string) {
	const rows = await db
		.select({
			id: events.id,
			slug: events.slug,
			title: events.title,
			status: events.status,
			rrule: events.rrule,
			dtstartLocal: events.dtstartLocal,
			next: nextOccurrence
		})
		.from(events)
		.where(eq(events.orgId, orgId))
		.orderBy(asc(events.title));
	return rows.map((r) => ({ ...r, recurrence: describeRecurrence(r.rrule) }));
}

/** Everything the dashboard edit form needs, plus upcoming dates with their cancel state. */
export async function getEventForEdit(orgId: string, eventId: string) {
	const [event] = await db
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.orgId, orgId)));
	if (!event) return null;

	const termRows = await db
		.select({ termId: eventTerms.termId })
		.from(eventTerms)
		.where(eq(eventTerms.eventId, eventId));

	const local = normalizeLocal(event.dtstartLocal);
	const endMinutes =
		(Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)) + event.durationMinutes) %
		(24 * 60);
	const pad = (n: number) => String(n).padStart(2, '0');

	// Upcoming dates ignoring EXDATEs, so cancelled ones can be restored.
	const now = Date.now();
	const upcoming = expandOccurrences(
		{ ...event, dtstartLocal: local, exdates: [] },
		new Date(now),
		new Date(now + 120 * DAY_MS)
	)
		.slice(0, 20)
		.map((o) => ({ ...o, cancelled: event.exdates.includes(o.localDate) }));

	return {
		event,
		form: {
			title: event.title,
			extract: event.extract,
			description: event.description,
			date: local.slice(0, 10),
			startTime: local.slice(11, 16),
			endTime: `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`,
			recurrence: parseRRule(event.rrule),
			venueName: event.venueName ?? '',
			streetAddress: event.streetAddress ?? '',
			city: event.city,
			lat: event.lat,
			lng: event.lng,
			url: event.url ?? '',
			termIds: termRows.map((t) => t.termId)
		},
		upcoming
	};
}

/** A published event of a verified organization, for the public event page. */
export async function getPublicEvent(orgSlug: string, eventSlug: string) {
	const [row] = await db
		.select({ event: events, org: organizations })
		.from(events)
		.innerJoin(organizations, eq(organizations.id, events.orgId))
		.where(
			and(
				eq(organizations.slug, orgSlug),
				eq(organizations.status, 'verified'),
				eq(events.slug, eventSlug),
				inArray(events.status, ['published', 'cancelled'])
			)
		);
	if (!row) return null;

	const occurrences: OccurrenceView[] = await db
		.select({
			startsAt: eventOccurrences.startsAt,
			endsAt: eventOccurrences.endsAt,
			localDate: eventOccurrences.localDate
		})
		.from(eventOccurrences)
		.where(eq(eventOccurrences.eventId, row.event.id))
		.orderBy(asc(eventOccurrences.startsAt));

	const tags = (await tagsFor([row.event.id])).get(row.event.id) ?? [];
	return {
		...row,
		tags,
		occurrences,
		recurrence: describeRecurrence(row.event.rrule)
	};
}

/** Upcoming published events of one organization, each with its next occurrence. */
export async function listUpcomingOrgEvents(orgId: string) {
	const rows = await db
		.selectDistinctOn([events.id], {
			id: events.id,
			slug: events.slug,
			title: events.title,
			extract: events.extract,
			city: events.city,
			venueName: events.venueName,
			rrule: events.rrule,
			imageId: events.imageId,
			startsAt: eventOccurrences.startsAt,
			endsAt: eventOccurrences.endsAt,
			localDate: eventOccurrences.localDate
		})
		.from(events)
		.innerJoin(eventOccurrences, eq(eventOccurrences.eventId, events.id))
		.where(
			and(
				eq(events.orgId, orgId),
				eq(events.status, 'published'),
				gte(eventOccurrences.endsAt, sql`now()`)
			)
		)
		.orderBy(events.id, asc(eventOccurrences.startsAt));
	rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
	const tags = await tagsFor(rows.map((r) => r.id));
	return rows.map(({ imageId, ...r }) => ({
		...r,
		image: imageId ? `/media/${imageId}` : null,
		recurrence: describeRecurrence(r.rrule),
		tags: tags.get(r.id) ?? []
	}));
}

/** Published events of an organization, for its ICS feed. */
export async function listFeedEvents(orgId: string): Promise<EventRow[]> {
	return db
		.select()
		.from(events)
		.where(and(eq(events.orgId, orgId), inArray(events.status, ['published', 'cancelled'])))
		.orderBy(asc(events.dtstartLocal));
}

/** URLs for the sitemap: every published event of a verified organization. */
export async function listSitemapEvents() {
	return db
		.select({ orgSlug: organizations.slug, eventSlug: events.slug, updatedAt: events.updatedAt })
		.from(events)
		.innerJoin(organizations, eq(organizations.id, events.orgId))
		.where(and(eq(events.status, 'published'), eq(organizations.status, 'verified')));
}
