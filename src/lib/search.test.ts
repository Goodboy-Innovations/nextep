import { describe, expect, it } from 'vitest';
import {
	OWN_LOCATION,
	buildPills,
	searchUrl,
	withTerm,
	withoutPill,
	type SearchOptions,
	type SearchState
} from './search';

const base: SearchState = {
	q: 'gospel',
	date: null,
	place: 'Helsinki',
	lat: 60.17,
	lng: 24.94,
	maxKm: 30,
	terms: ['age_group:youth']
};

const params = (url: string) => new URL(url, 'http://x').searchParams;

describe('searchUrl', () => {
	it('encodes the full state', () => {
		const p = params(searchUrl(base));
		expect(p.get('filters')).toBe('1');
		expect(p.get('q')).toBe('gospel');
		expect(p.get('city')).toBe('Helsinki');
		expect(p.get('km')).toBe('30');
		expect(p.getAll('t')).toEqual(['age_group:youth']);
	});

	it('searches on the front page', () => {
		expect(searchUrl(base).startsWith('/?')).toBe(true);
	});

	it('adds the other-events view and the page only when asked', () => {
		expect(params(searchUrl(base)).has('muut')).toBe(false);
		const p = params(searchUrl(base, { others: true, page: 2 }));
		expect(p.get('muut')).toBe('1');
		expect(p.get('page')).toBe('2');
	});

	it('uses coordinates for the own location', () => {
		const p = params(searchUrl({ ...base, place: OWN_LOCATION }));
		expect(p.get('lat')).toBe('60.17');
		expect(p.has('city')).toBe(false);
	});
});

describe('removing pills really clears them (the cookie must not bring them back)', () => {
	it('removing the last term keeps filters=1 and no t', () => {
		const p = params(searchUrl(withoutPill(base, 't:age_group:youth')));
		expect(p.get('filters')).toBe('1');
		expect(p.getAll('t')).toEqual([]);
	});

	it('removing the place sends an explicit empty city', () => {
		const p = params(searchUrl(withoutPill(base, 'place')));
		expect(p.get('city')).toBe('');
		expect(p.has('lat')).toBe(false);
	});

	it('removing the distance means anywhere', () => {
		expect(params(searchUrl(withoutPill(base, 'km'))).get('km')).toBe('any');
	});

	it('adds a term once', () => {
		expect(withTerm(withTerm(base, 'language:en'), 'language:en').terms).toEqual([
			'age_group:youth',
			'language:en'
		]);
	});
});

describe('buildPills', () => {
	const options: SearchOptions = {
		cities: ['Helsinki'],
		distances: [10, 30],
		datePresets: [],
		termGroups: [
			{ kind: 'age_group', label: 'Ikäryhmä', terms: [{ key: 'age_group:youth', label: 'Nuoret' }] }
		]
	};

	it('keeps filters and preferences apart', () => {
		const { filters, prefs } = buildPills(base, options);
		expect(filters.map((p) => p.key)).toEqual(['q', 'place', 'km']);
		expect(prefs).toEqual([{ key: 't:age_group:youth', kind: 'Ikäryhmä', label: 'Nuoret' }]);
	});
});
