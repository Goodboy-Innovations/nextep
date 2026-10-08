import { error } from '@sveltejs/kit';
import { config } from '$lib/server/platform';
import type { RequestHandler } from './$types';

// Passes the feedback chat through to the hosted feedback-chat server for signed-in users.
// The project secret stays here; the server trusts the user id we send with it.
const PROJECT = 'nextep';
const SESSION_PATH = /^sessions\/[\w-]{1,100}$/;

function upstream(path: string, init: RequestInit, user: NonNullable<App.Locals['user']>) {
	const feedback = config.feedbackChat;
	if (!feedback) error(404, 'Not found');
	return fetch(`${feedback.url}/${path}`, {
		...init,
		headers: {
			...init.headers,
			'x-feedback-key': feedback.secret,
			'x-feedback-user': encodeURIComponent(user.id),
			'x-feedback-user-name': encodeURIComponent(user.name)
		}
	});
}

/** Streams the reply through unbuffered: the chat's answers arrive as server-sent events. */
const relay = (res: Response) =>
	new Response(res.body, {
		status: res.status,
		headers: {
			'content-type': res.headers.get('content-type') ?? 'application/json',
			'cache-control': 'no-store'
		}
	});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Sign in to use the feedback chat');
	if (params.path !== 'chat') error(404, 'Not found');
	const body = await request.json().catch(() => null);
	if (!body || body.project !== PROJECT) error(400, 'Invalid request');
	const res = await upstream(
		'chat',
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: request.signal
		},
		locals.user
	);
	return relay(res);
};

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Sign in to use the feedback chat');
	if (!SESSION_PATH.test(params.path)) error(404, 'Not found');
	const res = await upstream(`${params.path}?project=${PROJECT}`, { method: 'GET' }, locals.user);
	return relay(res);
};
