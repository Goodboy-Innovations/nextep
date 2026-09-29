import { requireOrgRole } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, params }) => {
	const { org, role } = await requireOrgRole(locals, url, params.org);
	return { org, role };
};
