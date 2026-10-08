// The ChurchTools protocol (https://church.tools), without the database. Every church runs its
// own instance, e.g. utopia.church.tools, and it acts as its own OAuth 2 server (no OpenID
// Connect, so no ID token: the person comes from /oauth/userinfo).
//
// Authorization code flow with PKCE. ChurchTools clients are confidential: the instance's admin
// creates a client named Nextep, ChurchTools shows its secret once and then its client id, and
// the church enters both on /register (stored in churchtools_instances).

import { CodeChallengeMethod, OAuth2Client } from 'arctic';
import type { ExternalIdentity } from '$lib/server/modules/identity';

/** An instance and Nextep's OAuth client there. */
export interface ChurchToolsClient {
	host: string;
	clientId: string;
	clientSecret: string;
}

export const CHURCHTOOLS_CALLBACK_PATH = '/login/churchtools/callback';

const PROVIDER_PREFIX = 'churchtools:';

/** Value of `oauth_accounts.provider`: person ids are only unique within one instance. */
export const churchToolsProvider = (host: string) => `${PROVIDER_PREFIX}${host}`;

/** The instance host of a provider id from `churchToolsProvider`, or null for other providers. */
export const providerHost = (provider: string) =>
	provider.startsWith(PROVIDER_PREFIX) ? provider.slice(PROVIDER_PREFIX.length) : null;

/** Every ChurchTools instance is a subdomain of this. */
export const CHURCHTOOLS_DOMAIN = 'church.tools';

const SUBDOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Turns what a person types into an instance host. They type the subdomain ("utopia"), but a
 * pasted "utopia.church.tools" or "https://utopia.church.tools/" works too. Null for anything
 * that isn't a church.tools subdomain — Nextep never contacts other hosts.
 */
export function normalizeInstanceHost(input: string): string | null {
	let value = input.trim().toLowerCase();
	if (!value) return null;
	if (!value.includes('://')) value = `https://${value}`;
	let host: string;
	try {
		host = new URL(value).hostname;
	} catch {
		return null;
	}
	const suffix = `.${CHURCHTOOLS_DOMAIN}`;
	const subdomain = host.endsWith(suffix) ? host.slice(0, -suffix.length) : host;
	return SUBDOMAIN.test(subdomain) ? `${subdomain}${suffix}` : null;
}

/** "utopia.church.tools" → "utopia", for the subdomain-only input. Other text is kept. */
export const instanceSubdomain = (host: string) =>
	host.endsWith(`.${CHURCHTOOLS_DOMAIN}`) ? host.slice(0, -CHURCHTOOLS_DOMAIN.length - 1) : host;

/** /oauth/userinfo response (only the fields Nextep uses). */
export interface ChurchToolsUserInfo {
	/** Person id. */
	id: number | string;
	email?: string | null;
	data?: { firstName?: string; lastName?: string; displayName?: string } | null;
}

/** Maps userinfo to an identity. The email is not trusted — see resolve.ts. */
export function churchToolsIdentity(info: ChurchToolsUserInfo): ExternalIdentity {
	if (info.id === undefined || info.id === null || info.id === '') {
		throw new Error('ChurchTools userinfo has no id');
	}
	const data = info.data ?? {};
	const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
	return {
		subject: String(info.id),
		email: info.email?.trim().toLowerCase() || null,
		name: data.displayName || fullName || null
	};
}

/** Public /api/info response (only the fields Nextep uses). */
export interface ChurchToolsSiteInfo {
	siteName?: string | null;
	address?: {
		street?: string | null;
		zip?: string | null;
		city?: string | null;
		latitude?: string | number | null;
		longitude?: string | number | null;
	} | null;
}

export interface ChurchProfile {
	name: string | null;
	streetAddress: string | null;
	postalCode: string | null;
	city: string | null;
	lat: number | null;
	lng: number | null;
}

export function churchProfile(info: ChurchToolsSiteInfo): ChurchProfile {
	const address = info.address ?? {};
	const coordinate = (v: string | number | null | undefined) => {
		const n = v === null || v === undefined || v === '' ? NaN : Number(v);
		return Number.isFinite(n) ? n : null;
	};
	const lat = coordinate(address.latitude);
	const lng = coordinate(address.longitude);
	const text = (v: string | null | undefined) => v?.trim() || null;
	return {
		name: text(info.siteName),
		streetAddress: text(address.street),
		postalCode: text(address.zip),
		city: text(address.city),
		// Both or neither.
		lat: lat !== null && lng !== null ? lat : null,
		lng: lat !== null && lng !== null ? lng : null
	};
}

/**
 * The church's name and address from the instance's public /api/info. Only call it with the
 * host of a connected instance, so it can't be used to fetch other churches' instances.
 */
export async function fetchChurchProfile(host: string): Promise<ChurchProfile> {
	const response = await fetch(`https://${host}/api/info`, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) throw new Error(`ChurchTools /api/info: HTTP ${response.status}`);
	return churchProfile((await response.json()) as ChurchToolsSiteInfo);
}

const endpoint = (host: string, path: string) => `https://${host}/oauth/${path}`;
// With a secret, arctic authenticates the token request with HTTP Basic.
const client = (instance: ChurchToolsClient, redirectURI: string) =>
	new OAuth2Client(instance.clientId, instance.clientSecret, redirectURI);

export function churchToolsAuthorizationURL(
	instance: ChurchToolsClient,
	redirectURI: string,
	state: string,
	codeVerifier: string
): URL {
	// ChurchTools defines no scopes.
	return client(instance, redirectURI).createAuthorizationURLWithPKCE(
		endpoint(instance.host, 'authorize'),
		state,
		CodeChallengeMethod.S256,
		codeVerifier,
		[]
	);
}

/** Exchanges the authorization code and fetches who signed in. */
export async function validateChurchToolsCallback(
	instance: ChurchToolsClient,
	redirectURI: string,
	code: string,
	codeVerifier: string
): Promise<ExternalIdentity> {
	const tokens = await client(instance, redirectURI).validateAuthorizationCode(
		endpoint(instance.host, 'access_token'),
		code,
		codeVerifier
	);
	const response = await fetch(endpoint(instance.host, 'userinfo'), {
		headers: { Authorization: `Bearer ${tokens.accessToken()}`, Accept: 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) throw new Error(`ChurchTools userinfo: HTTP ${response.status}`);
	return churchToolsIdentity((await response.json()) as ChurchToolsUserInfo);
}

export type ClientCheck = 'ok' | 'no_instance' | 'client_missing' | 'secret_wrong';

/**
 * Classifies the pre-flight responses (null = not asked, or the request failed). An unknown
 * subdomain isn't a 404: church.tools redirects it to find.church.tools, so instance existence
 * comes from /api/info, which answers JSON only for a real instance. An existing instance answers
 * 404 for a client id it doesn't know and 401 for a redirect URI it doesn't accept (any 4xx but
 * 408 and 429 is treated as a setup problem). The token endpoint answers `invalid_client` to a
 * wrong secret. Anything else, including ChurchTools being unreachable or busy, passes: the
 * person then sees ChurchTools' own page.
 */
export function classifyClientCheck(
	info: { status: number; contentType: string } | null,
	authorizeStatus: number | null,
	tokenError: string | null
): ClientCheck {
	if (info && !(info.status === 200 && info.contentType.includes('json'))) return 'no_instance';
	if (
		authorizeStatus !== null &&
		authorizeStatus >= 400 &&
		authorizeStatus < 500 &&
		authorizeStatus !== 408 &&
		authorizeStatus !== 429
	) {
		return 'client_missing';
	}
	if (tokenError === 'invalid_client') return 'secret_wrong';
	return 'ok';
}

/**
 * Checks that the instance exists, knows the client and accepts its secret before sending a
 * person there. The secret is tested by redeeming a made-up code: ChurchTools authenticates the
 * client before it looks at the code.
 *
 * Only `setup` (a church registering, with a client typed in by hand) runs all three requests.
 * Signing in with a stored client asks only the authorization page, which a browser would load
 * next anyway: anyone can start a sign-in, so it must not make Nextep send the church's secret
 * or extra requests to its ChurchTools.
 */
export async function checkChurchToolsClient(
	instance: ChurchToolsClient,
	redirectURI: string,
	authorizationURL: URL,
	setup: boolean
): Promise<ClientCheck> {
	const request = async (url: string | URL, init: RequestInit) => {
		try {
			return await fetch(url, {
				...init,
				redirect: 'manual',
				signal: AbortSignal.timeout(5_000)
			});
		} catch {
			return null;
		}
	};
	const [info, authorize, token] = await Promise.all([
		setup
			? request(`https://${instance.host}/api/info`, { headers: { Accept: 'application/json' } })
			: null,
		// Asked like a browser: with JSON accepted, ChurchTools answers 401 "not signed in" even
		// for a valid client. As HTML: valid client 200, unknown client 404, wrong redirect URI 401.
		request(authorizationURL, { headers: { Accept: 'text/html' } }),
		setup
			? request(endpoint(instance.host, 'access_token'), {
					method: 'POST',
					headers: {
						Accept: 'application/json',
						Authorization: `Basic ${btoa(`${instance.clientId}:${instance.clientSecret}`)}`
					},
					body: new URLSearchParams({
						grant_type: 'authorization_code',
						code: 'nextep-preflight',
						redirect_uri: redirectURI,
						code_verifier: 'nextep-preflight-'.padEnd(43, '0')
					})
				})
			: null
	]);
	await Promise.all([info, authorize].map((r) => r?.body?.cancel()));
	let tokenError: string | null = null;
	try {
		tokenError = ((await token?.json()) as { error?: string } | undefined)?.error ?? null;
	} catch {
		// Not JSON: leave it to the sign-in itself.
	}
	return classifyClientCheck(
		info && { status: info.status, contentType: info.headers.get('content-type') ?? '' },
		authorize?.status ?? null,
		tokenError
	);
}
