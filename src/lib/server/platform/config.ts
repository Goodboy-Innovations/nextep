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

const isOn = (value: string | undefined) => value === '1' || value === 'true';

export const config = {
	get databaseUrl() {
		const url = process.env.DATABASE_URL;
		// db.ts opens its pool as soon as it is imported, before the server's own check runs, so a
		// bad value names every configuration problem here instead of only "Invalid URL".
		if (!isPostgresUrl(url)) checkConfig();
		return url!;
	},
	get databasePoolMax() {
		return Number(process.env.DATABASE_POOL_MAX) || 10;
	},
	/**
	 * The site's own address (ORIGIN, which adapter-node also reads): canonical links, sitemap,
	 * ICS feeds, event UIDs and OAuth redirect URIs. `npm run dev` and scripts fall back to Vite's.
	 */
	get origin() {
		return (process.env.ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
	},
	get defaultTimezone() {
		return process.env.DEFAULT_TIMEZONE ?? 'Europe/Helsinki';
	},
	/** Fill a database without users with demo data when the server starts (staging). */
	get seedOnStart() {
		return isOn(process.env.SEED_ON_START);
	},
	/** The admin login SEED_ON_START creates. Required with it: the demo password is public. */
	get seedAdmin() {
		return { email: required('SEED_ADMIN_EMAIL'), password: required('SEED_ADMIN_PASSWORD') };
	},
	/**
	 * Hosted feedback chat for signed-in users, proxied through /api/feedback. Off unless both
	 * FEEDBACK_CHAT_URL (e.g. https://feedback-chat.cloudgood.fi) and FEEDBACK_SECRET (the
	 * "nextep" project's secret on that server) are set.
	 */
	get feedbackChat() {
		const url = process.env.FEEDBACK_CHAT_URL?.replace(/\/+$/, '');
		const secret = process.env.FEEDBACK_SECRET;
		return url && secret ? { url, secret } : null;
	}
};

function isPostgresUrl(value: string | undefined): value is string {
	if (!value) return false;
	try {
		const { protocol } = new URL(value);
		return protocol === 'postgres:' || protocol === 'postgresql:';
	} catch {
		return false;
	}
}

/** Host and database name, without the login. */
function databaseName(value: string): string {
	const url = new URL(value);
	return `${url.hostname}${url.pathname}`;
}

/** Variables that only work together: one set without the others is a mistake. */
const GROUPS = [
	['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'],
	['FEEDBACK_CHAT_URL', 'FEEDBACK_SECRET']
];

/**
 * Checks the environment once when the server starts, so a deployment with missing or half-set
 * variables stops with one message naming all of them, instead of failing on a later request or
 * quietly falling back (links to localhost, a hidden sign-in button). Deployments don't list their
 * variables anywhere else: on Coolify every variable reaches the container without the compose
 * file naming it. Returns a one-line summary for the log, without secrets.
 */
export function checkConfig(env: NodeJS.ProcessEnv = process.env): string {
	const problems: string[] = [];

	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl) problems.push('DATABASE_URL is not set');
	else if (!isPostgresUrl(databaseUrl)) problems.push('DATABASE_URL is not a postgres:// URL');

	// adapter-node's address: absolute links and the CSRF check of form posts. Without it a server
	// behind a TLS proxy thinks it is http.
	if (!env.ORIGIN) problems.push('ORIGIN is not set');

	for (const group of GROUPS) {
		const missing = group.filter((name) => !env[name]);
		if (missing.length && missing.length < group.length) {
			const given = group.filter((name) => env[name]);
			problems.push(`${given.join(', ')} set without ${missing.join(', ')}`);
		}
	}

	const seed = isOn(env.SEED_ON_START);
	// The demo data's own admin password is public, so seeding on a server needs its own login.
	if (seed && !env.SEED_ADMIN_EMAIL && !env.SEED_ADMIN_PASSWORD) {
		problems.push('SEED_ON_START set without SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD');
	}

	if (problems.length) {
		throw new Error(`Configuration is incomplete:\n- ${problems.join('\n- ')}`);
	}

	const admins = (env.ADMIN_EMAILS ?? '').split(',').filter((e) => e.trim()).length;
	return [
		`database ${databaseName(databaseUrl!)}`,
		`url ${env.ORIGIN}`,
		`admin emails ${admins}`,
		`seed ${seed ? 'on' : 'off'}`,
		`feedback chat ${env.FEEDBACK_CHAT_URL && env.FEEDBACK_SECRET ? 'on' : 'off'}`
	].join(' · ');
}
