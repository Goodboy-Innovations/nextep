import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireOrgRole } from '$lib/server/guards';
import { CITIES, isUuid } from '$lib/server/platform';
import { getInstanceForOrganization, importChurchProfile } from '$lib/server/modules/churchtools';
import {
	answerMembershipRequest,
	listMembers,
	listMembershipRequests,
	updateOrganization
} from '$lib/server/modules/organizations';
import type { Actions, PageServerLoad } from './$types';

const optional = z
	.string()
	.trim()
	.transform((v) => v || null);

const profileSchema = z.object({
	name: z.string().trim().min(2, 'Nimi on liian lyhyt'),
	description: z.string().trim().max(5000),
	businessId: optional,
	email: optional,
	phone: optional,
	website: optional.pipe(z.url('Anna kelvollinen osoite').nullable()),
	streetAddress: optional,
	postalCode: optional,
	city: z.string().trim().min(1),
	lat: optional.transform((v) => (v === null ? null : Number(v))),
	lng: optional.transform((v) => (v === null ? null : Number(v)))
});

export const load: PageServerLoad = async ({ parent, url }) => {
	const { org, role } = await parent();
	const canManage = role === 'admin' || role === 'owner';
	const instance = await getInstanceForOrganization(org.id);
	return {
		/** The church's ChurchTools, if it registered with one. */
		churchtoolsHost: instance?.host ?? null,
		members: await listMembers(org.id),
		requests: canManage ? await listMembershipRequests(org.id) : [],
		cities: CITIES.map((c) => c.name),
		registered: url.searchParams.has('registered')
	};
};

export const actions: Actions = {
	save: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		const values = Object.fromEntries(await request.formData());
		const parsed = profileSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Tarkista tiedot' });
		}
		await updateOrganization(org.id, parsed.data);
		return { saved: true };
	},

	/** Fills the form from the church's ChurchTools. Nothing is saved until "Tallenna". */
	churchtools: async ({ locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		// Only the organization's own instance — never a host from the request.
		const instance = await getInstanceForOrganization(org.id);
		if (!instance) return fail(400, { error: 'Organisaatiolla ei ole ChurchToolsia' });
		try {
			const { name, streetAddress, postalCode, city, lat, lng } = await importChurchProfile(
				instance.host
			);
			return { prefill: { name, streetAddress, postalCode, city, lat, lng } };
		} catch (err) {
			console.error(`[profile] ChurchTools info from ${instance.host} failed`, err);
			return fail(502, { error: 'Tietojen haku ChurchToolsista epäonnistui' });
		}
	},

	approve: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		const data = await request.formData();
		const userId = data.get('userId');
		const role = data.get('role') === 'admin' ? 'admin' : 'editor';
		if (!isUuid(userId) || !(await answerMembershipRequest(org.id, userId, role))) {
			return fail(400, { error: 'Pyyntöä ei löytynyt' });
		}
		return { answered: true };
	},

	decline: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		const userId = (await request.formData()).get('userId');
		if (!isUuid(userId) || !(await answerMembershipRequest(org.id, userId, null))) {
			return fail(400, { error: 'Pyyntöä ei löytynyt' });
		}
		return { answered: true };
	}
};
