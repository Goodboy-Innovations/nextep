import type { Handle, ServerInit } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_COOKIE, validateSession } from '$lib/server/modules/identity';
import { materializeAll } from '$lib/server/modules/events';

const DAY_MS = 24 * 60 * 60 * 1000;

// Rolls the recurring-event window forward on startup and once a day.
// v0.1 runs this in-process; a separate worker can take over when there is more to do.
export const init: ServerInit = async () => {
	const g = globalThis as unknown as { __nextepScheduler?: NodeJS.Timeout };
	if (g.__nextepScheduler) return;
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
