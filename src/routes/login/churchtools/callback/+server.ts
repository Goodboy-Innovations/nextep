import { completeChurchToolsFlow } from '$lib/server/pages/churchtools';
import type { RequestHandler } from './$types';

/** ChurchTools redirects here with ?code=…&state=… */
export const GET: RequestHandler = ({ cookies, url, locals }) =>
	completeChurchToolsFlow(cookies, url, locals.user);
