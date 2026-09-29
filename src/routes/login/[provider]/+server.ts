import { error, redirect } from '@sveltejs/kit';
import { generateCodeVerifier, generateState, getProvider } from '$lib/server/modules/identity';
import { OAUTH_COOKIES, oauthCookieOptions, safeNext } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** Starts the OAuth authorization code flow (with PKCE). */
export const GET: RequestHandler = ({ params, cookies, url }) => {
	const provider = getProvider(params.provider);
	if (!provider) error(404, 'Tuntematon kirjautumistapa');

	const state = generateState();
	const verifier = generateCodeVerifier();
	cookies.set(OAUTH_COOKIES.state, state, oauthCookieOptions);
	cookies.set(OAUTH_COOKIES.verifier, verifier, oauthCookieOptions);
	cookies.set(OAUTH_COOKIES.next, safeNext(url.searchParams.get('next')), oauthCookieOptions);

	redirect(302, provider.createAuthorizationURL(state, verifier).toString());
};
