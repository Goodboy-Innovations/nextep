import { formatInTimeZone } from 'date-fns-tz';
import { config } from '$lib/server/platform';
import { weekStartOfDate } from '../featuring';
import { RANKING } from './config';
import type { SeekerPrefs, SeekerQuery } from './prefs';
import { searchEvents, type EventCard } from './search';

/**
 * What the front page shows for a search:
 * - `featured`: front-page events ("nostot") matching the filters; the other matches are counted and,
 *   when asked for (`others`), listed below them, paged;
 * - `all`: nothing featured matched, so every matching event, paged;
 * - `suggestions`: nothing matched at all; featured events ranked by preferences only.
 */
export type SearchTier = 'featured' | 'all' | 'suggestions';

export interface PagedEvents {
	events: EventCard[];
	total: number;
	hasMore: boolean;
}

export interface TieredResult {
	tier: SearchTier;
	/** Monday of the featured week the search looked at. */
	week: string;
	/** Featured events (tiers `featured` and `suggestions`). */
	featured: EventCard[];
	/** Tier `all`, or tier `featured` with `others`: the paged list. */
	list: PagedEvents | null;
	/** Tier `featured`: how many matching events are not featured. */
	othersTotal: number;
}

/** The front page is per week: a date filter picks its week, otherwise this week. */
export function featuredWeekFor(date: string | null, now = new Date()): string {
	return weekStartOfDate(date ?? formatInTimeZone(now, config.defaultTimezone, 'yyyy-MM-dd'));
}

export async function tieredSearch(
	prefs: SeekerPrefs,
	query: SeekerQuery,
	options: { others?: boolean } = {}
): Promise<TieredResult> {
	const week = featuredWeekFor(query.date);
	const paged = (r: { events: EventCard[]; total: number }): PagedEvents => ({
		...r,
		hasMore: query.page * RANKING.pageSize < r.total
	});
	const firstPage = { ...query, page: 1 };

	const featured = await searchEvents(prefs, firstPage, { frontPageWeek: week });
	if (featured.events.length) {
		// Later pages only exist in the list of other events (e.g. old /search?page=2 links).
		const listOthers = options.others || query.page > 1;
		const others = await searchEvents(prefs, listOthers ? query : firstPage, {
			// Everything not in the grid, including front-page events beyond its first page.
			excludeIds: featured.events.map((e) => e.id),
			limit: listOthers ? undefined : 1
		});
		return {
			tier: 'featured',
			week,
			featured: featured.events,
			list: listOthers ? paged(others) : null,
			othersTotal: others.total
		};
	}

	const all = await searchEvents(prefs, query);
	if (all.total || query.page > 1) {
		return { tier: 'all', week, featured: [], list: paged(all), othersTotal: 0 };
	}

	const suggestions = await searchEvents(
		{ place: prefs.place, lat: prefs.lat, lng: prefs.lng, maxKm: null, terms: prefs.terms },
		{ q: null, date: null, page: 1 },
		{ frontPageWeek: featuredWeekFor(null), limit: 12 }
	);
	return { tier: 'suggestions', week, featured: suggestions.events, list: null, othersTotal: 0 };
}
