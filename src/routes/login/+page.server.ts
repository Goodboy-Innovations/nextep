import { fail, redirect } from '@sveltejs/kit';
import { authenticate, listProviders } from '$lib/server/modules/identity';
import { safeNext, startSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	not_invited:
		'Tälle tilille ei ole kutsua. Nextep on alpha-vaiheessa: järjestäjät kutsutaan sähköpostiosoitteella.',
	email_unverified:
		'Palveluntarjoaja ei vahvistanut sähköpostiosoitettasi. Kokeile toista kirjautumistapaa tai pyydä ylläpitoa.',
	failed: 'Kirjautuminen epäonnistui. Yritä uudelleen.'
};

export const load: PageServerLoad = ({ locals, url }) => {
	const next = url.searchParams.get('next');
	if (locals.user) redirect(303, safeNext(next));
	const error = url.searchParams.get('error');
	return {
		providers: listProviders().map((p) => ({ id: p.id, label: p.label })),
		next: next ? safeNext(next) : null,
		error: error ? (ERRORS[error] ?? ERRORS.failed) : null
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
