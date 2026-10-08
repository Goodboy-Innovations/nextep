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

/** A user's account at an external system (e.g. ChurchTools). One user can link several. */
export const oauthAccounts = pgTable(
	'oauth_accounts',
	{
		/** Set by the module that owns the system, e.g. "churchtools:<host>". */
		provider: text('provider').notNull(),
		/** The system's stable user id. */
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
