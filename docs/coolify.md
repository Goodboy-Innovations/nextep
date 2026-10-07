# Nextep on Coolify: production, staging and PR previews

Nextep runs on Goodboy's Coolify the way [coolify-kit](https://github.com/Goodboy-Innovations/coolify-kit)
describes: production from release tags, staging from `main`, and a preview for every pull request
with its own copy of staging's database. Read the kit's README and
[Coolify quirks](https://github.com/Goodboy-Innovations/coolify-kit/blob/main/docs/coolify-quirks.md)
before changing [`compose.coolify.yaml`](../compose.coolify.yaml) or the Coolify settings.

Secrets (keys, database URLs, OAuth secrets, passwords) go straight into Coolify: never into this
repository, a chat or a log.

|            | Code                  | Database                                                         | Domain                                |
| ---------- | --------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| Production | Release tags (`v0.2`) | Its own Postgres with PostGIS                                    | `https://nextep.cloudgood.fi`         |
| Staging    | `main`, automatically | `nextep/staging` on dev-postgres, seeded with demo data once     | `https://staging.nextep.cloudgood.fi` |
| PR preview | The PR                | `nextep/pr-<n>`, a fresh copy of staging on every push           | `https://pr<n>.nextep.cloudgood.fi`   |
| Computer   | Working copy          | Docker (`compose.yaml`), or `nextep/dev-<user>` with `devpg dev` | `http://localhost:5173`               |

## What the app does for it

Nothing in the app knows about Coolify or dev-postgres. Its variables are set in Coolify, and reach
the container without `compose.coolify.yaml` listing them. That file lists only `ORIGIN`, built from
the deployment's own domain. When the built server starts (`src/hooks.server.ts`):

1. **It checks its variables** (`checkConfig()` in `src/lib/server/platform/config.ts`) and stops with
   one message naming every problem: `DATABASE_URL` missing or not a `postgres://` URL (a preview's
   `none` that devpg didn't replace), `ORIGIN` missing, half-set pairs (`GOOGLE_CLIENT_ID` without its
   secret), `SEED_ON_START` without `SEED_ADMIN_*`. Otherwise it logs a summary without secrets:
   `Config: database <host>/<db> · url <ORIGIN> · sign-in password, google · admin emails 1 · seed off`.
2. **It applies pending migrations** from `drizzle/` and stops if one fails, so a broken migration
   fails the preview, not production.
3. **With `SEED_ON_START=1`** (staging), a database without users gets the demo data, with an admin
   who signs in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The demo organizer
   `jarjestaja@example.com` gets no password; set one under Ylläpito → Käyttäjät if you need it. The
   public demo logins from the README never exist on a server.

`ORIGIN` is the app's one address variable: adapter-node's origin (CSRF check of form posts), and
canonical links, ICS feeds and OAuth redirect URIs. Serve each deployment on one domain and redirect
any other to it in Coolify, or form posts there fail.

Uploaded images live in Postgres, so there is no bucket and no `S3_*`. A preview's copy carries
staging's images with it.

**PostGIS.** Migration `0000` runs `create extension postgis`. dev-postgres has PostGIS installed and
trusted, so the database's own login can create it. Production's Postgres needs PostGIS too (see below).

## Setting it up

### dev-postgres

With an agent or master key (`devpg whoami`):

```sh
devpg app-create nextep --no-key
devpg create nextep/staging
devpg key-create --app nextep --label "coolify previews"
```

The last one prints the key once: put it straight into the preview variables as `DEVPG_KEY`.

### Production (a Coolify app)

1. **Database:** a PostgreSQL resource with the image `postgis/postgis:18-3.6` (Postgres 18, like
   dev-postgres, so data can later be copied to staging).
2. **App:** this repository, Docker Compose build pack, compose file `compose.coolify.yaml`, deploys
   release tags. Domain of the `app` service: `https://nextep.cloudgood.fi:3000`.
3. **Variables** (in Coolify, not in the compose file):

   | Variable                                         | Value                                                                                          |
   | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                   | The database's internal URL                                                                    |
   | `ADMIN_EMAILS`                                   | Your own address: how the first admin gets in (sign in with Google or Microsoft)               |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | With `https://nextep.cloudgood.fi/login/google/callback` registered at Google                  |
   | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | With `…/login/microsoft/callback` registered in Entra. `MICROSOFT_TENANT` defaults to `common` |

   No `DEVPG_*`, no `SEED_*`.

### Staging (a second Coolify app)

Same repository and compose file, on `main`, domain `https://staging.nextep.cloudgood.fi:3000`.

| Variable                                  | Value                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                            | `devpg url nextep/staging`                                        |
| `SEED_ON_START`                           | `1`                                                               |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The staging admin's login; the password from the password manager |
| `GOOGLE_*`, `MICROSOFT_*`, `ADMIN_EMAILS` | Optional, with the staging domain's callback URLs registered      |

Staging deploys only `main`: if it ran an open PR's migration, other previews copied from it would
skip their own older migrations (see the kit's environments doc).

### PR previews

On the **production** app: Preview Deployments on, domain `https://pr{{pr_id}}.nextep.cloudgood.fi:3000`,
and these preview variables (Configuration → Preview Deployments → Environment Variables). A preview
inherits every production variable it doesn't set, so everything that must differ is listed:

```sh
# This deployment is a PR preview: the start command runs devpg.
IS_PR_BUILD=1
# Never production's database. devpg replaces it at start, and stops the start if it can't.
DATABASE_URL=none
DEVPG_URL=http://dev.postgres.internal
# The app key from `devpg key-create --app nextep`.
DEVPG_KEY=
# OAuth redirect URIs can't be registered for every PR domain: password sign-in only.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
ADMIN_EMAILS=
```

Sign in to a preview with the staging admin's login: the preview's database is a copy of staging's.

Check that no app variable is named after one of Coolify's own (`COOLIFY_BRANCH`, `SOURCE_COMMIT`),
or `ORIGIN` (the compose file sets it); delete any such one.

## Checking it

- Staging's log shows `Config: database …/nextep_staging · url https://staging.nextep.cloudgood.fi · …
· seed on`, `[migrate] database is up to date` and `[seed] demo data added`, and the front page
  shows the demo events.
- A test PR's preview log shows `devpg: copied staging into nextep/pr-<n>`, then the config summary
  with `nextep_pr-<n>` and the preview's own address, then the migrations, and the preview shows
  staging's data.
- A preview without `DEVPG_KEY` doesn't start.
- When a PR closes, Coolify removes the preview but not its database: `devpg drop nextep/pr-<n>`, until
  dev-postgres drops idle ones itself.

## Changing `compose.coolify.yaml` later

Previews can't test it, and merging it redeploys production with it at once: follow the kit's
[changing the compose file](https://github.com/Goodboy-Innovations/coolify-kit/blob/main/docs/new-app.md#later-changing-composecoolifyyaml),
and read production's and a preview's config summary afterwards. Adding or renaming a variable needs
no compose change: set it in Coolify, and when one is renamed or dropped, delete the old one there
too (app and preview variables).

## On your computer

Docker as in the README, or a personal database on dev-postgres (needs WireGuard):

```sh
devpg dev --app nextep -- npm run db:migrate
devpg dev --app nextep -- npm run db:seed
devpg dev --app nextep -- npm run dev
```
