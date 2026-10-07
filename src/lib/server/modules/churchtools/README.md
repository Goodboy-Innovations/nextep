# churchtools

Everything ChurchTools: churches sign in, register and fill their profile with their own ChurchTools instance (`<subdomain>.church.tools`). The core modules don't know ChurchTools exists; this module uses them:

- **identity** — `signInWithExternalAccount` with provider `churchtools:<host>`, and `listLinkedAccounts`. The rule that ChurchTools emails are never trusted lives there (see identity/README.md).
- **organizations** — creates the organization `in_review` with `registered_by`, adds the owner, files membership requests.

| Where                                 | What                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`                           | Protocol: hosts, OAuth URLs, callback → identity, `/api/info` → profile, pre-flight check. No database; unit-tested in `client.test.ts`. |
| `schema.ts`                           | `churchtools_instances (host, client_id, org_id)`: connected instances and the organization each registered.                             |
| `service.ts`                          | Instances, `completeSignIn` (sign in / register / replace the client), profile import. Returns results, never redirects.                 |
| `src/lib/server/pages/churchtools.ts` | SvelteKit glue: cookies, the pre-flight before redirecting, results → redirects, error messages.                                         |
| `src/lib/components/churchtools/`     | UI the core pages embed: subdomain input, sign-in form (login), connect form (account), autofill button (profile).                       |
| Routes                                | `/login/churchtools`, `/login/churchtools/callback`, `/register`, `/admin/churchtools`.                                                  |

Removing ChurchTools means deleting the above and the few marked spots in the login, account, profile and admin pages that use them.

## Protocol (`client.ts`)

Every church runs its own instance, and each instance is its own OAuth 2 server:

|           |                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Authorize | `https://<host>/oauth/authorize`                                                                         |
| Token     | `https://<host>/oauth/access_token`                                                                      |
| Userinfo  | `https://<host>/oauth/userinfo` → `{ id, email, data: { firstName, lastName, displayName } }`            |
| Info      | `https://<host>/api/info` (public) → `{ siteName, address: { street, zip, city, latitude, longitude } }` |

No OpenID Connect (no discovery, no ID token) and no scopes. Clients are **confidential**: the token request authenticates with the client secret (HTTP Basic), plus PKCE.

## Flows (`service.ts`, SvelteKit glue in `src/lib/server/pages/churchtools.ts`)

**Registering a church** (`/register`, self-service):

1. The church's ChurchTools admin adds an OAuth client named `Nextep` (Järjestelmäasetukset → Yleinen → Kirjaudu sisään → "Kirjaudu kolmannen osapuolen järjestelmään ChurchTools-käyttäjätilillä"). ChurchTools shows the **client secret once**, then the client's settings with the **client ID** (both generated, neither can be chosen), where the admin sets the redirect URI (Ohjaus-URI) `{ORIGIN}/login/churchtools/callback`.
2. On `/register` they enter the subdomain, client ID and secret, the church's name and city, and sign in with ChurchTools. Only a ChurchTools admin can create a client with our redirect URI, so a successful sign-in proves the church opted in. The secret is stored in `churchtools_instances.client_secret`, sent only to the instance's token endpoint and never shown again.
3. Then an organization is created **in review** (organizations module), the registrant becomes its owner, and the instance is stored with the organization (`churchtools_instances.org_id`). Its events are public once a platform admin verifies it.

**Pre-flight check** before redirecting anyone to ChurchTools, Nextep requests in parallel (`checkChurchToolsClient`) the instance's `/api/info`, the authorization URL (as a browser would: with JSON accepted, ChurchTools answers 401 even for a valid client), and the token endpoint with a made-up code:

- `/api/info` isn't JSON → there is no such instance (church.tools redirects unknown subdomains to `find.church.tools`, so this is not a 404) → "check the address".
- The authorization URL answers 4xx (404 for an unknown client id, 401 for a redirect URI the client doesn't have) → the OAuth client is missing or misconfigured. Sign-in treats it like a church that isn't in Nextep ("Tämä ChurchTools ei ole vielä Nextepissä. Rekisteröi seurakuntasi"); registering again on `/register` replaces the client and keeps the organization (only the instance's admin can create a client, so this is safe).
- The token endpoint answers `invalid_client` → the secret is wrong. `/register` says so before anyone signs in; ChurchTools authenticates the client before it looks at the code.
- Anything else, including ChurchTools being unreachable, continues to ChurchTools.

**Signing in** (`/login/churchtools?instance=utopia`): only connected instances; the login page never contacts an instance that isn't in `churchtools_instances`. A person's first sign-in from an instance creates their account and asks to join that instance's organization (`membership_requests`); its owner or admins answer on the profile page.

The church's name and address can be filled from `/api/info` with a button on the profile page. It only ever fetches the organization's own connected host, never one typed in a request.

Linked accounts are stored as `oauth_accounts.provider = "churchtools:<host>"`, `subject` = person id (ids are only unique within one instance). Never change a host's spelling once in use.

**One redirect URI per client:** ChurchTools allows one redirect URI per OAuth client, so an instance works on one Nextep domain. PR previews (`pr15.staging.nextep.fi`) would each need their own client; test ChurchTools sign-in on staging or locally.
