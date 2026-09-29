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
	}
};
