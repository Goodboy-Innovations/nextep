import { loadEventPage } from '$lib/server/pages/event-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60' });
	return loadEventPage(params.org, params.event);
};
