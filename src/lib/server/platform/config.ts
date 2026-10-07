// Single place where environment variables are read. Modules never import `$env/*`,
// so the same code runs inside SvelteKit, in scripts (seed) and in tests.

try {
	// Loads `.env` in local development. In Docker the variables come from compose.
	process.loadEnvFile();
} catch {
	// No .env file — rely on the real environment.
}

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Environment variable ${name} is not set`);
	return value;
}

export const config = {
	get databaseUrl() {
		return required('DATABASE_URL');
	},
	get databasePoolMax() {
		return Number(process.env.DATABASE_POOL_MAX) || 10;
	},
	/** Public base URL, used for canonical links, sitemap and ICS feeds. */
	get publicUrl() {
		return (process.env.PUBLIC_URL ?? process.env.ORIGIN ?? 'http://localhost:5173').replace(
			/\/$/,
			''
		);
	},
	get defaultTimezone() {
		return process.env.DEFAULT_TIMEZONE ?? 'Europe/Helsinki';
	},
	/** Apply pending migrations from drizzle/ when the server starts. The Docker image sets it. */
	get migrateOnStart() {
		return process.env.MIGRATE_ON_START === '1';
	},
	/** Fill a database without users with demo data when the server starts (staging). */
	get seedOnStart() {
		return process.env.SEED_ON_START === '1';
	},
	/** The admin login SEED_ON_START creates. Required with it: the demo password is public. */
	get seedAdmin() {
		return { email: required('SEED_ADMIN_EMAIL'), password: required('SEED_ADMIN_PASSWORD') };
	}
};
