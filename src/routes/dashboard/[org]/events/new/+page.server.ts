import { fail, redirect } from '@sveltejs/kit';
import { requireOrgRole } from '$lib/server/guards';
import { createEvent, parseEventForm } from '$lib/server/modules/events';
import { applyImageField, eventFormOptions, hadFile } from '$lib/server/pages/event-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();
	return {
		options: await eventFormOptions(),
		values: {
			title: '',
			extract: '',
			description: '',
			date: '',
			startTime: '18:00',
			endTime: '20:00',
			recurrence: { kind: 'none' as const },
			venueName: '',
			streetAddress: org.streetAddress ?? '',
			city: org.city,
			lat: null,
			lng: null,
			url: '',
			termIds: []
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url, params }) => {
		const { org } = await requireOrgRole(locals, url, params.org);
		const data = await request.formData();
		const parsed = parseEventForm(data);
		if (!parsed.ok) {
			// Browsers drop the chosen file when the form is re-rendered.
			const errors = hadFile(data)
				? { ...parsed.errors, image: 'Valitse kuva uudelleen' }
				: parsed.errors;
			return fail(400, { errors, values: parsed.values });
		}
		const status = data.get('publish') === '1' ? 'published' : 'draft';
		const id = await createEvent(org.id, parsed.input, status);
		const imageError = await applyImageField(org.id, id, data);
		const query = imageError ? `imageError=${encodeURIComponent(imageError)}` : 'saved=1';
		redirect(303, `/dashboard/${org.slug}/events/${id}?${query}`);
	}
};
