import { error, fail, redirect } from '@sveltejs/kit';
import { requireOrgRole } from '$lib/server/guards';
import { isUuid } from '$lib/server/platform';
import {
	EVENT_STATUSES,
	deleteEvent,
	getEventForEdit,
	parseEventForm,
	setEventStatus,
	setOccurrenceCancelled,
	updateEvent,
	type EventStatus
} from '$lib/server/modules/events';
import { getFrontPageStatus } from '$lib/server/modules/featuring';
import { imageUrl } from '$lib/server/modules/media';
import { applyImageField, eventFormOptions, hadFile } from '$lib/server/pages/event-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { org } = await parent();
	const data = isUuid(params.id) ? await getEventForEdit(org.id, params.id) : null;
	if (!data) error(404, 'Tapahtumaa ei löytynyt');
	return {
		...data,
		image: imageUrl(data.event.imageId),
		frontPage: await getFrontPageStatus(org.id, params.id),
		options: await eventFormOptions()
	};
};

export const actions: Actions = {
	save: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org);
		const data = await request.formData();
		const parsed = parseEventForm(data);
		if (!parsed.ok) {
			const errors = hadFile(data)
				? { ...parsed.errors, image: 'Valitse kuva uudelleen' }
				: parsed.errors;
			return fail(400, { errors, values: parsed.values });
		}
		await updateEvent(org.id, params.id, parsed.input);
		const imageError = await applyImageField(org.id, params.id, data);
		// The other fields were saved; the form re-renders from the database.
		if (imageError) return fail(400, { errors: { image: imageError } });
		return { saved: true };
	},

	status: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org);
		const status = String((await request.formData()).get('status'));
		if (!EVENT_STATUSES.includes(status as EventStatus)) return fail(400);
		await setEventStatus(org.id, params.id, status as EventStatus);
		return { saved: true };
	},

	occurrence: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org);
		const data = await request.formData();
		const date = String(data.get('date'));
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400);
		await setOccurrenceCancelled(org.id, params.id, date, data.get('cancelled') === '1');
		return { saved: true };
	},

	delete: async ({ locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org, 'admin');
		await deleteEvent(org.id, params.id);
		redirect(303, `/dashboard/${org.slug}`);
	}
};
