import { integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

export const TAXONOMY_KINDS = ['category', 'age_group', 'language', 'denomination'] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export const taxonomyTerms = pgTable(
	'taxonomy_terms',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		kind: text('kind', { enum: TAXONOMY_KINDS }).notNull(),
		slug: text('slug').notNull(),
		/** Translated labels, e.g. { "fi": "Nuoret", "en": "Youth" }. */
		labels: jsonb('labels').$type<Record<string, string>>().notNull(),
		sort: integer('sort').notNull().default(0)
	},
	(t) => [unique().on(t.kind, t.slug)]
);
