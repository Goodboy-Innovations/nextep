# Nextep

Find spiritual events near you. Nextep ranks upcoming events by time, distance, the seeker's preferences and free-text search, and gives churches a simple dashboard, SEO-friendly event pages and calendar feeds.

**Status: v0.1.0-alpha.** See [`docs/idea.md`](docs/idea.md) for the concept and [`docs/proposal.md`](docs/proposal.md) for the technical direction.

## Quick start (Docker — Windows, macOS, Linux)

Requires Docker Desktop (or Docker Engine with the compose plugin).

```sh
cp .env.example .env             # optional: add Google/Microsoft sign-in, see below
docker compose up --build -d     # database, migrations, app
docker compose run --rm seed     # demo data (once)
```

Open http://localhost:3000. Browsing needs no account. Demo logins for organizers:

| Email                    | Password       | Role                                      |
| ------------------------ | -------------- | ----------------------------------------- |
| `admin@example.com`      | `nextep-admin` | platform admin                            |
| `jarjestaja@example.com` | `nextep-demo`  | owner of the demo org "Toivon seurakunta" |

Stop with `docker compose down` (add `-v` to delete the database).

## Sign-in

Organizers sign in with **email + password** or with **Google** / **Microsoft** (personal Outlook and work/school accounts). More OAuth providers can be added: see `src/lib/server/modules/identity/README.md`.

Access is invite-only: an admin adds a person under Ylläpito → Käyttäjät, optionally with an initial password (admins can also set a new one there). The person's first sign-in with a provider that confirms that email links the account.

### Setting up Google / Microsoft (optional)

1. Create an OAuth client:
   - Google: Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).
   - Microsoft: Microsoft Entra admin center → App registrations → New registration, with "Accounts in any organizational directory and personal Microsoft accounts". Create a client secret.
2. Register the redirect URIs:
   - `http://localhost:5173/login/google/callback` (npm run dev), `http://localhost:3000/login/google/callback` (Docker)
   - the same with `/login/microsoft/callback`
3. Put the client ids and secrets in `.env`. Providers without credentials are hidden from the login page.

`ADMIN_EMAILS` (comma-separated) lets those addresses sign in with Google/Microsoft without an invite and become platform admins — handy for a fresh installation without the demo data.

## Development

Node 24+. The database runs in Docker, the app runs locally with hot reload:

```sh
docker compose up -d db
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev                      # http://localhost:5173
```

| Command               | What it does                                    |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Dev server                                      |
| `npm test`            | Unit tests (Vitest)                             |
| `npm run check`       | Type check (svelte-check)                       |
| `npm run lint`        | Prettier + ESLint                               |
| `npm run db:generate` | Create a migration after changing a `schema.ts` |
| `npm run db:migrate`  | Apply migrations                                |
| `npm run db:seed`     | Demo data (`-- --reset` wipes everything first) |

**Migrations:** at most one per PR. If `main` gained a migration since you branched, rebase and regenerate yours.

## Code layout

```
src/lib/server/platform/     shared kernel: config, db, time, slugs, cities
src/lib/server/modules/      one folder per domain, each with README.md, index.ts, schema.ts
  identity/                  users, password + OAuth sign-in (Google, Microsoft), sessions
  organizations/             organizations, members, roles, status
  taxonomy/                  categories, age groups, languages, denominations
  events/                    events in the iCalendar model, recurrence, occurrences
  discovery/                 ranking and search (the core idea)
  featuring/                 front-page quality bar and per-organization limit
  media/                     uploaded images (stored in Postgres)
  calendar/                  ICS feeds
  seo/                       JSON-LD, sitemap
src/lib/components/          UI components
src/routes/                  (public) pages, dashboard/, admin/ — thin, they call modules
drizzle/                     SQL migrations
scripts/seed.ts              demo data
```

Start from a module's `README.md` and `index.ts`. Guidelines (not hard rules): import other modules through their `index.ts`, write to a module's tables only through its functions, keep route files thin.

## What v0.1-alpha includes

- Front page is also the search. It shows **featured events** ("nostot") first: filters narrow them, and the other matching events are one click away. If nothing featured matches, it falls back to all events, then to suggestions (see `discovery/tiered.ts`). `/search` redirects there.
- Front page: events with an image and a description of at least 200 characters qualify automatically. Each organization has at most 5 events on it per week (admins can change this per organization); which ones is decided per seeker by the ranking.
- Pill-based search bar: place, distance, day and tags as removable pills, with a suggestion dropdown (works without JavaScript too).
- Ranked discovery: time + distance + preference boost + typo-tolerant search; recurring events collapse to one card.
- Event images (JPEG/PNG/WebP, max 3 MB, downsized in the browser).
- Seeker preferences in a cookie (no accounts), location by city or browser geolocation.
- Event, occurrence (`/e/org/event/2026-10-04`) and organization pages with schema.org JSON-LD, sitemap, robots.txt.
- Events stored as iCalendar VEVENTs (DTSTART+TZID, RRULE, EXDATE); DST-safe expansion.
- ICS feed per organization and "Add to calendar" per event.
- Organizer dashboard: create/edit/publish/cancel events, weekly recurrence, cancel single dates, edit profile.
- Admin: create organizations, set status (only verified organizations are public), create users, add members.

Not yet: ICS import, email notifications (invites are added by email, but no email is sent), i18n (UI is Finnish), statistics, embeddable widget, geocoding (locations resolve to city centres unless coordinates are given).

## Licence

To be decided — see `docs/proposal.md` §2.12.
