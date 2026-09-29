# discovery

The seeker-facing ranking — Nextep's core idea. Read-only: it owns no tables.

- `search.ts` — one SQL query: hard filters → nearest occurrence per event (recurring events collapse to one card) → soft score. Formula in `docs/proposal.md` §5.3.
- `config.ts` — weights and falloffs. Change them here and check the result order in `ranking.test.ts`.
- `tiered.ts` — the front page search: front-page events (see `featuring`) matching the filters first (the week comes from the date filter), then all events if none match, then featured suggestions ranked by preferences only. Non-featured matches are counted and listed on request (`?muut=1`).
- `prefs.ts` — seeker preferences in the `nextep_prefs` cookie (coarse location, distance cap, preferred terms), overridable by URL parameters. No accounts, no identifiers.

**Filters** (text, place + distance, date) narrow the results. **Preferences** (taxonomy terms) are a **soft boost**, never a filter: an event without the preferred tags still shows, just lower. The UI keeps them apart: filters are pills in the search bar, preferences have their own row and panel.
