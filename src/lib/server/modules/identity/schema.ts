import { boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(), // always stored lowercased
	name: text('name').notNull(),
	/** scrypt hash; null = the user signs in with OAuth only. */
	passwordHash: text('password_hash'),
	isAdmin: boolean('is_admin').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** A user's identity at an OAuth provider. One user can link several providers. */
export const oauthAccounts = pgTable(
	'oauth_accounts',
	{
		provider: text('provider').notNull(), // "google", "microsoft", …
		/** The provider's stable user id (OIDC `sub`). */
		subject: text('subject').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		email: text('email'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.provider, t.subject] })]
);

export const sessions = pgTable('sessions', {
	/** SHA-256 of the session token; the raw token only lives in the cookie. */
	id: text('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});
