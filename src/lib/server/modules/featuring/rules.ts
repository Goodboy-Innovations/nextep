// Pure rules for the front page (unit-tested in rules.test.ts).
//
// There is no manual featuring: every event that meets the quality bar qualifies, and each
// organization can have at most `organizations.front_page_limit` events on the front page
// in the same week (the ones ranking best for the seeker; see discovery/search.ts).

import { formatInTimeZone } from 'date-fns-tz';

/** Minimum description length for the front page ("hieman pidempi kuvaus"). */
export const FEATURE_MIN_DESCRIPTION = 200;
/** Upper limit an admin can give an organization. */
export const FRONT_PAGE_MAX_LIMIT = 10;

const DAY_MS = 86_400_000;

/** Monday (yyyy-mm-dd) of the week containing `instant`, in `tz`. */
export function weekStartOf(instant: Date, tz: string): string {
	const local = formatInTimeZone(instant, tz, 'yyyy-MM-dd');
	const isoDay = Number(formatInTimeZone(instant, tz, 'i')); // 1 = Monday … 7 = Sunday
	return addDays(local, -(isoDay - 1));
}

/** Monday (yyyy-mm-dd) of the week containing a local date. */
export function weekStartOfDate(localDate: string): string {
	const [y, m, d] = localDate.split('-').map(Number);
	const isoDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
	return addDays(localDate, -(isoDay - 1));
}

/** Adds days to a local date string (calendar arithmetic, DST-independent). */
export function addDays(localDate: string, days: number): string {
	const [y, m, d] = localDate.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface QualityCandidate {
	imageId: string | null;
	description: string;
}

export type QualityProblem = 'no_image' | 'short_description';

/**
 * What keeps an event off the front page, or an empty list if it qualifies. Mirrored in SQL
 * by `frontPageQualitySql`: change both together.
 */
export function qualityProblems(event: QualityCandidate): QualityProblem[] {
	const problems: QualityProblem[] = [];
	if (!event.imageId) problems.push('no_image');
	if (event.description.trim().length < FEATURE_MIN_DESCRIPTION) problems.push('short_description');
	return problems;
}

export const PROBLEM_LABELS: Record<QualityProblem, string> = {
	no_image: 'Lisää kuva',
	short_description: `Kirjoita vähintään ${FEATURE_MIN_DESCRIPTION} merkin kuvaus`
};
