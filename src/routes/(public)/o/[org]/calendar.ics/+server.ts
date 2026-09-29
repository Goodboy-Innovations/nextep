import { error } from '@sveltejs/kit';
import { organizationFeed } from '$lib/server/modules/calendar';
import { getPublicOrganization } from '$lib/server/modules/organizations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const org = await getPublicOrganization(params.org);
	if (!org) error(404, 'Organisaatiota ei löytynyt');
	return new Response(await organizationFeed(org), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'cache-control': 'public, max-age=900'
		}
	});
};
