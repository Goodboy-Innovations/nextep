import { fail } from '@sveltejs/kit';
import { config } from '$lib/server/platform';
import {
	CHURCHTOOLS_CALLBACK_PATH,
	instanceSubdomain,
	normalizeInstanceHost
} from '$lib/server/modules/churchtools';
import { pendingRegistration, startChurchToolsFlow } from '$lib/server/pages/churchtools';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	registered:
		'Tämä ChurchTools rekisteröitiin juuri toiseen organisaatioon. Kirjaudu sisään ChurchToolsilla.',
	client_missing:
		'ChurchTools ei hyväksy tätä asiakkaan tunnusta. Tarkista, että tunnus on kopioitu kokonaan ja että asiakkaan Ohjaus-URI on alla olevan ohjeen mukainen.',
	secret_wrong:
		'ChurchTools ei hyväksy asiakkaan salaisuutta. Tarkista, että kopioit sen kokonaan. Jos salaisuus ei ole enää tallessa, luo ChurchToolsiin uusi asiakas.',
	no_instance:
		'Tällä osoitteella ei löytynyt ChurchToolsia. Tarkista seurakuntasi ChurchTools-osoite.',
	failed:
		'ChurchTools ei hyväksynyt kirjautumista. Tarkista osoite, asiakkaan tunnus, salaisuus ja Ohjaus-URI ja yritä uudelleen.'
};

export const load: PageServerLoad = ({ url, locals, cookies }) => {
	const error = url.searchParams.get('error');
	// Back from signing in to an existing account: the client the person already entered.
	const pending = locals.user ? pendingRegistration(cookies) : null;
	return {
		instance: pending?.instance ?? instanceSubdomain(url.searchParams.get('instance') ?? ''),
		pending: pending && { clientId: pending.clientId, clientSecret: pending.clientSecret },
		redirectURI: `${config.origin}${CHURCHTOOLS_CALLBACK_PATH}`,
		signedInAs: locals.user?.email ?? null,
		error: error ? (ERRORS[error] ?? ERRORS.failed) : null
	};
};

/**
 * Registers a church. Registering an already registered church again just replaces its client
 * (e.g. after it was recreated in ChurchTools); its organization stays as it is.
 */
export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const values = {
			instance: String(data.get('instance') ?? '').trim(),
			clientId: String(data.get('clientId') ?? '').trim(),
			// Echoed back on errors: ChurchTools shows it only once.
			clientSecret: String(data.get('clientSecret') ?? '').trim()
		};
		const invalid = (error: string) => fail(400, { ...values, error });
		const host = normalizeInstanceHost(values.instance);
		if (!host) return invalid('Kirjoita seurakuntasi ChurchTools-osoitteen alkuosa, esim. utopia.');
		values.instance = instanceSubdomain(host);
		if (!/^[\w-]{8,200}$/.test(values.clientId)) return invalid('Tarkista asiakkaan tunnus.');
		if (!/^\S{8,500}$/.test(values.clientSecret)) return invalid('Tarkista asiakkaan salaisuus.');

		const problem = await startChurchToolsFlow(
			cookies,
			{ host, clientId: values.clientId, clientSecret: values.clientSecret },
			'/dashboard',
			{ clientId: values.clientId, clientSecret: values.clientSecret }
		);
		return invalid(ERRORS[problem]);
	}
};
