// Who is signing in with an external account (e.g. ChurchTools)? Pure decision logic, kept separate
// so the security rules are unit-tested.
//
// Anyone can run an external system (e.g. a ChurchTools instance) and put any email on a person
// there, so external emails are never trusted for linking. Rules:
// 1. An external account that is already linked always identifies its user.
// 2. Someone signed in to Nextep links the account to themselves ("connect").
// 3. Otherwise a new user is created — unless the email already belongs to a user. Then that
//    person must sign in to their account (password) and connect the external account there.
// Platform admins are never granted through external accounts: ADMIN_EMAILS applies to
// password sign-in only.

import type { ExternalIdentity } from './types';

export type ExternalSignInDecision =
	| { kind: 'existing'; userId: string }
	| { kind: 'link'; userId: string }
	| { kind: 'create'; email: string }
	| { kind: 'reject'; reason: SignInRejection };

export type SignInRejection = 'linked_elsewhere' | 'email_in_use' | 'no_email';

export function decideExternalSignIn(input: {
	identity: ExternalIdentity;
	/** User already linked to (provider, subject), if any. */
	linkedUserId: string | null;
	/** The user signed in to Nextep right now, if any. */
	currentUserId: string | null;
	/** Whether some user already has identity.email. */
	emailTaken: boolean;
}): ExternalSignInDecision {
	const { identity, linkedUserId, currentUserId, emailTaken } = input;
	if (currentUserId) {
		if (!linkedUserId) return { kind: 'link', userId: currentUserId };
		return linkedUserId === currentUserId
			? { kind: 'existing', userId: currentUserId }
			: { kind: 'reject', reason: 'linked_elsewhere' };
	}
	if (linkedUserId) return { kind: 'existing', userId: linkedUserId };
	if (!identity.email) return { kind: 'reject', reason: 'no_email' };
	if (emailTaken) return { kind: 'reject', reason: 'email_in_use' };
	return { kind: 'create', email: identity.email };
}

export function parseAdminEmails(value: string | undefined): Set<string> {
	return new Set(
		(value ?? '')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
	);
}
