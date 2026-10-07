# identity

Users, sign-in and sessions. It knows no external system by name: the churchtools module plugs in through `signInWithExternalAccount` and `listLinkedAccounts`.

- **Email + password** — for accounts an admin created (`users.password_hash`, scrypt from `node:crypto`, min. 10 characters). Unknown emails still run a hash so response time doesn't reveal which emails exist. Emails in `ADMIN_EMAILS` become platform admins when they sign in this way — never through an external account.
- **External accounts** (`oauth_accounts`) — linked by another module, today only ChurchTools (`modules/churchtools`).

A user can have a password and several external accounts.

- `resolve.ts` — who is signing in with an external account (pure, unit-tested in `resolve.test.ts`).
- Sessions: random token in an HTTP-only cookie (`nextep_session`); only its SHA-256 is stored. 30 days, sliding. `npm run create-admin -- <email>` creates the first platform admin of a fresh installation.

## External accounts: emails are not trusted

`signInWithExternalAccount(provider, identity, currentUserId)` is how another module signs someone in with an external system. The module chooses the `provider` id (`oauth_accounts.provider`, e.g. `churchtools:<host>`); identity never interprets it. Anyone can run such a system and put any address on a person, so an external email never links to an existing account and never grants admin (`resolve.ts`):

1. An already linked external account → its user.
2. Someone signed in to Nextep → linked to them ("connect" on `/account`).
3. Otherwise a new user — unless the email is already taken. Then the person must sign in to that account with their password and connect the external account there.

The email of a new user must still be unique, so step 3 reveals that an address has an account. That is the same as any sign-up form.
