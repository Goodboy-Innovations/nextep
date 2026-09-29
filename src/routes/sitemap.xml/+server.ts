import { sitemapXml } from '$lib/server/modules/seo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	new Response(await sitemapXml(), {
		headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' }
	});
