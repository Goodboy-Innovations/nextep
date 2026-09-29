# organizations

Organizations (churches, Christian groups), their members and roles.

- Status: `draft → in_review → verified → suspended`. Only `verified` organizations are public.
- Roles, ascending: `editor` (manage events) → `admin` (edit profile) → `owner`. Use `roleAtLeast()`.
- Location: exact coordinates if given, otherwise the city centre from `platform/geo`.

v0.1: platform admins create organizations and add members. Self-serve sign-up and the review queue come later.
