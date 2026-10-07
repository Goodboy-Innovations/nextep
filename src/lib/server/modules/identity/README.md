# identity

Users, sign-in and sessions. Two ways to sign in:

- **Email + password** — for users an admin gave a password (`users.password_hash`, scrypt from `node:crypto`, min. 10 characters). Unknown emails still run a hash so response time doesn't reveal which emails exist.
- **OAuth** — Google and Microsoft, more pluggable (below).

A user can have both.

- `providers/` — one file per OAuth provider (Google, Microsoft), built on [arctic](https://arcticjs.dev). Authorization code flow with PKCE and `state`.
- `resolve.ts` — who is signing in (pure, unit-tested in `resolve.test.ts`):
  1. an already linked provider account → its user;
  2. otherwise link to an **invited** user with the same email — only if the provider guarantees the email;
  3. emails in `ADMIN_EMAILS` may sign in without an invite and become platform admins (bootstrap);
  4. everyone else is rejected. Seekers never need accounts.

  Password users are matched by email the same way, so an invited user can later also sign in with Google or Microsoft.

- Sessions: random token in an HTTP-only cookie (`nextep_session`); only its SHA-256 is stored. 30 days, sliding.

## Email trust

Linking by email is only safe when the provider has verified the address.

- **Google:** `email_verified === true`.
- **Microsoft:** personal accounts (tenant `9188040d-6c67-4c5b-b112-36a304b66dad`) are trusted. In work/school tenants the `email` claim is set by the tenant and not verified by Microsoft ("nOAuth"), so it is trusted only with the optional `xms_edov` claim. To allow church staff with Microsoft 365 accounts to be linked by email, enable `xms_edov` in the app registration (Token configuration → optional claims). `preferred_username` is never used.

## Adding a provider

1. Create `providers/<id>.ts` exporting a `ProviderFactory` (copy `google.ts`). Arctic supports 60+ providers; for anything OIDC-compatible, decode the ID token.
2. Map its claims to `ExternalIdentity`, and set `emailTrusted` only if the provider guarantees the email. Add a unit test for that mapping.
3. Add it to `FACTORIES` in `providers/index.ts`.
4. Add `<ID>_CLIENT_ID` / `<ID>_CLIENT_SECRET` to `.env.example`, `compose.yaml` and the README.
5. Register the redirect URI `{ORIGIN}/login/<id>/callback` at the provider.

The `id` is stored in `oauth_accounts.provider` — never rename it once in use.
