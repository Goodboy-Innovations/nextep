import { listOrgEvents } from '$lib/server/modules/events';
import { getOrgQuality } from '$lib/server/modules/featuring';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();
	const [events, quality] = await Promise.all([listOrgEvents(org.id), getOrgQuality(org.id)]);
	return {
		events: events.map((e) => ({ ...e, frontPageProblems: quality.get(e.id) ?? [] }))
	};
};
