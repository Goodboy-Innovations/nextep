// Front page search: reads the seeker's state and builds the pill bar data.

import type { Cookies } from '@sveltejs/kit';
import { formatInTimeZone } from 'date-fns-tz';
import {
	CITIES,
	DISTANCE_OPTIONS,
	PREFS_COOKIE,
	readPrefs,
	serializePrefs
} from '$lib/server/modules/discovery';
import { addDays } from '$lib/server/modules/featuring';
import { KIND_LABELS, listTermsByKind } from '$lib/server/modules/taxonomy';
import { config } from '$lib/server/platform';
import { buildPills, type SearchOptions, type SearchState } from '$lib/search';

/** Kinds offered as pills; denominations stay available but are less common. */
const PILL_KINDS = ['category', 'age_group', 'language', 'denomination'] as const;

function datePresets(now = new Date()): { label: string; date: string }[] {
	const tz = config.defaultTimezone;
	const today = formatInTimeZone(now, tz, 'yyyy-MM-dd');
	const isoDay = Number(formatInTimeZone(now, tz, 'i')); // 1 = Mon … 7 = Sun
	const saturday = isoDay >= 6 ? today : addDays(today, 6 - isoDay);
	return [
		{ label: 'Tänään', date: today },
		{ label: 'Huomenna', date: addDays(today, 1) },
		{ label: 'Viikonloppuna', date: saturday },
		{ label: 'Ensi viikolla', date: addDays(today, 8 - isoDay) }
	];
}

export async function searchOptions(): Promise<SearchOptions> {
	const terms = await listTermsByKind();
	return {
		cities: CITIES.map((c) => c.name),
		distances: [...DISTANCE_OPTIONS],
		datePresets: datePresets(),
		termGroups: PILL_KINDS.map((kind) => ({
			kind,
			label: KIND_LABELS[kind],
			terms: terms[kind].map((t) => ({ key: `${t.kind}:${t.slug}`, label: t.label }))
		}))
	};
}

export async function loadSearchState(url: URL, cookies: Cookies) {
	const { prefs, query, changed } = readPrefs(url, cookies.get(PREFS_COOKIE));
	if (changed) {
		cookies.set(PREFS_COOKIE, serializePrefs(prefs), {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: true
		});
	}

	const options = await searchOptions();

	const state: SearchState = {
		q: query.q,
		date: query.date,
		place: prefs.place,
		lat: prefs.lat,
		lng: prefs.lng,
		maxKm: prefs.maxKm,
		terms: prefs.terms
	};

	const { filters, prefs: prefPills } = buildPills(state, options);
	return { prefs, query, state, pills: filters, prefPills, options };
}
