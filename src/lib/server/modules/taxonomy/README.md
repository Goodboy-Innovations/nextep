# taxonomy

Tags that events carry and seekers filter by: `category`, `age_group`, `language`, `denomination`.

Terms are data, not code: rows in `taxonomy_terms` with translated `labels` (`{ fi, en, … }`). Nothing else should hard-code a term. The final value lists are still open (see `docs/idea.md`); `scripts/seed.ts` loads placeholders.
