// Recurrence in the iCalendar model: DTSTART (local wall-clock + TZID), DURATION, RRULE, EXDATE.
//
// RRULE expansion is done by the `rrule` library in "floating" time: local wall-clock
// values are carried in the UTC fields of a Date, expanded, and only then converted to
// real instants in the event's timezone. That keeps "every Sunday 11:00" at 11:00 across
// DST changes.

import rrulePkg from 'rrule';
import { localToInstant, type LocalDateTime } from '$lib/server/platform/time';

const { RRule } = rrulePkg;

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** What the dashboard form can express. Anything else is kept as a raw RRULE ("custom"). */
export type RecurrenceForm =
	| { kind: 'none' }
	| { kind: 'weekly'; interval: number; byDay: Weekday[]; until: string | null }
	| { kind: 'custom'; rrule: string };

export interface RecurringEvent {
	dtstartLocal: LocalDateTime;
	tzid: string;
	durationMinutes: number;
	rrule: string | null;
	exdates: string[];
}

export interface Occurrence {
	startsAt: Date;
	endsAt: Date;
	localDate: string;
}

/** Builds an RRULE value (without the "RRULE:" prefix), or null for a one-off event. */
export function buildRRule(form: RecurrenceForm): string | null {
	if (form.kind === 'none') return null;
	if (form.kind === 'custom') return form.rrule;
	const parts = ['FREQ=WEEKLY'];
	if (form.interval > 1) parts.push(`INTERVAL=${form.interval}`);
	if (form.byDay.length) parts.push(`BYDAY=${sortWeekdays(form.byDay).join(',')}`);
	// Floating local end of day; converted to UTC when exported (RFC 5545 §3.3.10).
	if (form.until) parts.push(`UNTIL=${form.until.replaceAll('-', '')}T235959`);
	return parts.join(';');
}

/** Reads an RRULE back into the form, falling back to "custom" for rules the form can't show. */
export function parseRRule(rrule: string | null): RecurrenceForm {
	if (!rrule) return { kind: 'none' };
	const fields = Object.fromEntries(
		rrule
			.replace(/^RRULE:/, '')
			.split(';')
			.map((p) => p.split('=') as [string, string])
	);
	const known = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'UNTIL']);
	const byDay = (fields.BYDAY ?? '').split(',').filter(Boolean);
	if (
		fields.FREQ !== 'WEEKLY' ||
		Object.keys(fields).some((k) => !known.has(k)) ||
		byDay.some((d: string) => !WEEKDAYS.includes(d as Weekday))
	) {
		return { kind: 'custom', rrule };
	}
	const until = fields.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/);
	return {
		kind: 'weekly',
		interval: Number(fields.INTERVAL ?? 1),
		byDay: byDay as Weekday[],
		until: until ? `${until[1]}-${until[2]}-${until[3]}` : null
	};
}

function sortWeekdays(days: Weekday[]): Weekday[] {
	return [...new Set(days)].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

/** Local wall-clock "YYYY-MM-DDTHH:mm" → Date whose UTC fields hold that wall-clock time. */
function toFloating(local: LocalDateTime): Date {
	const [d, t = '00:00'] = local.split('T');
	const [y, m, day] = d.split('-').map(Number);
	const [h, min] = t.split(':').map(Number);
	return new Date(Date.UTC(y, m - 1, day, h, min));
}

function fromFloating(floating: Date): LocalDateTime {
	return floating.toISOString().slice(0, 16);
}

/** Expands an event into occurrences that overlap [from, to]. */
export function expandOccurrences(event: RecurringEvent, from: Date, to: Date): Occurrence[] {
	const start = toFloating(event.dtstartLocal);
	const durationMs = event.durationMinutes * 60_000;

	let floatingStarts: Date[];
	if (!event.rrule) {
		floatingStarts = [start];
	} else {
		const rule = new RRule({ ...RRule.parseString(event.rrule), dtstart: start });
		// Floating and real time differ by the UTC offset (±14 h), plus the event duration.
		const margin = 2 * 24 * 60 * 60_000 + durationMs;
		floatingStarts = rule.between(
			new Date(from.getTime() - margin),
			new Date(to.getTime() + margin),
			true
		);
	}

	const excluded = new Set(event.exdates);
	const result: Occurrence[] = [];
	for (const floating of floatingStarts) {
		const local = fromFloating(floating);
		const localDate = local.slice(0, 10);
		if (excluded.has(localDate)) continue;
		const startsAt = localToInstant(local, event.tzid);
		const endsAt = new Date(startsAt.getTime() + durationMs);
		if (endsAt >= from && startsAt <= to) result.push({ startsAt, endsAt, localDate });
	}
	return result;
}

const FI_WEEKDAYS: Record<Weekday, string> = {
	MO: 'maanantai',
	TU: 'tiistai',
	WE: 'keskiviikko',
	TH: 'torstai',
	FR: 'perjantai',
	SA: 'lauantai',
	SU: 'sunnuntai'
};

/** Short Finnish description, e.g. "Joka sunnuntai" or "Joka 2. viikko: ti, to". */
export function describeRecurrence(rrule: string | null): string | null {
	const form = parseRRule(rrule);
	if (form.kind === 'none') return null;
	if (form.kind === 'custom') return 'Toistuva tapahtuma';
	const days =
		form.byDay.length === 1
			? FI_WEEKDAYS[form.byDay[0]]
			: form.byDay.map((d) => FI_WEEKDAYS[d].slice(0, 2)).join(', ');
	let base: string;
	if (form.interval > 1) base = `Joka ${form.interval}. viikko${days ? `: ${days}` : ''}`;
	else base = days ? `Joka ${days}` : 'Joka viikko';
	return form.until ? `${base} (${form.until.split('-').reverse().join('.')} asti)` : base;
}
