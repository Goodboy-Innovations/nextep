import { error } from '@sveltejs/kit';
import { eventIcs } from '$lib/server/modules/calendar';
import { getPublicEvent } from '$lib/server/modules/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const data = await getPublicEvent(params.org, params.event);
	if (!data) error(404, 'Tapahtumaa ei löytynyt');
	return new Response(await eventIcs(data.org, data.event), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `attachment; filename="${data.event.slug}.ics"`
		}
	});
};
