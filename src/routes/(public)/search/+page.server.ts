import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Search moved to the front page; keep old links and bookmarks working.
export const load: PageServerLoad = ({ url }) => redirect(308, `/${url.search}`);
