import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db, DAY_MS } from '$lib/server/platform';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';
import type { ExternalIdentity } from './providers/types';
import { decideSignIn, parseAdminEmails } from './resolve';
import { oauthAccounts, sessions, users } from './schema';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	isAdmin: boolean;
}

const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'nextep_session';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const toSessionUser = (u: typeof users.$inferSelect): SessionUser => ({
	id: u.id,
	email: u.email,
	name: u.name,
	isAdmin: u.isAdmin
});

/**
 * Invites a user. They can sign in with any OAuth provider that confirms this email, and
 * with email + password if a password is given.
 */
export async function createUser(input: {
	email: string;
	name: string;
	password?: string | null;
	isAdmin?: boolean;
}): Promise<SessionUser> {
	const [user] = await db
		.insert(users)
		.values({
			email: input.email.trim().toLowerCase(),
			name: input.name.trim(),
			passwordHash: input.password ? await hashPassword(input.password) : null,
			isAdmin: input.isAdmin ?? false
		})
		.returning();
	return toSessionUser(user);
}

/** Sets or replaces a user's password (null removes password login for them). */
export async function setPassword(userId: string, password: string | null): Promise<void> {
	await db
		.update(users)
		.set({ passwordHash: password ? await hashPassword(password) : null })
		.where(eq(users.id, userId));
}

/** Email + password sign-in. Returns null on any mismatch, in constant-ish time. */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
	if (!user?.passwordHash) {
		await verifyPassword(password, await dummyPasswordHash());
		return null;
	}
	return (await verifyPassword(password, user.passwordHash)) ? toSessionUser(user) : null;
}

export async function findUserByEmail(email: string): Promise<SessionUser | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
	return user ? toSessionUser(user) : null;
}

/** All users with their sign-in methods: linked providers, plus "password" if set. */
export async function listUsers(): Promise<(SessionUser & { providers: string[] })[]> {
	const [rows, accounts] = await Promise.all([
		db.select().from(users).orderBy(asc(users.email)),
		db
			.select({ userId: oauthAccounts.userId, provider: oauthAccounts.provider })
			.from(oauthAccounts)
	]);
	return rows.map((u) => ({
		...toSessionUser(u),
		providers: [
			...(u.passwordHash ? ['password'] : []),
			...accounts.filter((a) => a.userId === u.id).map((a) => a.provider)
		]
	}));
}

export type SignInResult =
	{ ok: true; user: SessionUser } | { ok: false; reason: 'not_invited' | 'email_unverified' };

/** Resolves an OAuth identity to a user, linking or creating as the rules in resolve.ts allow. */
export async function signInWithIdentity(
	provider: string,
	identity: ExternalIdentity
): Promise<SignInResult> {
	const [linked] = await db
		.select({ user: users })
		.from(oauthAccounts)
		.innerJoin(users, eq(users.id, oauthAccounts.userId))
		.where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, identity.subject)));
	const [withEmail] =
		!linked && identity.emailTrusted && identity.email
			? await db.select().from(users).where(eq(users.email, identity.email))
			: [];

	const decision = decideSignIn({
		identity,
		linkedUser: linked?.user ?? null,
		userWithEmail: withEmail ?? null,
		adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS)
	});

	let userId: string;
	switch (decision.kind) {
		case 'reject':
			return { ok: false, reason: decision.reason };
		case 'existing':
			userId = decision.userId;
			break;
		case 'link':
			userId = decision.userId;
			await linkAccount(provider, identity, userId);
			break;
		case 'create-admin': {
			const user = await createUser({
				email: decision.email,
				name: identity.name ?? decision.email,
				isAdmin: true
			});
			userId = user.id;
			await linkAccount(provider, identity, userId);
			break;
		}
	}
	if (decision.kind !== 'create-admin' && decision.promoteToAdmin) {
		await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
	}
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	return { ok: true, user: toSessionUser(user) };
}

async function linkAccount(provider: string, identity: ExternalIdentity, userId: string) {
	await db
		.insert(oauthAccounts)
		.values({ provider, subject: identity.subject, userId, email: identity.email })
		.onConflictDoNothing();
}

/** Creates a session and returns the raw token to put in the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	return { token, expiresAt };
}

/** Validates a session token and slides its expiry forward when it is half used up. */
export async function validateSession(
	token: string
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
	const id = hashToken(token);
	const [row] = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id));
	if (!row) return null;

	let expiresAt = row.session.expiresAt;
	if (expiresAt.getTime() < Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
		expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}
	return { user: toSessionUser(row.user), expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
