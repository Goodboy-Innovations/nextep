import { describe, expect, it } from 'vitest';
import { renderCalendar, type IcsEvent } from './ics';

const base: IcsEvent = {
	uid: 'abc@nextep.test',
	sequence: 2,
	title: 'Sunnuntain messu, kaikki tervetuloa',
	description: 'Rivi 1\nRivi 2',
	status: 'published',
	dtstartLocal: '2026-10-04 11:00:00',
	tzid: 'Europe/Helsinki',
	durationMinutes: 90,
	rrule: 'FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T235959',
	exdates: ['2026-10-11'],
	location: 'Kallion kirkko, Helsinki',
	lat: 60.18,
	lng: 24.95,
	url: 'https://nextep.test/e/org/messu',
	categories: ['Jumalanpalvelus'],
	updatedAt: new Date('2026-09-01T10:00:00Z')
};

describe('renderCalendar', () => {
	const ics = renderCalendar({ name: 'Test', events: [base] });
	const lines = ics.split('\r\n');

	it('writes a timezone-aware recurring VEVENT', () => {
		expect(lines).toContain('DTSTART;TZID=Europe/Helsinki:20261004T110000');
		expect(lines).toContain('EXDATE;TZID=Europe/Helsinki:20261011T110000');
		expect(lines).toContain('DURATION:PT90M');
		expect(lines).toContain('SEQUENCE:2');
		expect(ics).toContain('BEGIN:VTIMEZONE');
	});

	it('converts UNTIL to UTC as RFC 5545 requires with TZID', () => {
		// 2026-12-31 23:59:59 EET (+2) = 21:59:59 UTC
		expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T215959Z');
	});

	it('escapes text values and folds long lines', () => {
		expect(lines).toContain('SUMMARY:Sunnuntain messu\\, kaikki tervetuloa');
		expect(lines).toContain('DESCRIPTION:Rivi 1\\nRivi 2');
		expect(lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75)).toBe(true);
	});
});
