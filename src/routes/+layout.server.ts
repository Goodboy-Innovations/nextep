import { config } from '$lib/server/platform';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user,
	// The widget talks to our own proxy (src/routes/api/feedback), never to the server directly.
	feedbackEndpoint: locals.user && config.feedbackChat ? '/api/feedback' : null
});
