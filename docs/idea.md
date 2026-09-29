# Nextep — Concept Document

> This document captures the _product concept_ behind Nextep, reconstructed from the v1/v2 codebases (`nextep-front`, `nextep-api`, `nextep-dashboard`) and the [Seurakuntalainen article](https://www.seurakuntalainen.fi/uutiset/nextep-sovellus-etsii-kayttajan-lahella-jarjestettavat-hengelliset-tapahtumat/). It deliberately leaves out implementation detail (MongoDB, Cloudinary, Next.js, MUI, etc.) — the old stack is not something to carry forward, only the idea.

## Pitch

Nextep is a discovery platform for Christian/spiritual events. It answers one question for a seeker: **"what's happening near me, soon, that I'd actually want to go to?"** — and one question for a church or Christian organization: **"how do I get my events in front of people without fighting five different social platforms and a website nobody visits?"**

The Finnish working name was "Seuraava askel" ("next step") — hence Nextep.

## Origin & mission

Nextep was built by three ICT students:

- **Jaakko Ruhanen** — the initial concept reportedly came to him during prayer, with the intent to build something meaningful "for Jesus," not just another app.
- **Benjamin Nousiainen** — wanted to put his technical skills to use serving his church, having noticed that congregations rarely have a good outlet for tech-skilled volunteers.
- **Nomena Rabenasolo** — joined later, bringing organizational drive to keep the project moving.

The team frames the project as a calling — using their skills to serve God and the church — rather than a purely commercial venture. That framing matters for scope and tone: the product should feel like it's serving congregations, not extracting from them.

## The problem (two-sided)

**For seekers:** Spiritual events (services, prayer nights, worship music, youth events, community gatherings) are scattered across dozens of individual church websites, Facebook pages, and Instagram accounts. There's no single place to search "what's on near me this weekend" the way you would for concerts or movies.

**For churches/organizations:** Marketing is fragmented across many channels, run largely by volunteers, with weak SEO — a church's own event page often doesn't even rank on Google for its own event. Event promotion consumes time that a small, volunteer-run organization can't easily spare.

## Who it's for

- **Seekers** — no account required; anyone looking for a spiritual event nearby. Local search history/preferences were stored client-side, not tied to an identity.
- **Organizations** — churches and Christian groups (the article specifically mentions this extends to things like Christian bands, not just congregations). The stated eligibility bar in the article: the organization acknowledges Jesus as Lord and operates on Biblical principles — i.e. this is an explicitly Christian platform, not general "spiritual/wellness" or interfaith.
- **Organization team members** — with roles (owner / admin / user) inside an organization, invited by email.
- **Platform admins** — who review and verify organizations before they go live (status: verified / in review / suspended).

## Core idea: ranked discovery, not just a directory

The distinguishing mechanic of v1 wasn't a plain list or calendar — it was a **weighted relevance ranking**, similar in spirit to how a job board or dating app ranks matches, applied to events:

- **Time closeness** — events happening around the date/time the user cares about score higher, with a falloff of roughly a week (so an event next Tuesday still surfaces for "this weekend," just lower).
- **Distance closeness** — events near the user score higher, with a falloff on the order of ~10 km, plus a hard distance cap the user can drag (default ~60 km, with an "anywhere" option).
- **Preference match (soft boost)** — if the seeker has set preferences for age group, language, denomination, or category, matching events get a modest score boost rather than being filtered out entirely. Preferences nudge the ranking; they don't hide everything else.
- **Free-text search** — fuzzy, typo-tolerant search across event fields, combinable with the above.
- **Recurring events collapse to one card** — a weekly service doesn't spam the feed as 52 entries; only the next upcoming occurrence is shown, deep-linkable by date.

This "soft-scored blend of time + distance + preference + text" is the real product IP, more than any individual screen. A rebuild should treat this as a first-class design problem, not an afterthought bolted onto a database query.

## Seeker-facing experience

- A home feed of nearby/upcoming events, primary entry point.
- A search bar + a filter drawer (date, distance slider, age group, language, denomination, category).
- Location permission requested to personalize by distance; app works without it (degrades to date/preference-only ranking).
- An event detail page, and an organization profile page (basic info, upcoming events from that org).
- Shareable, SEO-friendly URLs per organization/event (and per recurrence date) — this is explicitly what let events outrank churches' own sites on Google, which was the headline pitch to organizations.
- A lightweight article/content system existed in v2 (content pieces that could reference and embed related events) — essentially a simple CMS-driven blog to build organic traffic and give the platform a content layer beyond raw listings.
- A public sitemap fed from all visible future events, to keep SEO fresh.

## Organization-facing experience (the "dashboard")

- Register → verify email → create an organization (name, Finnish business ID "Y-tunnus", full address, contact info) → organization enters a review/verification queue before going live.
- Invite teammates by email with a role (owner/admin/user).
- Create events through a multi-step form: title, short "extract" (used as the card/search snippet), long description, image, physical location (with map autocomplete), and the taxonomy tags (age group, language, denomination, category) that feed the ranking engine.
- Recurrence support (e.g. "every Sunday") with the ability to edit either a single occurrence or the whole series — this was a genuine complexity sink in v1 (a lot of code dealt with splitting/rejoining recurrence chains) and is worth designing more simply from scratch.
- A media library (organization-scoped image uploads, reused across events).
- Per-event statistics (view counts) — organization-level and platform-level analytics summaries were planned but never actually built in v1 (stubbed as "not implemented"). This is a legitimate gap to fill properly in a rebuild — orgs will want to know "did anyone actually see or click my event," not just raw pageviews.
- A "Team & Subscription" section implies a paid/subscription model per organization, though no concrete pricing logic existed in the old code.

## Trust & moderation

- Organizations have a status: verified / in review / suspended — someone (platform admin) gates who gets to publish.
- The stated eligibility criterion (per the article) is explicitly doctrinal: the organization must acknowledge Jesus as Lord and follow Biblical principles. Whoever owns the platform will need a concrete, written version of this bar and a lightweight review process — this shouldn't stay informal as the org count grows.
- v2.0.2 shipped with "locked registration" — i.e. at some point self-serve org signup was intentionally closed, and the founding team manually onboarded/entered data for early organizations (a concierge-style rollout rather than pure self-serve).

## Business model (as far as it got)

- Low monthly fee per organization.
- Early on, the founding team did the data entry themselves for organizations rather than requiring self-service — a concierge onboarding approach to get real content into the platform before asking churches to maintain it themselves.

## Vision / phased roadmap (as described)

1. **Phase 1 (built):** discovery — help seekers find nearby spiritual events. This is what shipped.
2. **Phase 2 (intended):** let churches self-manage their own profile, calendar, and events without team intervention.
3. **Phase 3 (intended):** one dashboard to publish across multiple channels at once (site, social, etc.) — positioned as a potential replacement for a church needing its own website at all.
4. **Later:** expansion beyond Finland. The team was planning a push at a Pentecostal conference and eventual international scaling (as of the article's writing).

Only phase 1 was really built out; phases 2–3 existed mostly as dashboard scaffolding (event/org CRUD) rather than multi-channel publishing.

## What v1 got right (worth keeping as concepts)

- The weighted ranking model (time + distance + preference + text) instead of a plain filterable list.
- Treating SEO as a core value proposition for organizations, not a nice-to-have.
- Collapsing recurring events to their next occurrence instead of flooding the feed.
- No-login discovery — lowering friction for seekers to zero.
- Org verification/status as a trust signal.

## What was incomplete or a complexity sink (worth rethinking, not copying)

- Recurrence editing (single occurrence vs. whole series, splitting series on edit) consumed disproportionate engineering effort for the value delivered.
- Organization- and platform-level statistics were never actually implemented — only a stub.
- The content/article system was bolted on late via an external CMS rather than designed in from the start.
- Real production taxonomies (the actual list of denominations, categories, and how granular "age group" should be) don't appear to have been finalized anywhere retrievable in the codebase — only placeholder/mock values were found (age groups: children / youth / young adults / adults; languages: FI, EN, SV, RU, ES, AR, DE). Denominations and categories exist as schema fields but no real value set survives.
- Eligibility ("acknowledges Jesus as Lord, follows Biblical principles") was stated publicly but doesn't appear to have been operationalized into an actual review checklist or written policy in the code.

## Open questions for the fresh start

- **MVP scope:** rebuild just the discovery experience first (feed + search + ranking), or launch discovery and org dashboard together?
- **Eligibility & review:** what's the concrete, written criteria and process for approving an organization? Who does it, and how fast?
- **Taxonomies:** final lists for denomination, category, age group, and supported languages — these directly shape both the org-facing form and the ranking weights.
- **Seeker accounts:** stay fully anonymous (local-only preferences), or add optional accounts for saved events / notifications / "remind me"?
- **Content sourcing:** manual entry, org self-serve, or some import/scrape from existing calendars (e.g. Facebook events) to bootstrap density before organizations join?
- **Pricing:** what does the subscription actually look like — flat fee, tiered by org size, free tier for small congregations?
- **Geographic scope:** Finland-only for a relaunch, or design multi-country/multi-language from day one given the stated international ambition?
- **Notifications:** any push/email layer for "an event matching your interests is coming up," or discovery-on-visit only?

## Security note (not concept-related, but worth flagging)

`nextep-api/controllers/statistics.ts` has a hardcoded Matomo `AUTH_TOKEN` committed in the (public) repo. If that token is still live, it should be rotated regardless of whether any of this code gets reused.
