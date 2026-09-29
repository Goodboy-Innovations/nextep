import { error } from '@sveltejs/kit';
import { loadEventPage } from '$lib/server/pages/event-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(404, 'Sivua ei löytynyt');
	setHeaders({ 'cache-control': 'public, max-age=60' });
	return loadEventPage(params.org, params.event, params.date);
};
