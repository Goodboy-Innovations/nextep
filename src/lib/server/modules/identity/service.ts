import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db, DAY_MS } from '$lib/server/platform';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';
import type { ExternalIdentity } from './types';
import { decideExternalSignIn, parseAdminEmails, type SignInRejection } from './resolve';
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

/** Creates a user. They sign in with email + password if a password is given. */
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

export async function setAdmin(userId: string, isAdmin: boolean): Promise<void> {
	await db.update(users).set({ isAdmin }).where(eq(users.id, userId));
}

/**
 * Email + password sign-in. Returns null on any mismatch, in constant-ish time. Emails in
 * ADMIN_EMAILS become platform admins here.
 */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
	if (!user?.passwordHash) {
		await verifyPassword(password, await dummyPasswordHash());
		return null;
	}
	if (!(await verifyPassword(password, user.passwordHash))) return null;
	// ADMIN_EMAILS only applies here: a password proves the account, an external email doesn't.
	if (!user.isAdmin && parseAdminEmails(process.env.ADMIN_EMAILS).has(user.email)) {
		await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
		return { ...toSessionUser(user), isAdmin: true };
	}
	return toSessionUser(user);
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
	| { ok: true; user: SessionUser; outcome: 'existing' | 'linked' | 'created' }
	| { ok: false; reason: SignInRejection };

/**
 * Resolves an external account (e.g. ChurchTools) to a user by the rules in resolve.ts: an
 * existing link, a link to the signed-in user, or a new user.
 */
export async function signInWithExternalAccount(
	provider: string,
	identity: ExternalIdentity,
	currentUserId: string | null
): Promise<SignInResult> {
	const [linked] = await db
		.select({ userId: oauthAccounts.userId })
		.from(oauthAccounts)
		.where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, identity.subject)));
	const emailTaken =
		!linked && !currentUserId && identity.email ? !!(await findUserByEmail(identity.email)) : false;

	const decision = decideExternalSignIn({
		identity,
		linkedUserId: linked?.userId ?? null,
		currentUserId,
		emailTaken
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
		case 'create': {
			const user = await createUser({
				email: decision.email,
				name: identity.name ?? decision.email
			});
			userId = user.id;
			await linkAccount(provider, identity, userId);
			break;
		}
	}
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	const outcome =
		decision.kind === 'create' ? 'created' : decision.kind === 'link' ? 'linked' : 'existing';
	return { ok: true, user: toSessionUser(user), outcome };
}

/** Whether the user has a password. */
export async function hasPassword(userId: string): Promise<boolean> {
	const [user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, userId));
	return !!user?.passwordHash;
}

/** Provider ids of the user's linked external accounts, e.g. "churchtools:utopia.church.tools". */
export async function listLinkedAccounts(userId: string): Promise<string[]> {
	const rows = await db
		.select({ provider: oauthAccounts.provider })
		.from(oauthAccounts)
		.where(eq(oauthAccounts.userId, userId))
		.orderBy(asc(oauthAccounts.provider));
	return rows.map((r) => r.provider);
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
