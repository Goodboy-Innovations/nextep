# Nextep — Technical Proposal (v3, fresh start)

> Companion to [`idea.md`](./idea.md). `idea.md` says **what** Nextep is. This document says **how** to build it again: the concept worked through further, plus a high-level technical structure.
>
> Hard requirements: **PostgreSQL** and **server-rendered SvelteKit**. Guiding values: **modularity** (many contributors working in parallel without stepping on each other) and **simplicity** (few moving parts, boring technology).

---

## 1. Principles

1. **One app, one database.** A single SvelteKit application backed by a single PostgreSQL database. There are no microservices, no separate API server and no separate dashboard app.
2. **Postgres does it unless proven otherwise.** Search, geo queries, job queue, analytics counters and sessions all live in Postgres. **Every additional service has to justify itself against "can Postgres do this well enough?"**, and the justification is written down as an ADR (§8).
3. **Modules own their slice.** Each domain (events, organizations, discovery…) is a folder with a clear public entry point and its own tables, so a contributor can usually work inside one module without understanding the rest. This is a guiding principle, not a law (see §4.2).
4. **Routes are thin.** Pages and form actions validate input, call a module function and render. Business logic never lives in `+page.server.ts`.
5. **SSR first, progressive enhancement second.** Every public page renders fully on the server, which matters for SEO. Forms work without JavaScript through SvelteKit form actions, and JS makes them nicer.
6. **Design the hard parts deliberately.** Ranking and recurrence are the product's two real problems. Each gets its own module, spec and tests. Everything else stays plain CRUD.
7. **Privacy by default.** Seekers are anonymous. No third-party trackers, and GDPR-friendly without a consent banner.

---

## 2. The concept, worked through

This section takes each open question from `idea.md` and gives either a **recommendation** or marks it **🟡 Owner decides** (the technical design keeps these open, but a person has to settle them).

### 2.1 MVP scope

**Recommendation:** launch **discovery and a minimal org dashboard together**, with **invite-only onboarding** instead of self-serve registration.

- Discovery with no content behind it is worthless, and v1 already showed that concierge onboarding works.
- The dashboard is where the founding team (and later the orgs) enter data, so building it early doesn't waste effort.
- Self-serve registration and the review queue follow in phase 2. The data model supports them from day one.

### 2.2 Seekers: anonymous, but server-aware

**Recommendation:** keep seekers **account-free**. One change from v1 is required, though.

> v1 kept preferences in client-side storage. With server-side rendering, the server has to know location and preferences **at render time**, and it can't read `localStorage`. v3 keeps them in a **first-party cookie** (coarse location rounded to about 1 km, plus preference slugs) and mirrors them in **URL query params** so filtered views stay shareable and indexable.

- The cookie holds no identifier and is never stored server-side, so it needs no consent banner. (Get this confirmed legally before launch, but the design aims for it.)
- Without location, ranking falls back to time, preferences and text. The user can also pick a city instead of granting GPS access.
- "Remind me" or "save" becomes **Add to calendar (.ics)**, which needs no account. Optional accounts can come later if they're ever needed.

### 2.3 Events follow the iCalendar standard (RFC 5545)

The event model **is** the iCalendar `VEVENT` model rather than a custom format. Every calendar system already speaks it: Google Calendar, Outlook, Apple Calendar and most church calendar tools. That makes syncing, importing and exporting a matter of mapping fields, not translating between concepts. It also removes v1's recurrence complexity, because iCalendar has already solved it.

| iCalendar concept                      | Nextep                                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UID`                                  | Stable global event ID, kept across edits and syncs                                                                                                                          |
| `DTSTART;TZID=…` + `DURATION`/`DTEND`  | Local wall-clock start plus IANA timezone (e.g. `Europe/Helsinki`), so "every Sunday at 11:00" stays 11:00 across DST changes                                                |
| `RRULE`                                | Stored as a standard RRULE string. The dashboard UI offers a simple subset (weekly/monthly, weekdays, every N weeks, until date), but imported events may use the full rule. |
| `RECURRENCE-ID`                        | An override of a single occurrence (changed time, place or description)                                                                                                      |
| `EXDATE` / `STATUS:CANCELLED`          | A cancelled single occurrence                                                                                                                                                |
| `SEQUENCE`, `LAST-MODIFIED`            | Increment on every edit, so subscribed calendars pick up the changes                                                                                                         |
| `CATEGORIES`, `LOCATION`, `GEO`, `URL` | Mapped to taxonomy terms, address and coordinates, and the event page URL                                                                                                    |

Rules on top of the standard:

- **Every event is a series.** A one-off event has no RRULE and exactly one occurrence, so there's a single code path.
- Rules are expanded with a maintained RFC 5545 library, not hand-written code. Occurrences are **materialized** into a table for a rolling window (about 6 months), on save and by a nightly job, so the ranking query stays plain SQL.
- **Edit one occurrence** creates an override (`RECURRENCE-ID`). **Edit series** changes the master event and regenerates occurrences that have no override. If a rule change means an override no longer lands on a generated date, the override is **dropped** and the editor is shown what was removed before confirming.
- **"This and all following"** is done the way Google Calendar does it: the old series gets an `UNTIL` date and a new series starts. It's an explicit action in the UI, not hidden splitting logic.

### 2.4 Calendar sync

Because events are standard iCalendar, sync becomes a core feature instead of a later integration:

- **Export (phase 1):** a subscribable ICS feed per organization and per filtered search, plus a `.ics` download per event. Google, Apple and Outlook all subscribe to these natively.
- **Import (phase 2):** an org pastes the ICS URL of the calendar it already maintains (Google Calendar's "secret address in iCal format", an Outlook published calendar, or a parish calendar system). A worker job polls it and upserts by `UID`. For many churches this means **no double entry at all**: they keep using their existing calendar and Nextep stays in sync.
- **Imported events are owned by their source.** Standard fields (time, title, description, location) are read-only in the dashboard because edits happen in the source calendar. Nextep-only fields (taxonomy tags, image, extract) stay editable and are kept across syncs.
- **Two-way sync through provider APIs** (such as Google Calendar API write access) is left for later. ICS covers the common case without OAuth or provider-specific code.

### 2.5 Ranking (core IP)

Ranking stays a **soft-scored blend** (see §5.3 for the formula). New in v3:

- The weights live in a config file and are covered by **golden tests**: fixed fixture events with fixed queries must produce a known order. Anyone tuning weights can see immediately what changed.
- Recurring events collapse to **the occurrence closest to the user's target date**, not just "the next one".

### 2.6 SEO: the org-facing pitch, done properly

- Stable, readable URLs:
  - `/o/{org-slug}` for an organization
  - `/e/{org-slug}/{event-slug}` for an event
  - `/e/{org-slug}/{event-slug}/{yyyy-mm-dd}` for one occurrence
- **schema.org `Event` JSON-LD** on every event page. This is what makes events eligible for Google's event listings, and it's cheap to do.
- Sitemap generated from the database, canonical URLs and `hreflang` for language versions.

### 2.7 Towards "phase 3" cheaply: Nextep as the source of truth

Together with the ICS feed (§2.4), an **embeddable calendar widget** (iframe or small script) for the church's own website would let a church **stop maintaining a calendar elsewhere**. The widget also produces backlinks, which helps SEO. It's a small, self-contained module and a good first task for a new contributor, and it tests the "replace your website" idea before any heavy integration work.

### 2.8 Cold start / content sourcing

1. Concierge entry by the team, which the dashboard supports from day one.
2. **ICS import** (phase 2, §2.4). Probably the fastest way to reach content density, because many churches already keep a calendar somewhere.
3. Org self-serve (phase 2).

Scraping Facebook is explicitly out of scope because it's fragile and against their terms of service.

### 2.9 Analytics for orgs

v1 never delivered org statistics. v3 builds them first-party:

- Count **views** per event page with a small first-party beacon request, filtering bots by user-agent. A beacon is used instead of counting during SSR so the pages can still be CDN-cached (see §7).
- Count **outbound clicks** (registration link, map, website) through a `/go/{id}` redirect endpoint.
- Count **calendar adds** (.ics downloads) and **shares**.
- Store only daily aggregated counters. No personal data, no third-party analytics.
- Orgs see "your event was seen N times, M people added it to their calendar". That's the metric they actually care about.

### 2.10 Trust & eligibility

**Recommendation (process):** organization status goes `draft → in_review → verified → suspended`. An application includes:

- a written statement-of-faith acceptance (checkbox plus the stored policy version),
- the Y-tunnus (Finnish business ID) or another identifier,
- a contact person.

A platform admin reviews each application, and every decision goes to an audit log.

🟡 **Owner decides:** the exact wording of the eligibility policy, and who reviews and how quickly.

### 2.11 Taxonomies

Taxonomies are **data, not code**. Denominations, categories, age groups and languages are rows with translated labels, editable by platform admins. Code never hard-codes a value.

🟡 **Owner decides:** the actual value lists. Seed data uses the v1 placeholders (age groups: children, youth, young adults, adults; languages FI, EN, SV, RU, ES, AR, DE).

### 2.12 Pricing and licence

**Decided:** Nextep is **free** for churches and seekers. Money is deliberately left for future ideas, so the system has **no billing, plans or subscription code**.

**Decided:** the code is public under the **MIT licence** ([`LICENSE`](../LICENSE)). Anyone can read, use, change and self-host it, including for their own service. Contributions are accepted under the same licence, so no CLA is needed.

### 2.13 Remaining questions

| Question           | Recommendation                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Geographic scope   | Launch in Finland. Store all times with a timezone, all text i18n-ready and all locations as geo points, so expanding doesn't require a rewrite. |
| UI languages       | Finnish first, then English and Swedish. Event content is in whatever language the org writes it, tagged with the `language` taxonomy.           |
| Notifications      | Phase 3 at the earliest. ICS subscriptions cover most of the need for free.                                                                      |
| Articles / content | Phase 3. A built-in module, not an external CMS: markdown articles that can embed events.                                                        |

---

## 3. Shape of the system

```
                ┌──────────────────────────────────────────────┐
  Browser  ───▶ │           SvelteKit app (adapter-node)       │
                │                                              │
                │  (public)        /  /o/…  /e/…                │  ← seekers, SSR, SEO
                │  (dashboard)     /dashboard/…                │  ← org members
                │  (admin)         /admin/…                    │  ← platform admins
                │  endpoints       /go/…  *.ics  sitemap.xml   │
                │                                              │
                │  src/lib/server/modules/*  (domain logic)    │
                │  background worker (same codebase, 2nd proc) │
                └───────────────┬───────────────┬──────────────┘
                                │               │
                     ┌──────────▼─────┐   ┌─────▼──────────────┐
                     │ PostgreSQL     │   │ Object storage     │
                     │ + PostGIS      │   │ (S3-compatible)    │
                     │ + pg_trgm      │   │ images only        │
                     └────────────────┘   └────────────────────┘
                     SMTP provider for email (invites, login links)
```

**Why not three repos like v1** (front / api / dashboard): one change, such as adding a field to events, used to touch three codebases, three deploys and a hand-maintained API contract between them. With SvelteKit, server code and pages share types directly. The three surfaces become **route groups** in one app and share modules, auth and the design system. If a public API is ever needed (for a mobile app), it's a thin `/api/v1/*` set of `+server.ts` endpoints calling the **same module functions**.

**The only infrastructure pieces:**

| Piece                                                                         | Why it exists                                                                                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL (+ PostGIS, pg_trgm, unaccent)                                     | All data, search, geo, sessions, job queue                                                                                        |
| Object storage (S3-compatible: MinIO locally; Hetzner, R2 etc. in production) | Images don't belong in the database                                                                                               |
| SMTP                                                                          | Login links, invites, review notifications                                                                                        |
| Worker process                                                                | Recurrence materialization, image resizing, stats rollup, emails. It's the same repo and image, started with a different command. |

---

## 4. Modules (the centerpiece)

### 4.1 Folder layout

SvelteKit only guards `$lib/server/**` and `*.server.*` files from being bundled into client code. A `server/` folder nested anywhere else is **not** protected. So domain logic lives under `$lib/server/modules/`, and UI lives separately:

```
src/
  lib/
    server/
      modules/
        events/            ← one module (see 4.2)
        organizations/
        discovery/
        …
      platform/            ← shared kernel: db, config, mailer, jobs, storage, errors, logger
    components/
      ui/                  ← design-system primitives (Button, Field, Card, Map…)
      events/              ← UI components belonging to a module
      organizations/
      …
    i18n/                  ← message files
  routes/
    (public)/ …
    (dashboard)/dashboard/ …
    (admin)/admin/ …
  worker.ts                ← background job entry point
```

> **Worker note:** `$lib` aliases and `$env/*` only resolve inside Vite/SvelteKit. To keep module code runnable from the worker, modules read environment variables **only through `platform/config`** and never import `$env/*` directly. The worker has its own small build step (an esbuild/tsx bundle that resolves the same path aliases).

### 4.2 Anatomy of one module

```
src/lib/server/modules/events/
  README.md          ← what this module does and what it exposes
  index.ts           ← the public API: what other code normally imports
  schema.ts          ← Drizzle table definitions owned by this module
  service.ts         ← use cases: createEvent, publishEvent, updateOccurrence…
  queries.ts         ← read functions used by routes
  validation.ts      ← input schemas (shared with forms)
  recurrence.ts      ← internal logic (pure functions, heavily unit-tested)
  jobs.ts            ← background jobs this module registers (optional)
  *.test.ts          ← unit + integration tests
```

**Guidelines.** These are principles to follow by default, not rules enforced by tooling. Break one when it makes the code simpler, and mention it in the PR.

1. **Prefer the entry point.** Code outside a module usually imports from its `index.ts`. That keeps the module's surface visible and lets its internals change freely.
2. **Write through the owner.** Changes to a module's tables go through that module's functions, because that's where validation and side effects live. **Reading** across modules is fine when a join is the simplest answer, for example when the ranking query joins events, organization status and taxonomy terms. Schema files may import each other for foreign keys.
3. **Keep dependencies mostly one way** (4.3). An occasional back-reference is acceptable, but a pile of them means a module boundary is in the wrong place.
4. **Keep routes thin.** A `+page.server.ts` checks auth, validates, calls a module function and returns. If a load function or action keeps growing, move the logic into the module.
5. **Use plain function calls for side effects.** `events.publish()` calls `seo.invalidateSitemap()` directly. No event bus.

The main tools for keeping this healthy are **code review and each module's README**, which describes what the module does and what it exposes. A lint rule for circular dependencies can be added later if they become a real problem.

### 4.3 Intended dependency direction

```
            routes  (public / dashboard / admin)     worker.ts
                 │                                      │
                 ▼                                      ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  feature modules (top: may depend on anything below)       │
   │    discovery  seo  calendar  widget  analytics  content     │
   └───────────────┬─────────────────────────────────────────────┘
                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  core domain modules                                        │
   │    events ──▶ organizations ──▶ identity                    │
   │    events ──▶ taxonomy     events ──▶ media ──▶ organizations│
   │    moderation ──▶ organizations                             │
   └───────────────┬─────────────────────────────────────────────┘
                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  platform (shared kernel): db · config · jobs · mailer ·    │
   │  storage · i18n · errors · logger     (depends on nothing)  │
   └─────────────────────────────────────────────────────────────┘
```

### 4.4 Module catalogue

| Module                | Owns (tables)                                | Responsibility                                                                                                                                         | Depends on                     |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **platform**          | `jobs` (via queue lib), `audit_log`          | DB client, config/env, mailer, object storage, job queue, i18n helpers, error types, `audit()` helper that any module can call                         | —                              |
| **identity**          | `users`, `sessions`, `login_tokens`          | Login (email magic link by default), sessions, platform-admin flag                                                                                     | platform                       |
| **organizations**     | `organizations`, `memberships`, `invites`    | Org profile, members and roles (owner/admin/editor), invites, `requireOrgRole()` guard, status field                                                   | identity                       |
| **moderation**        | `org_reviews`                                | Review queue, verify/suspend decisions (recorded in the audit log), audit log viewer                                                                   | organizations                  |
| **taxonomy**          | `taxonomy_terms`                             | Denominations, categories, age groups, languages with translated labels                                                                                | platform                       |
| **media**             | `media_assets`                               | Uploads, org-scoped. v0.1 stores bytes in Postgres (`bytea`) and downsizes in the browser; S3-compatible storage later                                 | organizations                  |
| **featuring**         | —                                            | Front page: quality bar (image, description) and per-organization weekly limit; events qualify automatically                                           | events, organizations          |
| **events**            | `events`, `event_occurrences`, `event_terms` | Event CRUD in the iCalendar model, RRULE expansion, materialization, overrides, publish/cancel                                                         | organizations, taxonomy, media |
| **discovery**         | —                                            | Ranking query, search, filters, "collapse to nearest occurrence", seeker prefs cookie                                                                  | events, taxonomy               |
| **seo**               | `slug_redirects`                             | Sitemap, JSON-LD builders, canonical/hreflang helpers, 301 redirects from old slugs when an org or event is renamed (the SEO pitch dies if URLs break) | events, organizations          |
| **calendar**          | `calendar_sources`                           | iCalendar serialization and parsing. Export: per-org and per-search ICS feeds, per-event `.ics`. Import: poll external ICS URLs and upsert by `UID`.   | events, organizations          |
| **widget**            | —                                            | Embeddable org calendar for church websites                                                                                                            | events, organizations          |
| **analytics**         | `event_stats_daily`                          | View/click/calendar-add counters, bot filter, `/go/` redirects, dashboard stats                                                                        | events                         |
| **content** (phase 3) | `articles`                                   | Markdown articles embedding events                                                                                                                     | events, media                  |

### 4.5 Work streams: who can build what in parallel

| Stream                            | Modules                           | Phase | Blocked by                                                  | Parallel?                              |
| --------------------------------- | --------------------------------- | ----- | ----------------------------------------------------------- | -------------------------------------- |
| A. Foundations                    | platform, CI, design-system `ui/` | 0     | —                                                           | Start first (1–2 people, short)        |
| B. Auth & orgs                    | identity, organizations           | 1     | A                                                           | Yes                                    |
| C. Taxonomy & media               | taxonomy, media                   | 1     | A (media also needs B's `org_id`)                           | Yes                                    |
| D. Events & recurrence            | events                            | 1     | A; stubs of B, C                                            | Yes, after the interfaces are agreed   |
| E. Discovery & ranking            | discovery                         | 1     | D's read view (can start against seed data and a stub view) | Yes                                    |
| F. Public pages & SEO             | seo, `(public)` routes            | 1     | D, E interfaces                                             | Yes                                    |
| G. Dashboard UI                   | `(dashboard)` routes              | 1     | B, D interfaces                                             | Yes                                    |
| H. Analytics                      | analytics                         | 2     | D                                                           | Yes, fully isolated                    |
| I. Moderation & self-serve signup | moderation, `(admin)` routes      | 2     | B                                                           | Yes                                    |
| J. Calendar export                | calendar (ICS feeds, `.ics`)      | 1     | D                                                           | Yes, fully isolated (good first issue) |
| K. Calendar import                | calendar (ICS URL sync)           | 2     | D, J                                                        | Yes                                    |
| L. Widget                         | widget                            | 2     | D                                                           | Yes, fully isolated (good first issue) |
| M. Content                        | content                           | 3     | D, C                                                        | Yes                                    |

The key to parallel work is to **agree on each module's `index.ts` signatures first** (a short PR per module containing types and stubs). After that, streams can proceed independently against the stubs and seed data.

### 4.6 Checklist: adding a new module

1. Create `src/lib/server/modules/<name>/` with `README.md`, `index.ts` and `schema.ts` (if it has tables).
2. Register its schema in the Drizzle config, which globs `modules/*/schema.ts`, and generate a migration.
3. Add seed data if it owns tables.
4. Add jobs to `jobs.ts` and register them in `worker.ts`, if needed.
5. UI components go in `src/lib/components/<name>/`.

---

## 5. Data model (high level)

### 5.1 Main tables and relationships

```
users ─┬─< sessions
       └─< memberships >── organizations ──< invites
                               │   (status, timezone, slug, y_tunnus,
                               │    default location: geography(Point))
                               ├─< org_reviews           (moderation)
                               ├─< media_assets
                               ├─< calendar_sources     (ICS URL, last_synced, status)
                               └─< events               (= iCalendar VEVENT master; one-off = 1 occurrence)
                                     │  uid, sequence, source_id (null = created in Nextep),
                                     │  title, slug, extract, description, image_id,
                                     │  location (address + geography point),
                                     │  dtstart_local + tzid, duration, rrule (null = one-off),
                                     │  status (draft/published/cancelled),
                                     │  search_vector (generated tsvector)
                                     ├─< event_terms >── taxonomy_terms (kind, slug, labels jsonb)
                                     ├─< event_occurrences
                                     │      recurrence_id (original start), starts_at, ends_at
                                     │      (timestamptz, materialized), override fields
                                     │      (nullable), cancelled
                                     └─< event_stats_daily  (day, views, clicks, ics_adds, shares)

audit_log  (actor, action, target, at)       articles (phase 3)
```

- All primary keys are UUIDs (v7, time-ordered). Public URLs use slugs.
- `organizations.status` gates visibility: only `verified` orgs' published events appear in discovery.
- Indexes: GiST on location, GIN on `search_vector`, trigram GIN on `title`, B-tree on `event_occurrences(starts_at)`.

### 5.2 Search

- **Full text:** a generated `tsvector` over title, extract, description and org name, using `unaccent`. Finnish stemming is available in Postgres, but because content is multilingual, start with the `simple` configuration and measure.
- **Typo tolerance:** `pg_trgm` similarity on title and org name.
- Both run in the same query as ranking, so there's no separate search engine.

### 5.3 Ranking (pseudo-formula)

1. **Apply the hard filters first** (below). Otherwise the "nearest" occurrence can be a past or cancelled one, and the whole event drops out.
2. For each remaining event, pick the **occurrence nearest the target time `T`**: `DISTINCT ON (event_id) … ORDER BY event_id, abs(starts_at − T)`.
3. Score in an outer query and `ORDER BY score DESC`:

```
score =  w_time  · exp( −|starts_at − T|   / τ_time )     τ_time ≈ 7 days
       + w_dist  · exp( −distance(user, event) / τ_dist ) τ_dist ≈ 10 km   (0 if no location)
       + w_pref  · (matched preference terms / chosen preference terms)       (soft boost)
       + w_text  · text_relevance                                           (0 if no query)

hard filters:  ends_at ≥ now   (in-progress and multi-day events still show),
               distance ≤ max_km (default 60, or "anywhere"),
               org verified, event published, occurrence not cancelled,
               if a text query is given: text match above a similarity threshold
```

When a text query is present it is **both a filter and a boost**. Without the filter, searching "youth" would return nearby unrelated events ranked only by time and distance.

- The weights and τ values live in `discovery/config.ts`.
- The query is one SQL statement inside `discovery`, and nothing outside the module knows how ranking works.
- **Golden tests** pin the expected order for about 20 hand-written scenarios, such as "Sunday service 2 km away beats youth night 40 km away, unless the user has the youth preference".

---

## 6. Technology choices

Postgres and SvelteKit are fixed. Everything else is a **default that can be swapped**. Changing one means writing an ADR, not holding a debate in a PR.

| Concern          | Default                                                                                                                                                          | Notes                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Language         | TypeScript (strict)                                                                                                                                              | Everywhere                                                                                                                   |
| Framework        | SvelteKit (Svelte 5), `adapter-node`                                                                                                                             | SSR; form actions + `use:enhance`                                                                                            |
| DB access        | **Drizzle ORM** + drizzle-kit migrations                                                                                                                         | Schema files per module. Raw SQL is fine for ranking. Kysely is the alternative if the team prefers a query builder.         |
| Validation       | Zod or Valibot (pick one)                                                                                                                                        | Same schema validates form actions and module inputs                                                                         |
| Auth             | **Email + password and OAuth** (Google and Microsoft via arctic, more providers pluggable) + own small session implementation (session table + HTTP-only cookie) | Invite-only: an account links when the provider confirms the invited email. See `src/lib/server/modules/identity/README.md`. |
| Jobs             | Postgres-backed queue (e.g. pg-boss or Graphile Worker)                                                                                                          | No Redis                                                                                                                     |
| iCalendar        | A maintained RFC 5545 library for parsing, serializing and RRULE expansion (e.g. ical.js or rrule)                                                               | Never hand-roll RRULE expansion                                                                                              |
| Geo              | PostGIS `geography`                                                                                                                                              | `ST_DWithin` and `ST_Distance`                                                                                               |
| Maps / geocoding | MapLibre + OSM-based tiles; geocoding via an OSM-based service (e.g. Digitransit for Finland, or Photon/Nominatim)                                               | Wrapped inside a small `platform/geo` adapter                                                                                |
| Images           | S3-compatible storage + `sharp` in the worker                                                                                                                    | Fixed variants (card, hero, og-image)                                                                                        |
| i18n             | Paraglide JS (SvelteKit integration)                                                                                                                             | Locale in the URL prefix (`/en/…`); Finnish is the default at the root                                                       |
| Styling          | Svelte scoped CSS + design tokens (CSS variables), or Tailwind                                                                                                   | Decide once in phase 0                                                                                                       |
| Testing          | Vitest (unit + integration against a real Postgres), Playwright (critical flows)                                                                                 | No database mocks for module tests                                                                                           |
| Hosting          | One container (app + worker commands) + managed Postgres, EU region                                                                                              | GDPR                                                                                                                         |

---

## 7. Cross-cutting concerns

- **Authorization:** two levels only. Platform admins are `users.is_admin`. Org roles are `owner | admin | editor`. Every dashboard load and action calls `requireOrgRole(locals, orgId, role)` from `organizations`, and every module service function that writes org data takes `orgId` explicitly and checks ownership. Postgres row-level security is **not** used initially, because it isn't worth the complexity at this size.
- **Seeker state:** one `nextep_prefs` cookie (coarse lat/lng, radius, preference slugs, locale) that `hooks.server.ts` parses into `locals.seeker`. URL params override it.
- **Errors & logging:** typed domain errors from modules, mapped to HTTP status in routes. Structured JSON logs.
- **Caching:** there are two rules:
  - Any response that reads the `nextep_prefs` cookie (the personalized feed and search) is `Cache-Control: private`. It is never shared-cached, so one person's location-ranked feed is never served to someone else.
  - Non-personalized pages (org pages, event pages, sitemap, ICS) may use a short `s-maxage` behind a CDN. Because a cached page never runs SSR, **view counting uses a tiny uncached beacon request** (`/api/view/{id}`, sent with `navigator.sendBeacon`, plus a `<noscript>` pixel) rather than counting during SSR.
- **Accessibility:** WCAG 2.1 AA, which works naturally with SSR and real forms.

---

## 8. Contributor workflow

- **Local setup:** `docker compose up` (Postgres+PostGIS, MinIO, Mailpit for catching email) → `npm install` → `npm run db:migrate && npm run db:seed` → `npm run dev`. The goal is **under 10 minutes from clone to a running app with realistic data**.
- **Seed data:** about 15 fictional organizations across several Finnish cities, with weekly and one-off events, all taxonomies and a demo login per role. Discovery, dashboard and ranking tests all rely on it.
- **Migrations:** generated from each module's `schema.ts`. **Rule: at most one migration per PR, and if `main` gained a migration since you branched, rebase and regenerate yours instead of merging two migration histories.** CI fails if the schema and migrations disagree.
- **Licence & contributions:** MIT (§2.12); contributions under the same licence.
- **CI gates:** format → lint → `svelte-check` typecheck → unit tests → integration tests on Postgres → Playwright smoke tests → build.
- **Decisions:** `docs/adr/NNN-title.md`, short, one per significant choice (for example "why Drizzle", "why no RLS", "ranking weights v2").
- **Issues:** labeled by module (`module:events`) and `good first issue`. The calendar export, widget, analytics and seo modules are deliberately isolated so they suit newcomers.

---

## 9. Phasing

| Phase                           | Goal                                                                                                      | Modules / surfaces                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0: Foundations**              | Repo, CI, compose, platform kernel, design tokens, auth skeleton, seed                                    | platform, identity, `ui/`                                                                                                                                |
| **1: Discovery MVP**            | Seekers find events and add them to their calendars. The team and invited orgs enter events.              | organizations, taxonomy, media, events, discovery, seo, calendar (export), `(public)`, `(dashboard)`, minimal `(admin)` to create orgs and invite owners |
| **2: Self-serve, sync & trust** | Orgs sign up, connect their existing calendars, get reviewed and see results                              | calendar (ICS import), moderation, analytics, widget, self-serve registration                                                                            |
| **3: Reach**                    | Content and optional notifications                                                                        | content, email digests (optional)                                                                                                                        |
| **Later**                       | Two-way provider sync (Google Calendar API), multi-channel publishing, other countries, any funding model | new modules; the existing ones stay unchanged                                                                                                            |

---

## 10. Non-goals (explicitly)

- ❌ Microservices, a separate API server or a separate dashboard app
- ❌ A client-side SPA for the public site
- ❌ Elasticsearch/Algolia, Redis or an external CMS, unless Postgres demonstrably fails (and then only with an ADR)
- ❌ Seeker accounts in phase 1
- ❌ Hidden series-splitting ("this and following" is an explicit end-series-and-start-new action)
- ❌ Billing, plans or subscriptions of any kind
- ❌ A custom event or recurrence format. iCalendar is the model.
- ❌ Scraping Facebook or other platforms
- ❌ Reusing v1/v2 code. Only the concept and lessons carry over.

---

## 11. Summary for a new contributor

1. Read `idea.md` (the why) and this file (the how). That takes about 15 minutes.
2. `docker compose up`, migrate, seed, `npm run dev`.
3. Pick an issue labeled with a module. Read **only that module's README and `index.ts`**, plus the `index.ts` of anything it depends on.
4. Most changes stay inside that module folder, its components folder and the thin routes that call it. If you need to reach into another module, that's fine; mention it in the PR.
