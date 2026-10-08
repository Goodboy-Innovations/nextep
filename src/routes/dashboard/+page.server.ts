import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import {
	listOrganizations,
	listOrganizationsForUser,
	listPendingOrganizationsForUser
} from '$lib/server/modules/organizations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const orgs = user.isAdmin
		? (await listOrganizations()).map((o) => ({ ...o, role: 'owner' as const }))
		: await listOrganizationsForUser(user.id);
	const pending = await listPendingOrganizationsForUser(user.id);
	if (orgs.length === 1 && pending.length === 0 && !user.isAdmin) {
		redirect(303, `/dashboard/${orgs[0].slug}`);
	}
	return { orgs, pending: pending.map((o) => ({ id: o.id, name: o.name })) };
};
