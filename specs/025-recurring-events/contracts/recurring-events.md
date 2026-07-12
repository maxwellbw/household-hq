# API Contract Delta: Recurring Events (025)

Extends the [004 recurring delta](../../004-recurring-engine/contracts/api-004.md) and
[001's api.md](../../001-sheets-schema-and-api/contracts/api.md). Transport, envelope, error
codes, and auth (002) are **unchanged**: `text/plain` POST of `{ token, action, payload }`,
always HTTP 200, `ok` discriminates, every non-`ping` action requires a verified allowlisted
token; shared-account **writes** need `actingPerson` (`max`/`jaz`). This document adds four
rule-management actions for the new `RecurringEvents` tab and specifies the nightly
generator (a trigger, not an API action). It parallels `recurring.*` (004) closely.

## New actions

| Action | Payload | Data returned | Change |
|--------|---------|---------------|--------|
| `recurringEvents.list` | — | `{ recurringEvents }` | **new** |
| `recurringEvents.create` | `title`, `cadence`, `anchorDate`, `defaultOwner`, `startTime?`, `durationMinutes?`, `templateId?`, `location?`, `notes?`, `seasonStart?`, `seasonEnd?`, `id?` | `{ recurringEvent }` | **new** |
| `recurringEvents.update` | `id` + any editable field | `{ recurringEvent }` | **new** |
| `recurringEvents.delete` | `{ id }` | `{ id }` | **new** |

`recurringEvents.list` returns `{ recurringEvents: [Rule…] }` — every rule, read-only
projection with `_warnings` on any unparseable cell (001 convention).

## Field rules (all write actions)

- **Allowed fields** are exactly the `RecurringEvents` columns: `id, title, cadence,
  anchorDate, startTime, durationMinutes, defaultOwner, templateId, location, notes,
  seasonStart, seasonEnd, lastGenerated`. Any other key → `BAD_REQUEST`
  (`rejectUnknownFields_`).
- `cadence` ∈ `weekly|biweekly|monthly|sixweekly|eightweekly|quarterly|annually`, else
  `VALIDATION_FAILED`.
- `anchorDate` is `YYYY-MM-DD`, else `VALIDATION_FAILED`.
- `startTime`, if present, is `HH:mm` 24-hour (`00:00`–`23:59`), else `VALIDATION_FAILED`.
  **Blank `startTime` ⇒ all-day occurrences.**
- `durationMinutes`, if present, is a positive integer, else `VALIDATION_FAILED`. Only
  meaningful with a `startTime`; blank + `startTime` set ⇒ generator defaults to 60.
- `defaultOwner` ∈ `max|jaz|both`, else `VALIDATION_FAILED`.
- `templateId` is free text; an unknown/deleted template is **tolerated** (the occurrence is
  generated with no prep — FR-012). Not validated against `TaskTemplates`.
- `seasonStart`/`seasonEnd` are integers 1–12, **all-or-nothing** (both set or both blank);
  `start > end` is a legal wrap-around; a half-set pair or out-of-range month →
  `VALIDATION_FAILED` (`validateSeasonWindow_`).
- `lastGenerated` is **generator-managed**: supplying it on create or update → `BAD_REQUEST`.
  Clear it by hand-editing the Sheet to force re-generation.

## Semantics

### `recurringEvents.create` (FR-001, FR-014)

- Requires `title`, `cadence`, `anchorDate`, `defaultOwner`. Timing (`startTime`/
  `durationMinutes`), `templateId`, `location`, `notes`, and the season pair are optional.
- Client-supplied `id` makes create idempotent (001 replay): a known id returns the existing
  rule, no duplicate. Blank/omitted `id` → generated UUID.
- `lastGenerated` starts blank, so the first generator run back-fills the watermark from
  `today` (no backlog of past occurrences).
- Appends one ActivityLog `create` row attributed to the acting user.
- Returns `{ recurringEvent }` — the stored rule.

### `recurringEvents.update` (FR-007, FR-014)

- Requires `id`; patches only the provided editable fields (season pair validated together
  from merged values). Does **not** touch already-generated occurrence Events (FR-007);
  only future occurrences reflect the change.
- Unknown `id` → `NOT_FOUND`. Appends one `update` row attributed to the acting user.
- Returns `{ recurringEvent }` — the merged rule.

### `recurringEvents.delete` (FR-008, FR-014)

- Requires `id`; hard-deletes the rule row. Already-generated occurrence Events **remain**
  as ordinary events (with their prep tasks). Appends one `delete` row.
- Returns `{ id }`.

## The generator (trigger, not an API action)

`generateRecurringEvents()` — nightly time-driven trigger (hour 2), also runnable from the
editor. For each `RecurringEvents` rule, within `[lastGenerated || today-1, today +
recurringEventsLookaheadDays]` (default 60):

- Materializes each in-season due occurrence into an **Event** with deterministic id
  `'v'+MD5(ruleId+'|'+date)` (idempotent replay), `recurringEventId = ruleId`, the rule's
  title/owner/location/notes/templateId, and timing derived per the data model (all-day vs.
  timed).
- Calls `syncPrepForEvent_` on each new occurrence so a rule with a `templateId` gets its
  prep tasks immediately (reuses feature 005; idempotent, per-occurrence independent).
- Advances the rule's `lastGenerated` watermark → never-resurrect (FR-006).
- Every generation appends to ActivityLog via the shared write primitives (FR-013).
- One rule's failure is isolated (logged, does not abort the rest), mirroring
  `generateRecurringTasks`.

`installRecurringEventsTrigger()` — run once from the editor after deploy; idempotent
(removes any existing handler first). Reuses the `script.scriptapp` scope already granted
(features 004/005) — **no re-authorization**.

## Cascade-clean on event delete (FR-017)

Already true of `events.delete` today (feature 005): it removes **all** of an event's prep
tasks (completed and outstanding alike) before deleting the event. Occurrence events are
ordinary Events, so deleting one already cleans up its own prep — no new behavior here.

## Error codes

Unchanged set: `BAD_REQUEST` (unknown field / generator-managed field / bad envelope),
`VALIDATION_FAILED` (bad cadence/date/time/owner/duration/season), `NOT_FOUND` (unknown id
on update/delete), `UNAUTHORIZED`/`FORBIDDEN` (auth), `INTERNAL`.
