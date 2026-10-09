# Nextep

Find spiritual events near you. Nextep ranks upcoming events by time, distance, the seeker's preferences and free-text search, and gives churches a simple dashboard, SEO-friendly event pages and calendar feeds.

**Status: v0.1.0-alpha.** UI in Finnish.

|                |                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Staging        | https://staging.nextep.cloudgood.dev: `main` with demo data                                    |
| PR previews    | `https://pr<n>.nextep.cloudgood.dev`, with its own copy of staging's data                      |
| Concept        | [`docs/idea.md`](docs/idea.md)                                                                 |
| Technical plan | [`docs/proposal.md`](docs/proposal.md)                                                         |
| Where we are   | [`docs/handoff.md`](docs/handoff.md) (Finnish)                                                 |
| Hosting        | [`docs/coolify.md`](docs/coolify.md): production, staging and previews                         |
| Sign-in        | [`src/lib/server/modules/churchtools/README.md`](src/lib/server/modules/churchtools/README.md) |

## Quick start (Docker)

Requires Docker Desktop, or Docker Engine with the compose plugin.

```sh
cp .env.example .env
docker compose up --build -d     # database, migrations, app
docker compose run --rm seed     # demo data (once)
```

Open http://localhost:3000. Browsing needs no account. Demo logins for organizers (local only; staging has its own admin login):

| Email                    | Password       | Role                                      |
| ------------------------ | -------------- | ----------------------------------------- |
| `admin@example.com`      | `nextep-admin` | platform admin                            |
| `jarjestaja@example.com` | `nextep-demo`  | owner of the demo org "Toivon seurakunta" |

Stop with `docker compose down` (add `-v` to delete the database).

## Development

Node 24+. The database runs in Docker, the app locally with hot reload:

```sh
docker compose up -d db
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev                      # http://localhost:5173
```

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server                                             |
| `npm test`             | Unit tests (Vitest)                                    |
| `npm run check`        | Type check (svelte-check)                              |
| `npm run lint`         | Prettier + ESLint                                      |
| `npm run db:generate`  | Create a migration after changing a `schema.ts`        |
| `npm run db:migrate`   | Apply migrations                                       |
| `npm run db:seed`      | Demo data (`-- --reset` wipes everything first)        |
| `npm run create-admin` | Platform admin with a password (`-- <email> "<name>"`) |

## Contributing

- Work on a branch in this repository and open a pull request. `main` takes changes only through a PR approved by someone other than its author.
- Each PR gets a preview, linked from the PR once it's deployed. Branches from forks get no preview.
- After a merge, staging deploys `main` and starts again from a fresh demo dataset.
- **Migrations:** at most one per PR. If `main` gained a migration since you branched, rebase and regenerate yours.

## Sign-in

Organizers sign in with their church's **ChurchTools** or with **email + password**. A church registers itself on `/register` with an OAuth client from its own ChurchTools, and its organization is public once a platform admin verifies it. ChurchTools emails are never trusted to link accounts. ChurchTools needs no environment variables; platform admins come from `ADMIN_EMAILS` or `npm run create-admin`. The flows: [`churchtools/README.md`](src/lib/server/modules/churchtools/README.md).

ChurchTools allows one redirect URI per OAuth client, so test ChurchTools sign-in on staging or locally (`http://localhost:5173/login/churchtools/callback`), not on previews.

## Deployment

`compose.yaml` runs Nextep on any Docker host. The built server checks its environment variables and applies pending migrations when it starts, and doesn't start if either fails. It needs `DATABASE_URL` and `ORIGIN`, the site's address. Goodboy's setup with [coolify-kit](https://github.com/Goodboy-Innovations/coolify-kit): [`docs/coolify.md`](docs/coolify.md).

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
