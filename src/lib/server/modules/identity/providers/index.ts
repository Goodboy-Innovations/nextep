import { config } from '$lib/server/platform';
import { google } from './google';
import { microsoft } from './microsoft';
import type { OAuthProvider, ProviderFactory } from './types';

/**
 * All supported providers, in login-page order. To add one (see ../README.md):
 * write `providers/<id>.ts` exporting a ProviderFactory and list it here.
 */
const FACTORIES: ProviderFactory[] = [google, microsoft];

export const callbackURL = (id: string) => `${config.origin}/login/${id}/callback`;

let cache: OAuthProvider[] | null = null;

/** Providers whose credentials are configured. */
export function listProviders(): OAuthProvider[] {
	cache ??= FACTORIES.map((factory) => factory(callbackURL)).filter(
		(p): p is OAuthProvider => p !== null
	);
	return cache;
}

export function getProvider(id: string): OAuthProvider | null {
	return listProviders().find((p) => p.id === id) ?? null;
}

export type { ExternalIdentity, OAuthProvider } from './types';
