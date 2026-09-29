import { CITIES } from '$lib/server/platform';
import { setEventImage } from '$lib/server/modules/events';
import { FEATURE_MIN_DESCRIPTION } from '$lib/server/modules/featuring';
import { saveImage } from '$lib/server/modules/media';
import { KIND_LABELS, listTermsByKind } from '$lib/server/modules/taxonomy';

/** Options the dashboard event form needs (taxonomy terms, cities). */
export async function eventFormOptions() {
	const terms = await listTermsByKind();
	return {
		terms: {
			category: terms.category,
			age_group: terms.age_group,
			language: terms.language,
			denomination: terms.denomination
		},
		kindLabels: KIND_LABELS as Record<string, string>,
		cities: CITIES.map((c) => c.name),
		featureMinDescription: FEATURE_MIN_DESCRIPTION
	};
}

export const hadFile = (data: FormData) => {
	const file = data.get('image');
	return file instanceof File && file.size > 0;
};

/**
 * Applies the form's image field: a new file replaces the image, "removeImage" removes it,
 * an empty file input (0 bytes) keeps the current one. Returns an error message or null.
 */
export async function applyImageField(
	orgId: string,
	eventId: string,
	data: FormData
): Promise<string | null> {
	const file = data.get('image');
	if (file instanceof File && file.size > 0) {
		const saved = await saveImage(orgId, new Uint8Array(await file.arrayBuffer()));
		if (!saved.ok) return saved.error;
		await setEventImage(orgId, eventId, saved.id);
	} else if (data.get('removeImage') === '1') {
		await setEventImage(orgId, eventId, null);
	}
	return null;
}
