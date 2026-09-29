import { error } from '@sveltejs/kit';
import { listUpcomingOrgEvents } from '$lib/server/modules/events';
import { getPublicOrganization } from '$lib/server/modules/organizations';
import { absoluteUrl } from '$lib/server/modules/seo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const org = await getPublicOrganization(params.org);
	if (!org) error(404, 'Organisaatiota ei löytynyt');
	setHeaders({ 'cache-control': 'public, max-age=60' });
	return {
		org,
		events: await listUpcomingOrgEvents(org.id),
		canonical: absoluteUrl(`/o/${org.slug}`),
		feedUrl: absoluteUrl(`/o/${org.slug}/calendar.ics`)
	};
};
