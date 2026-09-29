import { Google, decodeIdToken } from 'arctic';
import type { ExternalIdentity, ProviderFactory } from './types';

export interface GoogleClaims {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
}

/** Google verifies ownership of the address when `email_verified` is true. */
export function googleIdentity(claims: GoogleClaims): ExternalIdentity {
	return {
		subject: claims.sub,
		email: claims.email?.toLowerCase() ?? null,
		emailTrusted: claims.email_verified === true && !!claims.email,
		name: claims.name ?? null
	};
}

export const google: ProviderFactory = (callbackURL) => {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;

	const client = new Google(clientId, clientSecret, callbackURL('google'));
	const scopes = ['openid', 'email', 'profile'];
	return {
		id: 'google',
		label: 'Google',
		scopes,
		createAuthorizationURL: (state, verifier) =>
			client.createAuthorizationURL(state, verifier, scopes),
		async validateCallback(code, verifier) {
			const tokens = await client.validateAuthorizationCode(code, verifier);
			// The ID token comes straight from Google's token endpoint over TLS, so it can be decoded
			// without verifying its signature.
			return googleIdentity(decodeIdToken(tokens.idToken()) as GoogleClaims);
		}
	};
};
