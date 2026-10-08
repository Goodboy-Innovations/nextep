import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/schema';

/**
 * Connected ChurchTools instances and Nextep's OAuth client in each: ChurchTools generates the
 * client id and secret when the church's admin adds Nextep there. `org_id` is the organization
 * the church registered (null only if that organization was deleted).
 */
export const churchtoolsInstances = pgTable('churchtools_instances', {
	/** e.g. "utopia.church.tools". */
	host: text('host').primaryKey(),
	clientId: text('client_id').notNull(),
	/** Sent only to the instance's token endpoint; never shown after it is saved. */
	clientSecret: text('client_secret').notNull(),
	orgId: uuid('org_id')
		.unique()
		.references(() => organizations.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
