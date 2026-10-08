import { absoluteUrl } from '$lib/server/modules/seo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(
		`User-agent: *\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /login\nDisallow: /register\nDisallow: /account\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`,
		{ headers: { 'content-type': 'text/plain' } }
	);
