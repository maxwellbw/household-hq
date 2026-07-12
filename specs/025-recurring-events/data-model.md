# Phase 1 Data Model — Recurring Events

All dates/times are ISO 8601 strings in the household timezone (Settings `timezone`,
default `America/Los_Angeles`). No offsets are stored (household-local, research parity with
004/005). New/changed schema is additive and hand-editable (Constitution II).

---

## New tab: `RecurringEvents`

One row = one recurring-event rule. Columns (order = sheet header order):

| Column | Type | Required on create | Notes |
|--------|------|--------------------|-------|
| `id` | text (UUID) | — (server-set) | `Utilities.getUuid()`; blank-id rows adopted like other ID tabs. |
| `title` | text | ✅ | Occurrence event title. |
| `cadence` | cadence | ✅ | One of `weekly, biweekly, monthly, sixweekly, eightweekly, quarterly, annually` (shared `CADENCES`). |
| `anchorDate` | date | ✅ | `YYYY-MM-DD`; the cycle anchor (an actual past/near occurrence date). |
| `startTime` | time | — | `HH:mm` 24h. **Blank ⇒ all-day occurrence.** Present ⇒ timed. |
| `durationMinutes` | posint | — | Minutes; only meaningful when `startTime` set. Blank + `startTime` set ⇒ default 60. Ignored when all-day. |
| `defaultOwner` | owner | ✅ | `max` / `jaz` / `both`. |
| `templateId` | text | — | References `TaskTemplates.eventType`. Blank ⇒ no prep. Unknown/deleted ⇒ no prep, no error (FR-012). |
| `location` | text | — | Passed through to the occurrence event. |
| `notes` | text | — | Passed through to the occurrence event. |
| `seasonStart` | month | — | 1–12; with `seasonEnd`, restricts which months generate (wrap-around allowed). Blank pair ⇒ year-round. |
| `seasonEnd` | month | — | 1–12. |
| `lastGenerated` | date | — (generator-managed) | Watermark; **rejected** if a client sets it on create/update. Blank ⇒ first run back-fills from today. |

`HEADERS.RecurringEvents = ['id','title','cadence','anchorDate','startTime',
'durationMinutes','defaultOwner','templateId','location','notes','seasonStart','seasonEnd',
'lastGenerated']`

`REQUIRED_ON_CREATE.RecurringEvents = ['title','cadence','anchorDate','defaultOwner']`

`FIELD_TYPES.RecurringEvents = { cadence:'cadence', anchorDate:'date', startTime:'time',
durationMinutes:'posint', defaultOwner:'owner', seasonStart:'month', seasonEnd:'month',
lastGenerated:'date' }`

Add `TABS.RECURRING_EVENTS = 'RecurringEvents'` and include it in `ID_TABS`.

---

## Changed tab: `Events` (one new column)

| Column | Type | Notes |
|--------|------|-------|
| `recurringEventId` | text | Blank on ordinary events; = the `RecurringEvents.id` on every generated occurrence. Parity with `Tasks.recurringId`. |

`HEADERS.Events` gains a trailing `'recurringEventId'`. `setupDatabase()` provisions it
additively. No `FIELD_TYPES` entry (free text).

**All-day acceptance**: Events `start`/`end` validation changes from `datetime` to accept
**either** a full `datetime` **or** a date-only value (all-day). Implemented as a new type
`datetimeOrDate` (true when `isIsoDateTime_(v) || isIsoDate_(v)`) applied to Events
`start`/`end`. The `end >= start` create/update invariant compares the two strings
lexicographically, which stays correct for `YYYY-MM-DD` vs `YYYY-MM-DDThh:mm` (a date-only
end on the same day sorts before any timed start that day — occurrences are written by the
generator with matching shapes, so this only affects hand/API edits, where equal date-only
`start === end` is the all-day norm and passes).

---

## New Settings key

| Key | Default | Notes |
|-----|---------|-------|
| `recurringEventsLookaheadDays` | `60` | Days ahead the recurring-events generator materializes. Blank/≤0 ⇒ fallback `RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS = 60`. Sheet-only (not in `EDITABLE_SETTINGS`), mirroring `recurringLookaheadDays`. |

---

## Enumerations / constants

- Reuse `CADENCES`, `OWNERS`.
- New field type **`time`**: `isValidType_('time', v)` ⇒ `v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v)`.
- New type **`datetimeOrDate`** for Events `start`/`end` (see above).
- `RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS = 60`.
- `RECURRING_EVENTS_TRIGGER_HOUR = 2` (before recurring tasks @3 / prep @4 / gcal @5 / digest @6).

---

## Derived occurrence event (generator output)

For a rule `R` and an occurrence date `d` (a `YYYY-MM-DD` from `occurrencesInWindow_` that
passes `inSeason_`):

```
id               = 'v' + hex(MD5(R.id + '|' + d))          // deterministic ⇒ idempotent
recurringEventId = R.id
title            = R.title
owner            = R.defaultOwner
templateId       = R.templateId
location         = R.location
notes            = R.notes
prepGeneratedFor = ''                                       // syncPrepForEvent_ advances it
type             = ''                                       // user category unused by the generator

// timing:
if R.startTime is blank →  start = d,               end = d                        // all-day
else                     →  start = d + 'T' + R.startTime,
                            end   = addMinutesToDateTime_(start, R.durationMinutes || 60)
```

Written with `createRecord_(TABS.EVENTS, occ, 'system')` (id-replay idempotent, logged),
then reconciled with `syncPrepForEvent_(created, 'system')`.

### Deterministic id helpers

- `recurringEventOccurrenceId_(ruleId, date)` → `'v' + hex(MD5(ruleId + '|' + date))`
  (mirrors `recurringTaskId_`).
- `isRecurringEventId_(id)` → `/^v[0-9a-f]{32}$/.test(id)` (mirrors `isPrepTaskId_`).

`'v'` is distinct from `'r'` (recurring task) and `'p'` (prep task); no id-space collision.

---

## Watermark & never-resurrect invariant

Per rule, exactly as 004:

- `windowStart = R.lastGenerated || (today - 1)`; `windowEnd = today + lookahead`.
- Occurrences are those from `occurrencesInWindow_(R.anchorDate, R.cadence, windowStart,
  windowEnd)`; season-filtered dates are **skipped, not created**, but still advance the
  watermark (so a season gap is never re-scanned).
- After generating, advance `R.lastGenerated` to the max occurrence date seen (only if it
  increased) via `updateRecordById_`.
- A user-deleted occurrence event is **never** regenerated because the next run starts
  strictly after `lastGenerated` (FR-006). Deleting the **rule** stops new occurrences;
  existing occurrences (and their prep) remain (FR-008).

---

## Cascade-clean on occurrence delete (FR-017)

**Already implemented** (feature 005, `deleteEvent_` in `backend/Api.js`) — no new code.
On `events.delete`, in order:

1. Capture the event (for the feature-007 calendar-mirror pointer) and delete the row.
2. List prep tasks for the event (`t.eventId === id ∧ isPrepTaskId_(t.id)`) and
   `deleteRecordById_(TABS.TASKS, t.id, actor)` **all** of them — completed and
   outstanding alike (005 FR-017).
3. Best-effort calendar-mirror delete.

Occurrence events are ordinary Events, so deleting one already gets this full cascade. This
feature adds SelfTest coverage confirming it (T013) rather than new deletion logic.
