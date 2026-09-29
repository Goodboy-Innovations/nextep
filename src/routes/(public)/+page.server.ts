import { featuredWeekFor, tieredSearch } from '$lib/server/modules/discovery';
import { addDays } from '$lib/server/modules/featuring';
import { loadSearchState } from '$lib/server/pages/search-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, setHeaders }) => {
	const { prefs, query, state, pills, prefPills, options } = await loadSearchState(url, cookies);
	// Results depend on the seeker's cookie: never share them through a cache.
	setHeaders({ 'cache-control': 'private, no-cache' });

	const others = url.searchParams.get('muut') === '1' || query.page > 1;
	const result = await tieredSearch(prefs, query, { others });
	return {
		state,
		pills,
		prefPills,
		options,
		page: query.page,
		others,
		result,
		weekLabel: weekLabel(result.week)
	};
};

function weekLabel(week: string): string {
	const thisWeek = featuredWeekFor(null);
	if (week === thisWeek) return 'Tällä viikolla';
	if (week === addDays(thisWeek, 7)) return 'Ensi viikolla';
	const short = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;
	return `Viikolla ${short(week)}–${short(addDays(week, 6))}`;
}
