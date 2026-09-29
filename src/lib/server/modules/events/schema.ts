import { sql } from 'drizzle-orm';
import {
	customType,
	date,
	doublePrecision,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { mediaAssets } from '../media/schema';
import { organizations } from '../organizations/schema';
import { taxonomyTerms } from '../taxonomy/schema';

const geography = customType<{ data: string }>({ dataType: () => 'geography' });
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const EVENT_STATUSES = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * One row = one iCalendar VEVENT master (RFC 5545). A one-off event has no `rrule`
 * and exactly one occurrence.
 */
export const events = pgTable(
	'events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** iCalendar UID, stable across edits and syncs. */
		uid: text('uid').notNull().unique(),
		/** iCalendar SEQUENCE, incremented on every edit so subscribers pick up changes. */
		sequence: integer('sequence').notNull().default(0),
		orgId: uuid('org_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		/** Short summary used on cards and in search results. */
		extract: text('extract').notNull().default(''),
		description: text('description').notNull().default(''),
		status: text('status', { enum: EVENT_STATUSES }).notNull().default('draft'),

		// Time — DTSTART;TZID=… + DURATION + RRULE + EXDATE
		dtstartLocal: timestamp('dtstart_local', { mode: 'string' }).notNull(),
		tzid: text('tzid').notNull().default('Europe/Helsinki'),
		durationMinutes: integer('duration_minutes').notNull().default(60),
		rrule: text('rrule'),
		/** Cancelled occurrences, as local dates. */
		exdates: date('exdates', { mode: 'string' })
			.array()
			.notNull()
			.default(sql`'{}'`),

		// Place — LOCATION + GEO
		venueName: text('venue_name'),
		streetAddress: text('street_address'),
		city: text('city').notNull(),
		lat: doublePrecision('lat').notNull(),
		lng: doublePrecision('lng').notNull(),
		geog: geography('geog').generatedAlwaysAs(
			sql`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`
		),

		/** URL for more information or registration. */
		url: text('url'),
		/** Event picture (required for featuring). Must belong to the same organization. */
		imageId: uuid('image_id').references(() => mediaAssets.id, { onDelete: 'set null' }),

		searchVector: tsvector('search_vector').generatedAlwaysAs(
			sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(extract, '')), 'B') || setweight(to_tsvector('simple', coalesce(description, '')), 'C')`
		),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique().on(t.orgId, t.slug),
		index('events_geog_idx').using('gist', t.geog),
		index('events_search_idx').using('gin', t.searchVector),
		index('events_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops'))
	]
);

export const eventTerms = pgTable(
	'event_terms',
	{
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		termId: uuid('term_id')
			.notNull()
			.references(() => taxonomyTerms.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.eventId, t.termId] })]
);

/** Materialized occurrences for a rolling window; regenerated from the master event. */
export const eventOccurrences = pgTable(
	'event_occurrences',
	{
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		/** Local date of the occurrence; used in URLs (/e/org/event/2026-10-04). */
		localDate: date('local_date', { mode: 'string' }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.eventId, t.startsAt] }),
		index('event_occurrences_ends_at_idx').on(t.endsAt)
	]
);
