# calendar

iCalendar (RFC 5545) output, so events flow into Google, Apple and Outlook calendars.

- `/o/{org}/calendar.ics` — subscribable feed of an organization's published events.
- `/e/{org}/{event}/calendar.ics` — one event ("Add to calendar").

Events are written as their master VEVENT (`DTSTART;TZID`, `RRULE`, `EXDATE`) with a `VTIMEZONE` block, not as expanded occurrences. `ics.ts` is a small hand-written serializer (escaping, line folding, UTC `UNTIL`), tested in `ics.test.ts`.

Next: importing an organization's existing ICS feed (upsert by `UID`).
