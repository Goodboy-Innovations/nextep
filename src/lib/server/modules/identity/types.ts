/**
 * Who signed in at an external system (e.g. ChurchTools). The email is NOT trusted: anyone can
 * run such a system and put any address on a person, so it never links to an existing
 * account — see resolve.ts.
 */
export interface ExternalIdentity {
	/** The provider's stable user id. */
	subject: string;
	email: string | null;
	name: string | null;
}
