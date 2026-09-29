import { describe, expect, it } from 'vitest';
import {
	FEATURE_MIN_DESCRIPTION,
	addDays,
	qualityProblems,
	weekStartOf,
	weekStartOfDate
} from './rules';

const TZ = 'Europe/Helsinki';

describe('weekStartOf', () => {
	it('uses Helsinki time, not UTC', () => {
		// Sunday 2026-10-04 23:30 Helsinki = 20:30 UTC → still the week of Monday 2026-09-28
		expect(weekStartOf(new Date('2026-10-04T20:30:00Z'), TZ)).toBe('2026-09-28');
		// Monday 2026-10-05 00:30 Helsinki = Sunday 21:30 UTC → new week
		expect(weekStartOf(new Date('2026-10-04T21:30:00Z'), TZ)).toBe('2026-10-05');
	});

	it('is stable across the DST change week', () => {
		// DST ends Sunday 2026-10-25 04:00 → 03:00
		expect(weekStartOf(new Date('2026-10-25T12:00:00Z'), TZ)).toBe('2026-10-19');
		expect(weekStartOf(new Date('2026-10-26T12:00:00Z'), TZ)).toBe('2026-10-26');
		expect(addDays('2026-10-19', 7)).toBe('2026-10-26');
	});

	it('finds the Monday of a local date', () => {
		expect(weekStartOfDate('2026-10-04')).toBe('2026-09-28'); // Sunday
		expect(weekStartOfDate('2026-10-05')).toBe('2026-10-05'); // Monday
		expect(weekStartOfDate('2026-10-25')).toBe('2026-10-19'); // DST change day
	});
});

describe('qualityProblems', () => {
	const ok = { imageId: 'img', description: 'x'.repeat(FEATURE_MIN_DESCRIPTION) };

	it('accepts an event with an image and a long enough description', () => {
		expect(qualityProblems(ok)).toEqual([]);
	});

	it('requires an image and a long enough description', () => {
		expect(qualityProblems({ imageId: null, description: 'lyhyt' })).toEqual([
			'no_image',
			'short_description'
		]);
	});

	it('does not count surrounding whitespace', () => {
		expect(
			qualityProblems({ ...ok, description: ` ${'x'.repeat(FEATURE_MIN_DESCRIPTION - 1)} ` })
		).toEqual(['short_description']);
	});
});
