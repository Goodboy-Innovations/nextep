// Who is signing in? Pure decision logic, kept separate so the security rules are unit-tested.
//
// Rules:
// 1. A provider account that is already linked always identifies its user.
// 2. Otherwise the account is linked to an invited user (created by an admin) with the same
//    email — but only when the provider guarantees the email (`emailTrusted`).
// 3. Emails listed in ADMIN_EMAILS may sign in without an invite and become platform admins
//    (bootstraps a fresh installation). Same email-trust rule applies.
// 4. Everyone else is rejected: seekers never need an account.

import type { ExternalIdentity } from './providers/types';

export interface KnownUser {
	id: string;
	isAdmin: boolean;
}

export type SignInDecision =
	| { kind: 'existing'; userId: string; promoteToAdmin: boolean }
	| { kind: 'link'; userId: string; promoteToAdmin: boolean }
	| { kind: 'create-admin'; email: string }
	| { kind: 'reject'; reason: 'not_invited' | 'email_unverified' };

export function decideSignIn(input: {
	identity: ExternalIdentity;
	/** User already linked to (provider, subject), if any. */
	linkedUser: KnownUser | null;
	/** User whose email equals identity.email, if any. */
	userWithEmail: KnownUser | null;
	adminEmails: ReadonlySet<string>;
}): SignInDecision {
	const { identity, linkedUser, userWithEmail, adminEmails } = input;
	const trustedEmail = identity.emailTrusted && identity.email ? identity.email : null;
	const isAdminEmail = trustedEmail !== null && adminEmails.has(trustedEmail);

	if (linkedUser) {
		return {
			kind: 'existing',
			userId: linkedUser.id,
			promoteToAdmin: isAdminEmail && !linkedUser.isAdmin
		};
	}
	if (!trustedEmail) {
		return { kind: 'reject', reason: identity.email ? 'email_unverified' : 'not_invited' };
	}
	if (userWithEmail) {
		return {
			kind: 'link',
			userId: userWithEmail.id,
			promoteToAdmin: isAdminEmail && !userWithEmail.isAdmin
		};
	}
	if (isAdminEmail) return { kind: 'create-admin', email: trustedEmail };
	return { kind: 'reject', reason: 'not_invited' };
}

export function parseAdminEmails(value: string | undefined): Set<string> {
	return new Set(
		(value ?? '')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
	);
}
