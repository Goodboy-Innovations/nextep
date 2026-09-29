import { customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/schema';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * Uploaded images, stored in Postgres for now (one less service to run). Never select `data`
 * in list queries — use `getImage` for the bytes.
 */
export const mediaAssets = pgTable(
	'media_assets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		orgId: uuid('org_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		contentType: text('content_type').notNull(),
		byteSize: integer('byte_size').notNull(),
		data: bytea('data').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('media_assets_org_idx').on(t.orgId)]
);
