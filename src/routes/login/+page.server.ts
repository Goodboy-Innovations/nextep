import { fail, redirect } from '@sveltejs/kit';
import { authenticate } from '$lib/server/modules/identity';
import { instanceSubdomain } from '$lib/server/modules/churchtools';
import { CHURCHTOOLS_ERRORS, rememberedInstance } from '$lib/server/pages/churchtools';
import { safeNext, startSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	...CHURCHTOOLS_ERRORS,
	failed: 'Kirjautuminen epäonnistui. Yritä uudelleen.'
};

export const load: PageServerLoad = ({ locals, url, cookies }) => {
	const next = url.searchParams.get('next');
	if (locals.user) redirect(303, safeNext(next));
	const error = url.searchParams.get('error');
	return {
		instance:
			instanceSubdomain(url.searchParams.get('instance') ?? '') || rememberedInstance(cookies),
		next: next ? safeNext(next) : null,
		error: error ? (ERRORS[error] ?? ERRORS.failed) : null,
		/** Offer registering the church instead. */
		unknownInstance: error === 'unknown_instance'
	};
};

export const actions: Actions = {
	/** Email + password sign-in. */
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');
		const user = email && password ? await authenticate(email, password) : null;
		if (!user) return fail(400, { email, error: 'Väärä sähköposti tai salasana' });

		await startSession(cookies, user.id);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
