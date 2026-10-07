import type { Handle, ServerInit } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { SESSION_COOKIE, validateSession } from '$lib/server/modules/identity';
import { materializeAll } from '$lib/server/modules/events';
import { checkConfig, config } from '$lib/server/platform';
import { migrateDatabase } from '$lib/server/platform/migrate';
import { seedEmptyDatabase } from '$lib/server/seed/demo';

const DAY_MS = 24 * 60 * 60 * 1000;

// In production the environment is checked and the schema brought up to date before the first
// request; a failure stops the server. In development `npm run db:migrate` does it. With
// SEED_ON_START, an empty database then gets the demo data.
// After that, rolls the recurring-event window forward, on startup and once a day.
// v0.1 runs this in-process; a separate worker can take over when there is more to do.
export const init: ServerInit = async () => {
	const g = globalThis as unknown as { __nextepScheduler?: NodeJS.Timeout };
	if (g.__nextepScheduler || building) return;
	if (!dev) {
		console.log(`Config: ${checkConfig()}`);
		await migrateDatabase();
		console.log('[migrate] database is up to date');
		if (config.seedOnStart) await seedEmptyDatabase(config.seedAdmin);
	}
	const run = () =>
		materializeAll()
			.then((n) => console.log(`[scheduler] materialized ${n} recurring events`))
			.catch((err) => console.error('[scheduler] materialization failed', err));
	g.__nextepScheduler = setInterval(run, DAY_MS);
	void run();
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = null;
	if (token) {
		const session = await validateSession(token);
		if (session) {
			event.locals.user = session.user;
			event.cookies.set(SESSION_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				expires: session.expiresAt
			});
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}
	return resolve(event);
};
