# events

Events in the iCalendar model (RFC 5545). One `events` row is one VEVENT master:

| iCalendar         | column                                               |
| ----------------- | ---------------------------------------------------- |
| `UID`             | `uid`                                                |
| `SEQUENCE`        | `sequence` (bumped on every edit)                    |
| `DTSTART;TZID=…`  | `dtstart_local` (wall-clock, no timezone) + `tzid`   |
| `DURATION`        | `duration_minutes`                                   |
| `RRULE`           | `rrule` (null = one-off)                             |
| `EXDATE`          | `exdates` (local dates of cancelled occurrences)     |
| `LOCATION`, `GEO` | `venue_name`, `street_address`, `city`, `lat`, `lng` |

- `recurrence.ts` holds the pure logic: building/parsing RRULEs for the form and expanding them into occurrences (DST-safe). It is unit-tested in `recurrence.test.ts`.
- Occurrences are **materialized** into `event_occurrences` for a window from 30 days back to 365 days ahead: on every save, and daily via `materializeAll()` (scheduled in `hooks.server.ts`).
- Search: `search_vector` is a generated `tsvector`; `title` has a trigram index.

Not in v0.1: overriding a single occurrence's time/place (`RECURRENCE-ID`), images, ICS import.
