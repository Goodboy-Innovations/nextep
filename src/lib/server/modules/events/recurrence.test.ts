import { describe, expect, it } from 'vitest';
import { buildRRule, describeRecurrence, expandOccurrences, parseRRule } from './recurrence';

const TZ = 'Europe/Helsinki';

describe('buildRRule / parseRRule', () => {
	it('round-trips a weekly rule', () => {
		const rule = buildRRule({
			kind: 'weekly',
			interval: 2,
			byDay: ['TH', 'TU'],
			until: '2026-12-31'
		});
		expect(rule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20261231T235959');
		expect(parseRRule(rule)).toEqual({
			kind: 'weekly',
			interval: 2,
			byDay: ['TU', 'TH'],
			until: '2026-12-31'
		});
	});

	it('keeps rules the form cannot express as custom', () => {
		expect(parseRRule('FREQ=MONTHLY;BYDAY=1SU')).toEqual({
			kind: 'custom',
			rrule: 'FREQ=MONTHLY;BYDAY=1SU'
		});
	});

	it('returns null for one-off events', () => {
		expect(buildRRule({ kind: 'none' })).toBeNull();
		expect(parseRRule(null)).toEqual({ kind: 'none' });
	});
});

describe('expandOccurrences', () => {
	it('keeps local wall-clock time across the DST change', () => {
		// Finland moves from EEST (+3) to EET (+2) on Sunday 2026-10-25.
		const occ = expandOccurrences(
			{
				dtstartLocal: '2026-10-04T11:00',
				tzid: TZ,
				durationMinutes: 90,
				rrule: 'FREQ=WEEKLY;BYDAY=SU',
				exdates: []
			},
			new Date('2026-10-01T00:00:00Z'),
			new Date('2026-11-05T00:00:00Z')
		);
		expect(occ.map((o) => o.localDate)).toEqual([
			'2026-10-04',
			'2026-10-11',
			'2026-10-18',
			'2026-10-25',
			'2026-11-01'
		]);
		expect(occ[0].startsAt.toISOString()).toBe('2026-10-04T08:00:00.000Z'); // 11:00 EEST
		expect(occ[3].startsAt.toISOString()).toBe('2026-10-25T09:00:00.000Z'); // 11:00 EET
		expect(occ[3].endsAt.getTime() - occ[3].startsAt.getTime()).toBe(90 * 60_000);
	});

	it('skips excluded dates and respects UNTIL', () => {
		const occ = expandOccurrences(
			{
				dtstartLocal: '2026-10-04T11:00',
				tzid: TZ,
				durationMinutes: 60,
				rrule: 'FREQ=WEEKLY;BYDAY=SU;UNTIL=20261025T235959',
				exdates: ['2026-10-11']
			},
			new Date('2026-09-01T00:00:00Z'),
			new Date('2027-01-01T00:00:00Z')
		);
		expect(occ.map((o) => o.localDate)).toEqual(['2026-10-04', '2026-10-18', '2026-10-25']);
	});

	it('returns a one-off event only when it overlaps the window', () => {
		const event = {
			dtstartLocal: '2026-10-10T18:00',
			tzid: TZ,
			durationMinutes: 120,
			rrule: null,
			exdates: []
		};
		expect(expandOccurrences(event, new Date('2026-10-01'), new Date('2026-10-31'))).toHaveLength(
			1
		);
		expect(expandOccurrences(event, new Date('2026-11-01'), new Date('2026-11-30'))).toHaveLength(
			0
		);
	});
});

describe('describeRecurrence', () => {
	it('describes weekly rules in Finnish', () => {
		expect(describeRecurrence('FREQ=WEEKLY;BYDAY=SU')).toBe('Joka sunnuntai');
		expect(describeRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH')).toBe('Joka 2. viikko: ti, to');
		expect(describeRecurrence(null)).toBeNull();
	});
});
