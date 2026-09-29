import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { listOrganizations, listOrganizationsForUser } from '$lib/server/modules/organizations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const orgs = user.isAdmin
		? (await listOrganizations()).map((o) => ({ ...o, role: 'owner' as const }))
		: await listOrganizationsForUser(user.id);
	if (orgs.length === 1 && !user.isAdmin) redirect(303, `/dashboard/${orgs[0].slug}`);
	return { orgs };
};
