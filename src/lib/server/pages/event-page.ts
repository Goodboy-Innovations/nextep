import { error, redirect } from '@sveltejs/kit';
import { getPublicEvent, type OccurrenceView } from '$lib/server/modules/events';
import { absoluteUrl, eventJsonLd } from '$lib/server/modules/seo';

/** Shared by /e/[org]/[event] and /e/[org]/[event]/[date]. */
export async function loadEventPage(orgSlug: string, eventSlug: string, date?: string) {
	const data = await getPublicEvent(orgSlug, eventSlug);
	if (!data) error(404, 'Tapahtumaa ei löytynyt');

	const basePath = `/e/${orgSlug}/${eventSlug}`;
	const now = Date.now();
	const upcoming = data.occurrences.filter((o) => o.endsAt.getTime() >= now);

	let occurrence: OccurrenceView | undefined = upcoming[0] ?? data.occurrences.at(-1);
	if (date) {
		occurrence = data.occurrences.find((o) => o.localDate === date);
		// The date may have been cancelled or passed: fall back to the event's main page.
		if (!occurrence) redirect(307, basePath);
	}

	const path = date ? `${basePath}/${date}` : basePath;
	return {
		event: data.event,
		org: data.org,
		tags: data.tags,
		recurrence: data.recurrence,
		occurrence,
		upcoming: upcoming.slice(0, 8),
		basePath,
		// Every occurrence page points to the series page as canonical to avoid duplicate content.
		canonical: absoluteUrl(basePath),
		image: data.event.imageId ? `/media/${data.event.imageId}` : null,
		ogImage: data.event.imageId ? absoluteUrl(`/media/${data.event.imageId}`) : null,
		jsonLd: eventJsonLd(data.event, data.org, occurrence, path)
	};
}
