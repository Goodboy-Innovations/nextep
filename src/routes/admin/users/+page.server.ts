import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { isUuid } from '$lib/server/platform';
import {
	MIN_PASSWORD_LENGTH,
	createUser,
	findUserByEmail,
	listUsers,
	setPassword
} from '$lib/server/modules/identity';
import {
	ORG_ROLES,
	addMember,
	listOrganizations,
	type OrgRole
} from '$lib/server/modules/organizations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	users: await listUsers(),
	orgs: await listOrganizations(),
	roles: ORG_ROLES
});

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const name = String(data.get('name') ?? '').trim();
		const password = String(data.get('password') ?? '');
		if (!email.includes('@') || !name) return fail(400, { error: 'Anna nimi ja sähköposti' });
		if (password && password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Salasanan pitää olla vähintään ${MIN_PASSWORD_LENGTH} merkkiä` });
		}
		if (await findUserByEmail(email)) return fail(400, { error: 'Sähköposti on jo käytössä' });
		await createUser({
			email,
			name,
			password: password || null,
			isAdmin: data.get('isAdmin') === 'on'
		});
		return {
			message: password
				? `${email} luotu. Hän voi kirjautua salasanalla tai Googlella/Microsoftilla.`
				: `${email} kutsuttu. Hän voi kirjautua palvelulla, joka vahvistaa tämän osoitteen.`
		};
	},

	password: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const userId = data.get('userId');
		const password = String(data.get('password') ?? '');
		if (!isUuid(userId)) return fail(400, { error: 'Valitse käyttäjä' });
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Salasanan pitää olla vähintään ${MIN_PASSWORD_LENGTH} merkkiä` });
		}
		await setPassword(userId, password);
		return { message: 'Salasana asetettu' };
	},

	member: async ({ request, locals, url }) => {
		requireAdmin(locals, url);
		const data = await request.formData();
		const user = await findUserByEmail(String(data.get('email') ?? ''));
		const role = String(data.get('role')) as OrgRole;
		if (!user) return fail(400, { error: 'Käyttäjää ei löytynyt' });
		if (!ORG_ROLES.includes(role)) return fail(400, { error: 'Tuntematon rooli' });
		const orgId = String(data.get('orgId'));
		if (!isUuid(orgId)) return fail(400, { error: 'Valitse organisaatio' });
		await addMember(orgId, user.id, role);
		return { message: `${user.email} lisätty organisaatioon` };
	}
};
