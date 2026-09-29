import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Wall-clock time in a timezone, e.g. "2026-10-04T11:00". */
export type LocalDateTime = string;

/** Converts a wall-clock time in `tz` to an absolute instant (DST-aware). */
export function localToInstant(local: LocalDateTime, tz: string): Date {
	return fromZonedTime(local, tz);
}

/** Formats an instant as wall-clock time in `tz`. */
export function instantToLocal(instant: Date, tz: string): LocalDateTime {
	return formatInTimeZone(instant, tz, "yyyy-MM-dd'T'HH:mm");
}

/** Local calendar date (yyyy-MM-dd) of an instant in `tz`. */
export function localDate(instant: Date, tz: string): string {
	return formatInTimeZone(instant, tz, 'yyyy-MM-dd');
}

/** Normalizes Postgres `timestamp` output ("2026-10-04 11:00:00") to "2026-10-04T11:00". */
export function normalizeLocal(value: string): LocalDateTime {
	return value.replace(' ', 'T').slice(0, 16);
}

export const DAY_MS = 24 * 60 * 60 * 1000;
