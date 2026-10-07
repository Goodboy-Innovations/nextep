import {
	doublePrecision,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../identity/schema';

export const ORG_STATUSES = ['draft', 'in_review', 'verified', 'suspended'] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_ROLES = ['editor', 'admin', 'owner'] as const; // ascending privilege
export type OrgRole = (typeof ORG_ROLES)[number];

export const organizations = pgTable('organizations', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	businessId: text('business_id'), // Y-tunnus
	email: text('email'),
	phone: text('phone'),
	website: text('website'),
	streetAddress: text('street_address'),
	postalCode: text('postal_code'),
	city: text('city').notNull(),
	lat: doublePrecision('lat').notNull(),
	lng: doublePrecision('lng').notNull(),
	timezone: text('timezone').notNull().default('Europe/Helsinki'),
	status: text('status', { enum: ORG_STATUSES }).notNull().default('draft'),
	/**
	 * How many of the organization's events can be on the front page in the same week
	 * (0 = none). Set by admins.
	 */
	frontPageLimit: integer('front_page_limit').notNull().default(5),
	/** Who registered the organization, when it registered itself (shown in review). */
	registeredBy: uuid('registered_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const memberships = pgTable(
	'memberships',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		orgId: uuid('org_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ORG_ROLES }).notNull().default('editor')
	},
	(t) => [primaryKey({ columns: [t.userId, t.orgId] })]
);

/** People waiting to be let in by the organization's owner or admins. */
export const membershipRequests = pgTable(
	'membership_requests',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		orgId: uuid('org_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.orgId] })]
);
