# organizations

Organizations (churches, Christian groups), their members and roles.

- Status: `draft → in_review → verified → suspended`. Only `verified` organizations are public.
- Roles, ascending: `editor` (manage events) → `admin` (edit profile) → `owner`. Use `roleAtLeast()`.
- Location: exact coordinates if given, otherwise the city centre from `platform/geo`.

- Self-registration: an organization can be created `in_review` with `registered_by` set (the churchtools module does this when a church connects its ChurchTools). Platform admins verify it on /admin, where organizations in review are listed first. Admins can still create organizations directly.
- Membership requests (`membership_requests`): people ask to join (the churchtools module files one when a church member first signs in); owners and admins let them in as editor or admin, or turn them away, on the profile page.
- This module knows nothing about ChurchTools; the link from an organization to its instance lives in the churchtools module.
