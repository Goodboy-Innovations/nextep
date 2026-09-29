# featuring

The front page ("nostot"). It shows only a week's best events, so the full calendars of every church don't crowd it; everything else is found through search. Owns no tables.

- **No manual featuring.** Every event that meets the quality bar (`rules.ts`: an image and a description of at least 200 characters) qualifies automatically. The bar lives in `qualityProblems` and, for queries, in `frontPageQualitySql`: change both together.
- **Per-organization limit:** at most `organizations.front_page_limit` events of one organization on the front page in the same week (default 5, admins can set 0–10; 0 takes the organization off the front page).
- **Which ones:** decided per seeker at query time, in `discovery/search.ts` — among an organization's qualifying events that take place that week, the best-scoring ones for this seeker (distance, time, preferences, text). Two seekers may see a different selection from the same organization.
- **Week:** Monday–Sunday, Helsinki time. The date filter picks the week; without one it is the current week.
- Dashboard helpers: `getFrontPageStatus` (event editor) and `getOrgQuality` (event list) show organizers what is missing.
