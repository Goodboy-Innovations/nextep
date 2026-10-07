import { config } from '$lib/server/platform';
import { getEventTags, listFeedEvents, type EventRow } from '../events';
import type { Organization } from '../organizations';
import { renderCalendar, type IcsEvent } from './ics';

async function toIcsEvents(org: Organization, rows: EventRow[]): Promise<IcsEvent[]> {
	const tags = await getEventTags(rows.map((r) => r.id));
	return rows.map((e) => ({
		uid: e.uid,
		sequence: e.sequence,
		title: e.title,
		description: [e.extract, e.description].filter(Boolean).join('\n\n'),
		status: e.status,
		dtstartLocal: e.dtstartLocal,
		tzid: e.tzid,
		durationMinutes: e.durationMinutes,
		rrule: e.rrule,
		exdates: e.exdates,
		location: [e.venueName, e.streetAddress, e.city].filter(Boolean).join(', '),
		lat: e.lat,
		lng: e.lng,
		url: `${config.origin}/e/${org.slug}/${e.slug}`,
		categories: (tags.get(e.id) ?? []).filter((t) => t.kind === 'category').map((t) => t.label),
		updatedAt: e.updatedAt
	}));
}

/** Subscribable feed of all published events of an organization. */
export async function organizationFeed(org: Organization): Promise<string> {
	const rows = await listFeedEvents(org.id);
	return renderCalendar({
		name: `${org.name} (Nextep)`,
		description: org.description,
		events: await toIcsEvents(org, rows)
	});
}

/** A single event as an .ics file ("Add to calendar"). */
export async function eventIcs(org: Organization, event: EventRow): Promise<string> {
	return renderCalendar({ name: event.title, events: await toIcsEvents(org, [event]) });
}
