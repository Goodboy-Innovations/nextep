// Route-level access checks shared by the dashboard and admin areas.

import { error, redirect } from '@sveltejs/kit';
import {
	getMemberRole,
	getOrganizationBySlug,
	roleAtLeast,
	type OrgRole
} from '$lib/server/modules/organizations';

export function requireUser(locals: App.Locals, url: URL) {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	return locals.user;
}

export function requireAdmin(locals: App.Locals, url: URL) {
	const user = requireUser(locals, url);
	if (!user.isAdmin) error(403, 'Vain ylläpitäjille');
	return user;
}

/** Loads the organization from the URL and checks the user's role in it. Platform admins pass. */
export async function requireOrgRole(
	locals: App.Locals,
	url: URL,
	orgSlug: string,
	minimum: OrgRole = 'editor'
) {
	const user = requireUser(locals, url);
	const org = await getOrganizationBySlug(orgSlug);
	if (!org) error(404, 'Organisaatiota ei löytynyt');
	const role = await getMemberRole(user.id, org.id);
	if (!user.isAdmin && !roleAtLeast(role, minimum)) error(403, 'Ei oikeuksia');
	return { user, org, role: user.isAdmin ? ('owner' as const) : role! };
}
