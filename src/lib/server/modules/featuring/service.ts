import { and, eq } from 'drizzle-orm';
import { config, db, sql } from '$lib/server/platform';
import { events } from '../events/schema';
import { organizations } from '../organizations/schema';
import { FEATURE_MIN_DESCRIPTION, PROBLEM_LABELS, qualityProblems, weekStartOf } from './rules';

export const currentWeekStart = (now = new Date()) => weekStartOf(now, config.defaultTimezone);

/** `qualityProblems` as a SQL condition on an `events` row aliased `e`. */
export const frontPageQualitySql = () =>
	sql`(e.image_id is not null and char_length(btrim(e.description)) >= ${FEATURE_MIN_DESCRIPTION}::int)`;

/** Quality problems, plus the one thing organizers can fix that search also requires. */
function problemLabels(event: { status: string; imageId: string | null; description: string }) {
	const labels = qualityProblems(event).map((p) => PROBLEM_LABELS[p]);
	return event.status === 'published' ? labels : ['Julkaise tapahtuma', ...labels];
}

/** For the event editor: whether the event qualifies, and the organization's weekly limit. */
export async function getFrontPageStatus(orgId: string, eventId: string) {
	const [row] = await db
		.select({
			status: events.status,
			imageId: events.imageId,
			description: events.description,
			limit: organizations.frontPageLimit
		})
		.from(events)
		.innerJoin(organizations, eq(organizations.id, events.orgId))
		.where(and(eq(events.id, eventId), eq(events.orgId, orgId)));
	if (!row) return null;
	return { limit: row.limit, problems: problemLabels(row) };
}

/** For the organization's event list: what each event lacks for the front page (empty = ok). */
export async function getOrgQuality(orgId: string): Promise<Map<string, string[]>> {
	const rows = await db
		.select({
			id: events.id,
			status: events.status,
			imageId: events.imageId,
			description: events.description
		})
		.from(events)
		.where(eq(events.orgId, orgId));
	return new Map(rows.map((r) => [r.id, problemLabels(r)]));
}
