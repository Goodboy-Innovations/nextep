// Seeker preferences. There are no seeker accounts: preferences live in a first-party
// cookie (so server-rendered ranking can use them) and are mirrored in URL parameters
// (so filtered views can be shared). The cookie holds no identifier.

import { CITIES, coarse, findCity } from '$lib/server/platform';
import { DISTANCE_OPTIONS, RANKING } from './config';

export const PREFS_COOKIE = 'nextep_prefs';

export interface SeekerPrefs {
	/** Display name for the location, e.g. a city or "Oma sijainti". */
	place: string | null;
	lat: number | null;
	lng: number | null;
	/** Hard distance cap in km, or null for "anywhere". */
	maxKm: number | null;
	/** Preferred taxonomy terms as "kind:slug", e.g. "age_group:youth". */
	terms: string[];
}

/** Per-visit search, not remembered in the cookie. */
export interface SeekerQuery {
	q: string | null;
	/** Local date (yyyy-mm-dd) the seeker is interested in; null = from now on. */
	date: string | null;
	page: number;
}

const EMPTY: SeekerPrefs = {
	place: null,
	lat: null,
	lng: null,
	maxKm: RANKING.defaultMaxKm,
	terms: []
};

function parseKm(value: string | null | undefined): number | null {
	if (value === 'any') return null;
	const n = Number(value);
	return DISTANCE_OPTIONS.includes(n as (typeof DISTANCE_OPTIONS)[number])
		? n
		: RANKING.defaultMaxKm;
}

function parseCookie(raw: string | undefined): SeekerPrefs {
	if (!raw) return { ...EMPTY };
	try {
		const v = JSON.parse(raw);
		return {
			place: typeof v.place === 'string' ? v.place : null,
			lat: typeof v.lat === 'number' ? v.lat : null,
			lng: typeof v.lng === 'number' ? v.lng : null,
			maxKm: v.maxKm === null ? null : parseKm(String(v.maxKm)),
			terms: Array.isArray(v.terms) ? v.terms.filter((t: unknown) => typeof t === 'string') : []
		};
	} catch {
		return { ...EMPTY };
	}
}

/**
 * Reads preferences: URL parameters win over the cookie. Returns whether the URL
 * changed them, so the caller can persist the new values in the cookie.
 */
export function readPrefs(
	url: URL,
	cookie: string | undefined
): { prefs: SeekerPrefs; query: SeekerQuery; changed: boolean } {
	const params = url.searchParams;
	const prefs = parseCookie(cookie);
	const submitted = params.has('filters'); // set by the filter form
	let changed = false;

	const city = params.get('city');
	const lat = Number(params.get('lat'));
	const lng = Number(params.get('lng'));
	if (params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
		Object.assign(prefs, { place: 'Oma sijainti', lat: coarse(lat), lng: coarse(lng) });
		changed = true;
	} else if (city !== null) {
		const found = findCity(city);
		Object.assign(
			prefs,
			found
				? { place: found.name, lat: found.lat, lng: found.lng }
				: { place: null, lat: null, lng: null }
		);
		changed = true;
	}
	if (params.has('km')) {
		prefs.maxKm = parseKm(params.get('km'));
		changed = true;
	}
	if (submitted || params.has('t')) {
		prefs.terms = params.getAll('t').filter((t) => /^[a-z_]+:[a-z0-9-]+$/.test(t));
		changed = true;
	}

	const date = params.get('date');
	const q = params.get('q')?.trim();
	return {
		prefs,
		query: {
			q: q ? q.slice(0, 100) : null,
			date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
			page: Math.max(1, Math.min(50, Number(params.get('page')) || 1))
		},
		changed
	};
}

export function serializePrefs(prefs: SeekerPrefs): string {
	return JSON.stringify(prefs);
}

export { CITIES };
