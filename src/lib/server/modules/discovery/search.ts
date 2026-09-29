import { config, localToInstant, sql } from '$lib/server/platform';
import { describeRecurrence, getEventTags, type EventTag } from '../events';
import { addDays, frontPageQualitySql } from '../featuring';
import { RANKING } from './config';
import type { SeekerPrefs, SeekerQuery } from './prefs';

export interface EventCard {
	id: string;
	slug: string;
	title: string;
	extract: string;
	city: string;
	venueName: string | null;
	/** Image URL, or null. */
	image: string | null;
	orgSlug: string;
	orgName: string;
	startsAt: Date;
	endsAt: Date;
	localDate: string;
	recurrence: string | null;
	distanceKm: number | null;
	score: number;
	tags: EventTag[];
}

/** Turns free text into a prefix tsquery: "nuor ilta" → "nuor:* & ilta:*". */
export function toPrefixQuery(q: string): string | null {
	const words = q
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length > 0)
		.slice(0, 8);
	return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/**
 * Ranked discovery (docs/proposal.md §5.3):
 * 1. hard filters (upcoming, published, verified org, distance cap, text match);
 * 2. per event, the occurrence nearest the target time;
 * 3. soft score = time + distance + preference + text;
 * 4. optionally, the front page split: an event is on the front page for a week when it meets
 *    the quality bar, takes place that week, and is among its organization's best-scoring
 *    `front_page_limit` such events. So the pick is per seeker, not a fixed list.
 */
export async function searchEvents(
	prefs: SeekerPrefs,
	query: SeekerQuery,
	options: {
		/** Only the events on the front page of this week (Monday, yyyy-mm-dd). */
		frontPageWeek?: string;
		/** Leave these events out (the ones already shown above a list). */
		excludeIds?: string[];
		limit?: number;
	} = {}
): Promise<{ events: EventCard[]; total: number }> {
	const { weights: w, tauTimeDays, tauDistanceKm, minSimilarity } = RANKING;
	const pageSize = options.limit ?? RANKING.pageSize;
	const tz = config.defaultTimezone;

	const target = query.date ? localToInstant(`${query.date}T12:00`, tz) : new Date();
	const notBefore = query.date ? localToInstant(`${query.date}T00:00`, tz) : new Date();
	const hasLocation = prefs.lat !== null && prefs.lng !== null;
	const point = hasLocation
		? sql`ST_SetSRID(ST_MakePoint(${prefs.lng}::float8, ${prefs.lat}::float8), 4326)::geography`
		: sql`null::geography`;
	const tsq = query.q ? toPrefixQuery(query.q) : null;
	const q = query.q ?? '';
	const termKeys = prefs.terms.join(',');

	const distanceFilter =
		hasLocation && prefs.maxKm !== null
			? sql`and ST_DWithin(e.geog, ${point}, ${prefs.maxKm * 1000}::float8)`
			: sql``;
	const excludeFilter = options.excludeIds?.length
		? sql`and not (e.id = any(${options.excludeIds}::uuid[]))`
		: sql``;
	const textFilter = tsq
		? sql`and (
				e.search_vector @@ to_tsquery('simple', ${tsq})
				or word_similarity(${q}, e.title) >= ${minSimilarity}::float8
				or word_similarity(${q}, g.name) >= ${minSimilarity}::float8
			)`
		: sql``;
	const frontPage = options.frontPageWeek;
	const weekEnd = frontPage && localToInstant(`${addDays(frontPage, 7)}T00:00`, tz).toISOString();
	// A condition inside the window partition too, so the limit counts only front-page candidates.
	const onFrontPageCandidate = sql`(qualifies and starts_at < ${weekEnd ?? null}::timestamptz)`;

	const rows = await sql<
		(Omit<EventCard, 'tags' | 'recurrence' | 'image'> & {
			rrule: string | null;
			imageId: string | null;
			total: number;
		})[]
	>`
		with candidates as (
			select distinct on (o.event_id) o.event_id, o.starts_at, o.ends_at, o.local_date
			from event_occurrences o
			join events e on e.id = o.event_id
			join organizations g on g.id = e.org_id
			where o.ends_at >= ${notBefore.toISOString()}::timestamptz
				and e.status = 'published'
				and g.status = 'verified'
				${distanceFilter}
				${textFilter}
				${excludeFilter}
			order by o.event_id, abs(extract(epoch from (o.starts_at - ${target.toISOString()}::timestamptz)))
		),
		scored as (
			select
				c.*, e.slug, e.title, e.extract, e.city, e.venue_name, e.rrule, e.image_id,
				e.org_id, g.slug as org_slug, g.name as org_name, g.front_page_limit,
				${frontPageQualitySql()} as qualifies,
				${hasLocation ? sql`ST_Distance(e.geog, ${point}) / 1000` : sql`null::float8`} as distance_km,
				(
					select count(*) from event_terms et
					join taxonomy_terms t on t.id = et.term_id
					where et.event_id = e.id
						and t.kind || ':' || t.slug = any(string_to_array(${termKeys}, ','))
				) as matched_terms,
				case when ${tsq}::text is null then 0 else greatest(
					ts_rank(e.search_vector, to_tsquery('simple', coalesce(${tsq}, ''))),
					word_similarity(${q}, e.title),
					word_similarity(${q}, g.name)
				) end as text_relevance
			from candidates c
			join events e on e.id = c.event_id
			join organizations g on g.id = e.org_id
		),
		ranked as (
			select *, (
				${w.time}::float8 * exp(-abs(extract(epoch from (starts_at - ${target.toISOString()}::timestamptz))) / ${tauTimeDays * 86400}::float8)
				+ ${w.distance}::float8 * coalesce(exp(-distance_km / ${tauDistanceKm}::float8), 0)
				+ ${w.preference}::float8 * matched_terms / greatest(${prefs.terms.length}::int, 1)
				+ ${w.text}::float8 * text_relevance
			) as score
			from scored
		),
		placed as (
			select *, ${
				frontPage
					? sql`coalesce(${onFrontPageCandidate} and row_number() over (
							partition by org_id, ${onFrontPageCandidate}
							order by score desc, starts_at asc
						) <= front_page_limit, false)`
					: sql`false`
			} as on_front_page
			from ranked
		)
		select
			event_id as id, slug, title, extract, city, venue_name as "venueName", rrule,
			image_id as "imageId",
			org_slug as "orgSlug", org_name as "orgName",
			extract(epoch from starts_at) * 1000 as "startsAt",
			extract(epoch from ends_at) * 1000 as "endsAt", local_date::text as "localDate",
			distance_km as "distanceKm",
			count(*) over () as total,
			score
		from placed
		${frontPage ? sql`where on_front_page` : sql``}
		order by score desc, starts_at asc
		limit ${pageSize} offset ${(query.page - 1) * pageSize}
	`;

	const tags = await getEventTags(rows.map((r) => r.id));
	// Past the last page there are no rows to carry the count: callers only need "more or not".
	const total = rows.length ? Number(rows[0].total) : 0;
	const events = rows.map(({ rrule, imageId, total: _count, ...r }) => ({
		...r,
		image: imageId ? `/media/${imageId}` : null,
		// Timestamps come back as epoch milliseconds, independent of driver type parsing.
		startsAt: new Date(Number(r.startsAt)),
		endsAt: new Date(Number(r.endsAt)),
		distanceKm: r.distanceKm === null ? null : Number(r.distanceKm),
		score: Number(r.score),
		recurrence: describeRecurrence(rrule),
		tags: tags.get(r.id) ?? []
	}));
	return { events, total };
}
