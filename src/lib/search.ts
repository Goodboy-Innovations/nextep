// Search state ↔ URL, shared by the server (pills, remove links) and the pill search bar.
//
// Every URL built here carries the full state, including explicit "empty" values
// (filters=1, city=), because the server otherwise falls back to the preferences cookie:
// removing the last pill must really clear it.

export interface SearchState {
	q: string | null;
	/** Local date yyyy-mm-dd, or null = from now on. */
	date: string | null;
	/** City name, "Oma sijainti" (then lat/lng are set), or null. */
	place: string | null;
	lat: number | null;
	lng: number | null;
	/** Distance cap in km; null = anywhere. */
	maxKm: number | null;
	/** Preferred taxonomy terms, "kind:slug". */
	terms: string[];
}

export const OWN_LOCATION = 'Oma sijainti';
/** Search lives on the front page: its results replace the featured events there. */
export const SEARCH_PATH = '/';

/**
 * `others`: the matching events that are not featured ("Näytä myös muut tapahtumat").
 * Changing the search drops it and the page, so callers pass them only on purpose.
 */
export function searchUrl(
	state: SearchState,
	{ page = 1, others = false }: { page?: number; others?: boolean } = {}
): string {
	const params: [string, string][] = [['filters', '1']];
	if (state.q) params.push(['q', state.q]);
	if (state.date) params.push(['date', state.date]);
	if (state.place === OWN_LOCATION && state.lat !== null && state.lng !== null) {
		params.push(['lat', String(state.lat)], ['lng', String(state.lng)]);
	} else {
		params.push(['city', state.place ?? '']);
	}
	params.push(['km', state.maxKm === null ? 'any' : String(state.maxKm)]);
	for (const t of state.terms) params.push(['t', t]);
	if (others) params.push(['muut', '1']);
	if (page > 1) params.push(['page', String(page)]);
	return `${SEARCH_PATH}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export type PillKey = 'q' | 'date' | 'place' | 'km' | `t:${string}`;

export interface Pill {
	key: PillKey;
	label: string;
	/** Short category shown before the value, e.g. "Paikka". */
	kind: string;
}

/** State without one pill. */
export function withoutPill(state: SearchState, key: PillKey): SearchState {
	if (key === 'q') return { ...state, q: null };
	if (key === 'date') return { ...state, date: null };
	if (key === 'place') return { ...state, place: null, lat: null, lng: null };
	if (key === 'km') return { ...state, maxKm: null };
	const term = key.slice(2);
	return { ...state, terms: state.terms.filter((t) => t !== term) };
}

/** Values the search bar offers (built on the server: cities, taxonomy, date presets). */
export interface SearchOptions {
	cities: string[];
	distances: number[];
	datePresets: { label: string; date: string }[];
	termGroups: { kind: string; label: string; terms: { key: string; label: string }[] }[];
}

const shortDate = (date: string) => {
	const [, m, d] = date.split('-').map(Number);
	return `${d}.${m}.`;
};

/**
 * The pills shown for a state, in display order. Filters narrow the results and live in
 * the search bar; preferences (taxonomy terms) only boost and are shown on their own.
 */
export function buildPills(
	state: SearchState,
	options: SearchOptions
): { filters: Pill[]; prefs: Pill[] } {
	const termLabels = new Map(
		options.termGroups.flatMap((g) =>
			g.terms.map((t) => [t.key, { label: t.label, kind: g.label }] as const)
		)
	);
	const pills: Pill[] = [];
	if (state.q) pills.push({ key: 'q', kind: 'Haku', label: `”${state.q}”` });
	if (state.place) {
		pills.push({ key: 'place', kind: 'Paikka', label: state.place });
		pills.push({
			key: 'km',
			kind: 'Etäisyys',
			label: state.maxKm === null ? 'kaikkialla' : `≤ ${state.maxKm} km`
		});
	}
	if (state.date) {
		const preset = options.datePresets.find((p) => p.date === state.date);
		pills.push({
			key: 'date',
			kind: 'Alkaen',
			label: preset
				? `${preset.label.toLowerCase()} (${shortDate(state.date)})`
				: shortDate(state.date)
		});
	}
	const prefs: Pill[] = [];
	for (const t of state.terms) {
		const info = termLabels.get(t);
		if (info) prefs.push({ key: `t:${t}`, kind: info.kind, label: info.label });
	}
	return { filters: pills, prefs };
}

export function withTerm(state: SearchState, term: string): SearchState {
	return state.terms.includes(term) ? state : { ...state, terms: [...state.terms, term] };
}
