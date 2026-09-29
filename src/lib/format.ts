// Display formatting shared by server and client. v0.1 is Finnish-only.

const TZ = 'Europe/Helsinki';

const dateFmt = new Intl.DateTimeFormat('fi-FI', {
	weekday: 'short',
	day: 'numeric',
	month: 'numeric',
	timeZone: TZ
});
const longDateFmt = new Intl.DateTimeFormat('fi-FI', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: TZ
});
const timeFmt = new Intl.DateTimeFormat('fi-FI', {
	hour: '2-digit',
	minute: '2-digit',
	timeZone: TZ
});

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatLongDate = (d: Date) => longDateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);

export function formatTimeRange(start: Date, end: Date): string {
	return `${formatTime(start)}–${formatTime(end)}`;
}

/** "Tänään", "Huomenna" or a short date. */
export function relativeDay(d: Date, now = new Date()): string {
	const key = (x: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(x);
	const today = key(now);
	const tomorrow = key(new Date(now.getTime() + 86_400_000));
	if (key(d) === today) return 'Tänään';
	if (key(d) === tomorrow) return 'Huomenna';
	return formatDate(d);
}

const MONTHS = [
	'tammi',
	'helmi',
	'maalis',
	'huhti',
	'touko',
	'kesä',
	'heinä',
	'elo',
	'syys',
	'loka',
	'marras',
	'joulu'
];
const WEEKDAYS = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

/** Parts for a calendar-style date badge, in Helsinki time: { weekday: "su", day: "4", month: "loka" }. */
export function dateParts(d: Date) {
	const [y, m, day] = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ })
		.format(d)
		.split('-')
		.map(Number);
	const weekday = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
	return { weekday: WEEKDAYS[weekday], day: String(day), month: MONTHS[m - 1] };
}

export function formatDistance(km: number | null): string | null {
	if (km === null) return null;
	return km < 1 ? 'alle 1 km' : `${Math.round(km)} km`;
}

export const STATUS_LABELS: Record<string, string> = {
	draft: 'Luonnos',
	published: 'Julkaistu',
	cancelled: 'Peruttu',
	in_review: 'Tarkastettavana',
	verified: 'Vahvistettu',
	suspended: 'Jäädytetty'
};

export const ROLE_LABELS: Record<string, string> = {
	editor: 'Muokkaaja',
	admin: 'Ylläpitäjä',
	owner: 'Omistaja'
};
