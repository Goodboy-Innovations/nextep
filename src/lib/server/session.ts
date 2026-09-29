// Cookie handling for sign-in, shared by password and OAuth login.

import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_COOKIE, createSession } from '$lib/server/modules/identity';

export async function startSession(cookies: Cookies, userId: string) {
	const { token, expiresAt } = await createSession(userId);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
}

/** Only same-site paths: "/x", but not "//host" or "/\host" (browsers treat both as another origin). */
export const safeNext = (next: string | null | undefined) =>
	next && /^\/(?![/\\])/.test(next) ? next : '/dashboard';

/** Short-lived cookies that carry OAuth state across the round trip to the provider. */
export const OAUTH_COOKIES = {
	state: 'nextep_oauth_state',
	verifier: 'nextep_oauth_verifier',
	next: 'nextep_oauth_next'
} as const;

export const oauthCookieOptions = {
	path: '/login',
	httpOnly: true,
	// Lax is required: the provider redirects back with a top-level GET from another site.
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: 10 * 60
};
