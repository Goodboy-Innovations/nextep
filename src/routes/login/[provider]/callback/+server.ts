import { error, redirect } from '@sveltejs/kit';
import { getProvider, signInWithIdentity } from '$lib/server/modules/identity';
import { OAUTH_COOKIES, oauthCookieOptions, safeNext, startSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** The provider redirects here with ?code=…&state=… */
export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const provider = getProvider(params.provider);
	if (!provider) error(404, 'Tuntematon kirjautumistapa');

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(OAUTH_COOKIES.state);
	const verifier = cookies.get(OAUTH_COOKIES.verifier);
	const next = safeNext(cookies.get(OAUTH_COOKIES.next));
	for (const name of Object.values(OAUTH_COOKIES)) {
		cookies.delete(name, { path: oauthCookieOptions.path });
	}

	if (!code || !state || !expectedState || !verifier || state !== expectedState) {
		redirect(303, '/login?error=failed');
	}

	let identity;
	try {
		identity = await provider.validateCallback(code, verifier);
	} catch (err) {
		console.error(`[login] ${provider.id} callback failed`, err);
		redirect(303, '/login?error=failed');
	}

	const result = await signInWithIdentity(provider.id, identity);
	if (!result.ok) redirect(303, `/login?error=${result.reason}`);

	await startSession(cookies, result.user.id);
	redirect(303, next);
};
