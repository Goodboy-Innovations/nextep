/** What every provider returns after a successful callback. */
export interface ExternalIdentity {
	/** The provider's stable user id (OIDC `sub`). */
	subject: string;
	email: string | null;
	/**
	 * True only when the provider guarantees the user controls `email`. Linking an
	 * invited user by email is allowed only then — see resolve.ts.
	 */
	emailTrusted: boolean;
	name: string | null;
}

export interface OAuthProvider {
	/** URL segment and database value, e.g. "google". Never change it once used. */
	id: string;
	/** Button text on the login page. */
	label: string;
	/** Scopes to request. */
	scopes: string[];
	createAuthorizationURL(state: string, codeVerifier: string): URL;
	/** Exchanges the authorization code and normalizes the provider's claims. */
	validateCallback(code: string, codeVerifier: string): Promise<ExternalIdentity>;
}

/**
 * A provider file's factory. `callbackURL(id)` gives the redirect URI to register at the
 * provider. Returns null when the provider's credentials are not configured.
 */
export type ProviderFactory = (callbackURL: (id: string) => string) => OAuthProvider | null;
