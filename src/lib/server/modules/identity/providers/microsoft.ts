import { MicrosoftEntraId, decodeIdToken } from 'arctic';
import type { ExternalIdentity, ProviderFactory } from './types';

/** Tenant of personal Microsoft accounts (Outlook.com, Hotmail, Live). */
export const MICROSOFT_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

export interface MicrosoftClaims {
	sub: string;
	tid?: string;
	email?: string;
	name?: string;
	/** Optional claim: the email's domain is verified by the tenant. Must be enabled in the app registration. */
	xms_edov?: boolean | string | number;
}

/**
 * In work/school tenants the `email` claim is set by the tenant admin and is NOT verified
 * by Microsoft — trusting it would allow account takeover ("nOAuth"). It is trusted only for
 * personal accounts, or when Microsoft asserts domain ownership with `xms_edov`.
 * `preferred_username` is never used.
 */
export function microsoftIdentity(claims: MicrosoftClaims): ExternalIdentity {
	const edov = claims.xms_edov === true || claims.xms_edov === 'true' || claims.xms_edov === 1;
	return {
		subject: claims.sub,
		email: claims.email?.toLowerCase() ?? null,
		emailTrusted: !!claims.email && (claims.tid === MICROSOFT_CONSUMER_TENANT || edov),
		name: claims.name ?? null
	};
}

export const microsoft: ProviderFactory = (callbackURL) => {
	const clientId = process.env.MICROSOFT_CLIENT_ID;
	const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;

	// "common" accepts both personal Outlook accounts and work/school accounts.
	const tenant = process.env.MICROSOFT_TENANT || 'common';
	const client = new MicrosoftEntraId(tenant, clientId, clientSecret, callbackURL('microsoft'));
	const scopes = ['openid', 'profile', 'email'];
	return {
		id: 'microsoft',
		label: 'Microsoft (Outlook)',
		scopes,
		createAuthorizationURL: (state, verifier) =>
			client.createAuthorizationURL(state, verifier, scopes),
		async validateCallback(code, verifier) {
			const tokens = await client.validateAuthorizationCode(code, verifier);
			// Received directly from Microsoft's token endpoint over TLS; decoding is sufficient.
			return microsoftIdentity(decodeIdToken(tokens.idToken()) as MicrosoftClaims);
		}
	};
};
