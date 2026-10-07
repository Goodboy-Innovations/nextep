import { requireUser } from '$lib/server/guards';
import { hasPassword } from '$lib/server/modules/identity';
import { instanceSubdomain, listLinkedInstances } from '$lib/server/modules/churchtools';
import { CHURCHTOOLS_ERRORS } from '$lib/server/pages/churchtools';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, url);
	const error = url.searchParams.get('error');
	const [password, churchTools] = await Promise.all([
		hasPassword(user.id),
		listLinkedInstances(user.id)
	]);
	return {
		password,
		churchTools,
		/** After signing in to connect ChurchTools: ?connect=<subdomain> prefills and highlights it. */
		connect: instanceSubdomain(
			url.searchParams.get('connect') ?? url.searchParams.get('instance') ?? ''
		),
		connected: url.searchParams.get('connected'),
		error: error ? (CHURCHTOOLS_ERRORS[error] ?? 'ChurchToolsin liittäminen epäonnistui.') : null,
		/** Offer registering the church instead. */
		unknownInstance: error === 'unknown_instance'
	};
};
