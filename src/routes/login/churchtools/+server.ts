import { redirect } from '@sveltejs/kit';
import {
	getClient,
	instanceSubdomain,
	normalizeInstanceHost
} from '$lib/server/modules/churchtools';
import { startChurchToolsFlow } from '$lib/server/pages/churchtools';
import { safeNext } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * Signs in with (or, when signed in, connects) a church's ChurchTools: ?instance=utopia.
 * Starts the OAuth authorization code flow with PKCE.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	const input = url.searchParams.get('instance') ?? '';
	const host = normalizeInstanceHost(input);
	function back(error: string, instance: string): never {
		const query = new URLSearchParams({ error, instance: instance.slice(0, 200) });
		if (url.searchParams.has('next')) query.set('next', next);
		redirect(303, `${next === '/account' ? '/account' : '/login'}?${query}`);
	}

	if (!host) back('invalid_instance', input);
	const client = await getClient(host);
	if (!client) back('unknown_instance', instanceSubdomain(host));

	const problem = await startChurchToolsFlow(cookies, client, next);
	// ChurchTools doesn't accept Nextep's client (deleted or recreated there): same as a church
	// that isn't in Nextep — registering again replaces the client.
	back(problem === 'no_instance' ? problem : 'unknown_instance', instanceSubdomain(host));
};
