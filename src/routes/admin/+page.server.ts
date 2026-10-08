import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { CITIES, isUuid } from '$lib/server/platform';
import {
	ORG_STATUSES,
	createOrganization,
	listOrganizations,
	setFrontPageLimit,
	setOrganizationStatus,
	type OrgStatus
} from '$lib/server/modules/organizations';
import { FRONT_PAGE_MAX_LIMIT } from '$lib/server/modules/featuring';
import { listUsers } from '$lib/server/modules/identity';
import { listInstances } from '$lib/server/modules/churchtools';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [orgs, users, instances] = await Promise.all([
		listOrganizations(),
		listUsers(),
		listInstances()
	]);
	const hosts = new Map(instances.map((i) => [i.orgId, i.host]));
	const emails = new Map(users.map((u) => [u.id, `${u.name} (${u.email})`]));
	// Churches waiting for review first.
	const order = (status: OrgStatus) => (status === 'in_review' ? 0 : 1);
	return {
		orgs: orgs
			.map((o) => ({
				...o,
				churchtoolsHost: hosts.get(o.id) ?? null,
				registeredBy: o.registeredBy ? (emails.get(o.registeredBy) ?? null) : null
			}))
			.sort((a, b) => order(a.status) - order(b.status)),
		statuses: ORG_STATUSES,
		cities: CITIES.map((c) => c.name),
		maxFrontPage: FRONT_PAGE_MAX_LIMIT
	};
};

export const actions: Actions = {
	frontPage: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const id = String(data.get('id'));
		const limit = Number(data.get('limit'));
		if (!isUuid(id) || !Number.isInteger(limit) || limit < 0 || limit > FRONT_PAGE_MAX_LIMIT) {
			return fail(400, {
				error: `Etusivulla voi olla 0–${FRONT_PAGE_MAX_LIMIT} tapahtumaa viikossa`
			});
		}
		await setFrontPageLimit(id, limit);
		return {};
	},

	create: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const city = String(data.get('city') ?? '');
		if (name.length < 2) return fail(400, { error: 'Anna organisaation nimi' });
		const org = await createOrganization({ name, city, status: 'verified' });
		return { created: org.name };
	},

	status: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const status = String(data.get('status'));
		const id = String(data.get('id'));
		if (!ORG_STATUSES.includes(status as OrgStatus) || !isUuid(id)) return fail(400);
		await setOrganizationStatus(id, status as OrgStatus);
		return {};
	}
};
