import { config } from '$lib/server/platform';
import { listSitemapEvents } from '../events';
import { listVerifiedOrganizations, type Organization } from '../organizations';
import type { EventRow, OccurrenceView } from '../events';

export const absoluteUrl = (path: string) => `${config.publicUrl}${path}`;

/** schema.org Event JSON-LD — makes event pages eligible for Google's event listings. */
export function eventJsonLd(
	event: EventRow,
	org: Organization,
	occurrence: OccurrenceView | undefined,
	path: string
): string {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: event.title,
		description: event.extract || event.description.slice(0, 300),
		url: absoluteUrl(path),
		image: event.imageId ? [absoluteUrl(`/media/${event.imageId}`)] : undefined,
		startDate: occurrence?.startsAt.toISOString(),
		endDate: occurrence?.endsAt.toISOString(),
		eventStatus:
			event.status === 'cancelled'
				? 'https://schema.org/EventCancelled'
				: 'https://schema.org/EventScheduled',
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		location: {
			'@type': 'Place',
			name: event.venueName ?? org.name,
			address: {
				'@type': 'PostalAddress',
				streetAddress: event.streetAddress ?? undefined,
				addressLocality: event.city,
				addressCountry: 'FI'
			},
			geo: { '@type': 'GeoCoordinates', latitude: event.lat, longitude: event.lng }
		},
		organizer: { '@type': 'Organization', name: org.name, url: absoluteUrl(`/o/${org.slug}`) },
		isAccessibleForFree: true
	};
	// Escape "<" so the JSON can't close the <script> tag it is embedded in.
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

export async function sitemapXml(): Promise<string> {
	const [orgs, events] = await Promise.all([listVerifiedOrganizations(), listSitemapEvents()]);
	const urls = [
		{ loc: absoluteUrl('/'), lastmod: undefined as Date | undefined },
		...orgs.map((o) => ({ loc: absoluteUrl(`/o/${o.slug}`), lastmod: o.updatedAt })),
		...events.map((e) => ({
			loc: absoluteUrl(`/e/${e.orgSlug}/${e.eventSlug}`),
			lastmod: e.updatedAt
		}))
	];
	const body = urls
		.map(
			(u) =>
				`<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`
		)
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
