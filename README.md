# Nextep

Find spiritual events near you. Nextep ranks upcoming events by time, distance, the seeker's preferences and free-text search, and gives churches a simple dashboard, SEO-friendly event pages and calendar feeds.

**Staging:** https://staging.nextep.cloudgood.dev (`main`, demo data). **Pull requests:** each gets a preview at `https://pr<n>.nextep.cloudgood.dev`, linked from the PR once it's deployed.

**Status: v0.1.0-alpha.** See [`docs/idea.md`](docs/idea.md) for the concept and [`docs/proposal.md`](docs/proposal.md) for the technical direction.

## Quick start (Docker — Windows, macOS, Linux)

Requires Docker Desktop (or Docker Engine with the compose plugin).

```sh
cp .env.example .env
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

Organizers sign in with their church's **ChurchTools** (they type the subdomain, e.g. `utopia` for `utopia.church.tools`) or with **email + password**. Details: `src/lib/server/modules/churchtools/README.md`.

- **A church registers itself** on `/register`: its ChurchTools admin adds an OAuth client named `Nextep` in ChurchTools (Järjestelmäasetukset → Yleinen → Kirjaudu sisään → "Kirjaudu kolmannen osapuolen järjestelmään ChurchTools-käyttäjätilillä"), copies the client secret ChurchTools shows once, sets the client's redirect URI to `{ORIGIN}/login/churchtools/callback`, then enters the subdomain, client ID and secret on `/register` and signs in. If ChurchTools later doesn't accept the client (e.g. it was deleted), sign-in treats the church as not registered; registering again replaces the client and keeps the organization. The organization starts **in review**; platform admins verify it under Ylläpito, and only then are its events public.
- **Other members** of that church sign in with ChurchTools and wait until the organization's owner lets them in.
- **ChurchTools emails are not trusted**: they never link to an existing account. Someone who already has a password account signs in with it and connects ChurchTools on Oma tili.
- **Platform admins**: `ADMIN_EMAILS` (comma-separated) makes those addresses admins when they sign in with email + password. On a fresh installation, create the first one with `npm run create-admin -- you@example.fi "Your Name"` (prints a password).

Each church's client ID and secret are stored per instance in the database, so ChurchTools needs no environment variables. For local testing use the redirect URI `http://localhost:5173/login/churchtools/callback`.

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

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Dev server                                      |
| `npm test`             | Unit tests (Vitest)                             |
| `npm run check`        | Type check (svelte-check)                       |
| `npm run lint`         | Prettier + ESLint                               |
| `npm run db:generate`  | Create a migration after changing a `schema.ts` |
| `npm run db:migrate`   | Apply migrations                                |
| `npm run db:seed`      | Demo data (`-- --reset` wipes everything first) |
| `npm run create-admin` | Platform admin with a password (`-- <email>`)   |

**Migrations:** at most one per PR. If `main` gained a migration since you branched, rebase and regenerate yours.

## Deployment

`compose.yaml` runs Nextep on any Docker host. Goodboy's Coolify runs production from release tags,
staging from `main` and a preview with its own database for every pull request, set up with
[coolify-kit](https://github.com/Goodboy-Innovations/coolify-kit): see [`docs/coolify.md`](docs/coolify.md).

The built server checks its environment variables and applies pending migrations when it starts, and
doesn't start if either fails. It needs `ORIGIN`, the site's address.

## Code layout

```
src/lib/server/platform/     shared kernel: config, db, time, slugs, cities
src/lib/server/modules/      one folder per domain, each with README.md, index.ts, schema.ts
  identity/                  users, password sign-in, external accounts, sessions
  churchtools/               ChurchTools sign-in, church registration, profile import
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
src/lib/server/seed/         demo data (npm run db:seed, SEED_ON_START)
drizzle/                     SQL migrations (the built server applies them at start)
compose.coolify.yaml         Coolify: production, staging, PR previews (docs/coolify.md)
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
