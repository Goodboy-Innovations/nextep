import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import {
	listInstances,
	normalizeInstanceHost,
	removeUnregisteredInstance
} from '$lib/server/modules/churchtools';
import { listOrganizations } from '$lib/server/modules/organizations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [instances, orgs] = await Promise.all([listInstances(), listOrganizations()]);
	const byId = new Map(orgs.map((o) => [o.id, { name: o.name, slug: o.slug }]));
	return {
		instances: instances.map((i) => ({ ...i, org: i.orgId ? (byId.get(i.orgId) ?? null) : null }))
	};
};

export const actions: Actions = {
	/** Only instances no church registered; a registered church's link stays. */
	remove: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const host = normalizeInstanceHost(String(data.get('host') ?? ''));
		if (!host || !(await removeUnregisteredInstance(host))) {
			return fail(400, { error: 'Vain organisaatioon liittämättömän ChurchToolsin voi poistaa' });
		}
		return { message: `${host} poistettu` };
	}
};
