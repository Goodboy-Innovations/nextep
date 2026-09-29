// Minimal RFC 5545 writer. Events are exported as their master VEVENT (DTSTART;TZID +
// RRULE + EXDATE), so subscribed calendars (Google, Apple, Outlook) see a real series.

import { getVtimezoneComponent } from '@touch4it/ical-timezones';
import { localToInstant, normalizeLocal } from '$lib/server/platform/time';

export interface IcsEvent {
	uid: string;
	sequence: number;
	title: string;
	description: string;
	status: 'draft' | 'published' | 'cancelled';
	dtstartLocal: string;
	tzid: string;
	durationMinutes: number;
	rrule: string | null;
	exdates: string[];
	location: string;
	lat: number;
	lng: number;
	url: string;
	categories: string[];
	updatedAt: Date;
}

export interface IcsCalendar {
	name: string;
	description?: string;
	events: IcsEvent[];
}

function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
	const bytes = Buffer.from(line, 'utf8');
	if (bytes.length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let size = 0;
	for (const ch of line) {
		const len = Buffer.byteLength(ch, 'utf8');
		if (size + len > (parts.length ? 74 : 75)) {
			parts.push(current);
			current = '';
			size = 0;
		}
		current += ch;
		size += len;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

/** "2026-10-04T11:00" → "20261004T110000" */
const localStamp = (local: string) => normalizeLocal(local).replace(/[-:]/g, '') + '00';

/** Date → "20261004T080000Z" */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

/** With DTSTART;TZID, RFC 5545 requires UNTIL in UTC; the stored rule keeps a local end-of-day. */
function exportRRule(rrule: string, tzid: string): string {
	return rrule.replace(
		/UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?!Z)/,
		(_, y, mo, d, h, mi, s) =>
			`UNTIL=${utcStamp(localToInstant(`${y}-${mo}-${d}T${h}:${mi}:${s}`, tzid))}`
	);
}

export function renderCalendar(calendar: IcsCalendar): string {
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Nextep//Nextep v0.1//FI',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(calendar.name)}`
	];
	if (calendar.description) lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);

	const zones = new Set(calendar.events.map((e) => e.tzid));
	for (const tz of zones) {
		const vtimezone = getVtimezoneComponent(tz);
		if (vtimezone) lines.push(...vtimezone.trim().split(/\r?\n/));
	}

	for (const e of calendar.events) {
		const time = normalizeLocal(e.dtstartLocal).slice(11);
		lines.push(
			'BEGIN:VEVENT',
			`UID:${e.uid}`,
			`SEQUENCE:${e.sequence}`,
			`DTSTAMP:${utcStamp(e.updatedAt)}`,
			`LAST-MODIFIED:${utcStamp(e.updatedAt)}`,
			`DTSTART;TZID=${e.tzid}:${localStamp(e.dtstartLocal)}`,
			`DURATION:PT${e.durationMinutes}M`,
			`SUMMARY:${escapeText(e.title)}`,
			`DESCRIPTION:${escapeText(e.description)}`,
			`LOCATION:${escapeText(e.location)}`,
			`GEO:${e.lat.toFixed(6)};${e.lng.toFixed(6)}`,
			`URL:${e.url}`,
			`STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`
		);
		if (e.categories.length) lines.push(`CATEGORIES:${e.categories.map(escapeText).join(',')}`);
		if (e.rrule) {
			lines.push(`RRULE:${exportRRule(e.rrule, e.tzid)}`);
			for (const date of e.exdates) {
				lines.push(`EXDATE;TZID=${e.tzid}:${localStamp(`${date}T${time}`)}`);
			}
		}
		lines.push('END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}
