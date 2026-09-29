import { error } from '@sveltejs/kit';
import { getImage } from '$lib/server/modules/media';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const image = await getImage(params.id);
	if (!image) error(404, 'Kuvaa ei löytynyt');
	return new Response(new Uint8Array(image.data), {
		headers: {
			'content-type': image.contentType,
			'content-length': String(image.data.byteLength),
			'x-content-type-options': 'nosniff',
			// An id never changes content: cache for a year.
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};
