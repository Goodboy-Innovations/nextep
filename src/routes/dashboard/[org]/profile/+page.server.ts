import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireOrgRole } from '$lib/server/guards';
import { CITIES } from '$lib/server/platform';
import { listMembers, updateOrganization } from '$lib/server/modules/organizations';
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

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();
	return { members: await listMembers(org.id), cities: CITIES.map((c) => c.name) };
};

export const actions: Actions = {
	default: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		const values = Object.fromEntries(await request.formData());
		const parsed = profileSchema.safeParse(values);
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Tarkista tiedot' });
		}
		await updateOrganization(org.id, parsed.data);
		return { saved: true };
	}
};
