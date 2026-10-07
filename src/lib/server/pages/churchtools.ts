// SvelteKit glue for the churchtools module: cookies and redirects of the sign-in flow, which
// covers signing in, connecting ChurchTools to the signed-in account, registering a church and
// replacing a registered church's client id. The decisions are in modules/churchtools.

import { redirect, type Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { config } from '$lib/server/platform';
import type { SessionUser } from '$lib/server/modules/identity';
import {
	CHURCHTOOLS_CALLBACK_PATH,
	checkChurchToolsClient,
	churchToolsAuthorizationURL,
	completeSignIn,
	generateCodeVerifier,
	generateState,
	getClient,
	instanceSubdomain,
	validateChurchToolsCallback,
	type ChurchToolsClient,
	type ClientCheck
} from '$lib/server/modules/churchtools';
import { OAUTH_COOKIES, oauthCookieOptions, safeNext, startSession } from '$lib/server/session';

/** Messages for the ?error= codes this flow redirects with, for the pages that show them. */
export const CHURCHTOOLS_ERRORS: Record<string, string> = {
	email_in_use:
		'Tällä sähköpostiosoitteella on jo Nextep-tili, jossa ei ole ChurchTools-kirjautumista. Kirjaudu tilillesi sähköpostilla ja salasanalla, niin voit liittää ChurchToolsin siihen.',
	no_email:
		'ChurchTools-profiilissasi ei ole sähköpostiosoitetta. Lisää se ChurchToolsiin ja yritä uudelleen.',
	linked_elsewhere: 'Tämä ChurchTools-tunnus on jo liitetty toiseen Nextep-tiliin.',
	invalid_instance: 'Kirjoita seurakuntasi ChurchTools-osoitteen alkuosa, esim. utopia.',
	no_instance: 'Tällä osoitteella ei löytynyt ChurchToolsia. Tarkista osoite.',
	unknown_instance: 'Tämä ChurchTools ei ole vielä Nextepissä.'
};

const COOKIES = {
	/** The instance the flow was started for. */
	instance: 'nextep_oauth_instance',
	/** The client being tried, with /register's details, until ChurchTools accepts it. */
	registration: 'nextep_oauth_registration',
	/** The last instance used, to prefill the login page. Not a secret. */
	remembered: 'nextep_churchtools',
	/**
	 * A registration interrupted by `email_in_use`, to prefill /register after the person signed
	 * in to their account: ChurchTools shows the client secret only once.
	 */
	pending: 'nextep_registration_pending'
} as const;

const pendingCookieOptions = {
	path: '/register',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: 30 * 60
};

/** The client /register tries. The church's details come from its ChurchTools. */
export interface Registration {
	clientId: string;
	clientSecret: string;
}

const redirectURI = () => `${config.origin}${CHURCHTOOLS_CALLBACK_PATH}`;

/** The registration this browser started before it had to sign in first, if any. */
export function pendingRegistration(
	cookies: Cookies
): (Registration & { instance: string }) | null {
	const value = cookies.get(COOKIES.pending);
	if (!value) return null;
	try {
		const p = JSON.parse(value) as Registration & { instance: string };
		return typeof p.instance === 'string' && readRegistration(value) ? p : null;
	} catch {
		return null;
	}
}

/** The subdomain of the last instance this browser signed in with, or "". */
export const rememberedInstance = (cookies: Cookies) =>
	instanceSubdomain(cookies.get(COOKIES.remembered) ?? '');

/**
 * Redirects to the instance's authorization page — after checking that the instance exists and
 * knows the client. Otherwise returns the problem for the caller to show.
 */
export async function startChurchToolsFlow(
	cookies: Cookies,
	client: ChurchToolsClient,
	next: string,
	registration?: Registration
): Promise<Exclude<ClientCheck, 'ok'>> {
	const state = generateState();
	const verifier = generateCodeVerifier();
	const url = churchToolsAuthorizationURL(client, redirectURI(), state, verifier);
	const check = await checkChurchToolsClient(client, redirectURI(), url, !!registration);
	if (check !== 'ok') return check;

	cookies.set(OAUTH_COOKIES.state, state, oauthCookieOptions);
	cookies.set(OAUTH_COOKIES.verifier, verifier, oauthCookieOptions);
	cookies.set(OAUTH_COOKIES.next, next, oauthCookieOptions);
	cookies.set(COOKIES.instance, client.host, oauthCookieOptions);
	if (registration) {
		cookies.set(COOKIES.registration, JSON.stringify(registration), oauthCookieOptions);
	}
	redirect(302, url.toString());
}

function readRegistration(value: string | undefined): Registration | null {
	if (!value) return null;
	try {
		const r = JSON.parse(value) as Registration;
		return typeof r.clientId === 'string' && typeof r.clientSecret === 'string' ? r : null;
	} catch {
		return null;
	}
}

/** Handles /login/churchtools/callback. Always redirects. */
export async function completeChurchToolsFlow(
	cookies: Cookies,
	url: URL,
	currentUser: SessionUser | null
): Promise<never> {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(OAUTH_COOKIES.state);
	const verifier = cookies.get(OAUTH_COOKIES.verifier);
	const host = cookies.get(COOKIES.instance);
	const next = safeNext(cookies.get(OAUTH_COOKIES.next));
	const registration = readRegistration(cookies.get(COOKIES.registration));
	for (const name of [...Object.values(OAUTH_COOKIES), COOKIES.instance, COOKIES.registration]) {
		cookies.delete(name, { path: oauthCookieOptions.path });
	}
	const failed = registration ? '/register?error=failed' : '/login?error=failed';
	if (!code || !state || !expectedState || !verifier || !host || state !== expectedState) {
		redirect(303, failed);
	}

	// /register tries a new client; sign-in uses the stored one.
	const client = registration
		? { host, clientId: registration.clientId, clientSecret: registration.clientSecret }
		: await getClient(host);
	if (!client) redirect(303, '/login?error=unknown_instance');

	let identity;
	try {
		identity = await validateChurchToolsCallback(client, redirectURI(), code, verifier);
	} catch (err) {
		console.error(`[login] ChurchTools callback from ${host} failed`, err);
		redirect(303, failed);
	}

	const result = await completeSignIn({
		client,
		identity,
		currentUserId: currentUser?.id ?? null,
		registration: !!registration
	});
	if (!result.ok) {
		const subdomain = instanceSubdomain(host);
		if (registration && result.reason === 'email_in_use') {
			cookies.set(
				COOKIES.pending,
				JSON.stringify({ instance: subdomain, ...registration }),
				pendingCookieOptions
			);
		}
		// Sign in to the existing account first, then come back to connect or register.
		const then = registration ? `/register?instance=${subdomain}` : `/account?connect=${subdomain}`;
		const targets: Record<typeof result.reason, string> = {
			email_in_use: `/login?error=email_in_use&next=${encodeURIComponent(then)}`,
			linked_elsewhere: '/account?error=linked_elsewhere',
			registered: '/register?error=registered',
			no_email: '/login?error=no_email'
		};
		redirect(303, targets[result.reason]);
	}

	cookies.set(COOKIES.remembered, host, {
		path: '/login',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 365 * 24 * 60 * 60
	});
	if (registration) cookies.delete(COOKIES.pending, { path: pendingCookieOptions.path });
	if (!currentUser) await startSession(cookies, result.user.id);
	if (result.registeredOrgSlug) {
		redirect(303, `/dashboard/${result.registeredOrgSlug}/profile?registered=1`);
	}
	if (currentUser) redirect(303, `/account?connected=${host}`);
	redirect(303, next);
}
