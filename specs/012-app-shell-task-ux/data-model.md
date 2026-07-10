# Data Model: App Shell & Task UX (Phase 1)

This feature adds **no new Sheet columns or tabs**. It surfaces existing entities and adds
one write path (snooze) plus one existing-but-unused column's semantics (`snoozeHistory`).
Field names mirror the Sheet columns exactly (see `frontend/src/types/domain.ts` and
`backend/Config.js` HEADERS).

## Entities (existing — as used here)

### Task
| Field | Type | Notes for 012 |
|---|---|---|
| `id` | string (uuid) | stable key |
| `title` | string | shown in Tasks list, detail, snooze dialog |
| `dueDate` | ISO date (optional) | drives Open-group sort; **updated by snooze** |
| `owner` | `max`\|`jaz`\|`both` | owner chip; owner-filter scoping |
| `status` | `open`\|`done`\|`snoozed` | grouping (Open = open+snoozed, Done = done); **snooze sets `snoozed`, unsnooze sets `open`** |
| `eventId` | string (optional) | present ⇒ also appears tethered in its event |
| `completedBy` / `completedAt` | owner / ISO datetime | set by complete, cleared by reopen (unchanged) |
| `snoozeHistory` | string (delimited) | **now written on snooze**; parsed for the detail history (see encoding below) |
| `listItems` | string | untouched |

### Event
| Field | Type | Notes for 012 |
|---|---|---|
| `start` | ISO datetime | existing |
| `end` | ISO datetime | **now settable in create + the new edit sheet**; must be ≥ start |
| others | — | unchanged |

### Recurring rule (managed under More)
Required on create (existing `REQUIRED_ON_CREATE.Recurring`): `title`, `cadence`
(`weekly`\|`biweekly`\|`monthly`\|`quarterly`\|`annually`), `anchorDate` (ISO date),
`defaultOwner`. Optional: `seasonStart`/`seasonEnd` (month), `lastGenerated` (generator-managed — do not edit in UI).

### Prep template (managed under More)
Required on create (existing `REQUIRED_ON_CREATE.TaskTemplates`): `eventType`,
`taskTitle`, `offsetDays` (int, days before event), `defaultOwner`.

### Activity entry (Feed)
Read-only projection from `activity.list`: `timestamp`, `actor`, `action`, `targetId`,
`detail`, and a composed `summary`. 012 adds `snooze`/`unsnooze` as new `action` values
with feed verbs (see contract).

## `snoozeHistory` encoding (R5)

Plain, hand-readable, **append-only** string; entries joined by ` | `:

```
<fromDue>→<newDue> @ <timestampISO>
```

- `fromDue` = the task's `dueDate` before this snooze (or `∅` if it had none).
- `newDue` = the date the user snoozed to.
- `timestampISO` = when the snooze happened (household tz, minute resolution — matches
  `nowIso_`).

Example after two snoozes:
```
2026-07-09→2026-07-14 @ 2026-07-09T08:12 | 2026-07-14→2026-07-20 @ 2026-07-14T07:03
```

**Parse rules (frontend, tolerant):** split on ` | `; for each part split on `→` then
` @ `; skip any part that doesn't match; empty/absent ⇒ "No snoozes yet". Never throws.

## Frontend view models (derived, not stored)

- **NavSection**: `'calendar' | 'tasks' | 'feed' | 'more'` — active-section state in
  `App.tsx`; defaults to `'calendar'`; exactly one is `aria-current`.
- **GroupedTasks** (from `lib/tasks.ts`, pure):
  - `open`: tasks with `status !== 'done'`, sorted by `dueDate` asc, **overdue first**,
    undated last; snoozed items flagged (`snoozedUntil = dueDate`) and de-emphasized until
    due.
  - `done`: tasks with `status === 'done'`, collapsed by default (newest `completedAt`
    first).
  - Both lists are pre-filtered by the active owner-filter set (Max/Jaz/Both), reusing
    `useOwnerFilter`.
- **SnoozeHistoryRow**: `{ fromDue: string|null, newDue: string, at: string }[]` parsed
  from `snoozeHistory` for the task-detail view.

## Validation rules

- **Snooze target**: `newDueDate` MUST be a valid ISO date; UI constrains to dates ≥ today
  (snoozing to the past is meaningless). Backend trusts the date field type (existing
  `FIELD_TYPES.Tasks.dueDate = 'date'`).
- **Event end**: `end` MUST be ≥ `start`. Enforced client-side (clear message) before
  calling `events.create`/`events.update`; backend already type-checks `start`/`end` as
  `datetime`.
- **Idempotence**: snoozing an already-`snoozed` task to the *same* date, or unsnoozing an
  already-`open` task, is a no-change (no history/log row) — mirrors complete/reopen.

## State transitions (Task status)

```
open ──complete──▶ done ──reopen──▶ open
open ──snooze───▶ snoozed ──unsnooze──▶ open
snoozed ──complete──▶ done            (snoozed is "still to do", so completable)
snoozed ──snooze (new date)──▶ snoozed (appends history, moves dueDate)
```

`snooze`/`unsnooze` each append exactly one ActivityLog row on a real transition; `snooze`
also appends one `snoozeHistory` entry. `snoozeHistory` is never cleared by `unsnooze` or
`complete` — it is the permanent deferral trail.
