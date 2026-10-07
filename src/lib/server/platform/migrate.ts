import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from './config';

/**
 * Applies the pending migrations in `folder` (relative to the working directory), the same ones
 * and in the same bookkeeping table as `npm run db:migrate`. One connection holding an advisory
 * lock, so two instances starting together don't migrate at the same time. Throws if a migration
 * fails, which stops the server.
 */
export async function migrateDatabase(folder = 'drizzle'): Promise<void> {
	const sql = postgres(config.databaseUrl, { max: 1, onnotice: () => {} });
	try {
		await sql`select pg_advisory_lock(hashtext('nextep:migrate'))`;
		await migrate(drizzle(sql), { migrationsFolder: folder });
	} finally {
		await sql.end();
	}
}
