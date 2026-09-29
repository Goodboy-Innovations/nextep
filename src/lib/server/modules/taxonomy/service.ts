import { asc, inArray } from 'drizzle-orm';
import { db } from '$lib/server/platform';
import { TAXONOMY_KINDS, taxonomyTerms, type TaxonomyKind } from './schema';

export interface Term {
	id: string;
	kind: TaxonomyKind;
	slug: string;
	label: string;
}

export const KIND_LABELS: Record<TaxonomyKind, string> = {
	category: 'Tyyppi',
	age_group: 'Ikäryhmä',
	language: 'Kieli',
	denomination: 'Kirkkokunta'
};

const toTerm = (row: typeof taxonomyTerms.$inferSelect, locale: string): Term => ({
	id: row.id,
	kind: row.kind,
	slug: row.slug,
	label: row.labels[locale] ?? row.labels.fi ?? row.slug
});

export async function listTerms(locale = 'fi'): Promise<Term[]> {
	const rows = await db
		.select()
		.from(taxonomyTerms)
		.orderBy(asc(taxonomyTerms.kind), asc(taxonomyTerms.sort), asc(taxonomyTerms.slug));
	return rows.map((r) => toTerm(r, locale));
}

/** All terms grouped by kind, in display order. */
export async function listTermsByKind(locale = 'fi'): Promise<Record<TaxonomyKind, Term[]>> {
	const grouped = Object.fromEntries(TAXONOMY_KINDS.map((k) => [k, [] as Term[]])) as Record<
		TaxonomyKind,
		Term[]
	>;
	for (const term of await listTerms(locale)) grouped[term.kind].push(term);
	return grouped;
}

export async function getTermsByIds(ids: string[], locale = 'fi'): Promise<Term[]> {
	if (ids.length === 0) return [];
	const rows = await db.select().from(taxonomyTerms).where(inArray(taxonomyTerms.id, ids));
	return rows.map((r) => toTerm(r, locale));
}

export async function upsertTerm(input: {
	kind: TaxonomyKind;
	slug: string;
	labels: Record<string, string>;
	sort?: number;
}): Promise<void> {
	await db
		.insert(taxonomyTerms)
		.values({ ...input, sort: input.sort ?? 0 })
		.onConflictDoUpdate({
			target: [taxonomyTerms.kind, taxonomyTerms.slug],
			set: { labels: input.labels, sort: input.sort ?? 0 }
		});
}
