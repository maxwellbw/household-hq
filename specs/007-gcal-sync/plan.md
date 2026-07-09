# Implementation Plan: Google Calendar Sync (gcal-sync)

**Branch**: `007-gcal-sync` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-gcal-sync/spec.md`

## Summary

Push Household HQ's own **Events** and **dated Tasks** OUT to the shared "Household"
Google Calendar so both phones get free native notifications. Strictly one-way
(app → calendar); reading work calendars, weather, and the dog-walk finder are **feature
011** and out of scope here.

The design reuses the exact pattern feature 005 established — **one idempotent reconciler
brain** called two ways:

1. **Immediately on every write** (`events.create/update/delete`,
   `tasks.create/update/complete/reopen/delete`) so a change reaches the calendar within
   seconds (clarify: immediate + reconcile).
2. **By a nightly time-driven trigger** (`syncCalendar()`) that reconciles the whole Sheet
   against the calendar — creating what's missing, correcting drift, and sweeping orphans
   (calendar entries whose backing row was hand-deleted). This is the self-healing backstop
   (US3).

Each mirrored calendar entry stores its Google id back in the Sheet — `Events.gcalEventId`
(already reserved in the schema) and a **new additive `Tasks.gcalEventId` column** (the
005 `prepGeneratedFor` migration pattern). That cell is the boring, hand-inspectable pointer
that makes updates/deletes hit the same entry and never duplicate (Principle II/V). Each
entry is also **tagged** with its record id (`CalendarEvent.setTag`) so the nightly orphan
sweep can find and delete app-created entries that no longer have a backing row.

### The idempotency model (the one hard part)

There is no deterministic-id trick here (unlike 004/005) because the mirror lives in Google
Calendar, not the Sheet. Idempotency comes from the **stored pointer + tag**:

- **Cell empty** → create the calendar entry, store its id in the cell, tag the entry.
- **Cell set + entry exists** → update that entry in place (title, time, color, reminders).
- **Cell set + entry missing** (stale mapping, FR-015) → recreate and rewrite the cell.
- **Record not "desired"** (deleted / completed / undated / not in window) → if the cell
  holds an id, delete that entry and clear the cell.

"Desired on the calendar" = for an **Event**, its `end` is today-or-later; for a **Task**,
`status ∈ {open, snoozed}` AND `dueDate` is non-empty AND today-or-later. Because creation
is gated on "cell empty," re-runs and overlapping executions never create a second entry
(Principle V). Every calendar create/update/delete appends one `gcal-sync` ActivityLog row
(FR-012). An immediate-mirror failure is swallowed (logged) so it never fails the user's
write — the nightly reconcile catches it up (FR-010).

### Owner treatment, reminders, window (from clarify)

- **Owner** (FR-007): title prefix `[Max] ` / `[Jaz] ` / `[Both] ` + a per-owner Google
  event color (Max→Peacock, Jaz→Grape, Both→Tangerine — closest fixed Google colors to the
  DESIGN.md owner hues; see [data-model.md](data-model.md)).
- **Reminders** (FR-007a): timed events get a popup `gcalEventReminderMin` (default 30) min
  before start; dated-task all-day entries get a morning-of popup at `gcalTaskReminderTime`
  (default 09:00). Both are new hand-editable Settings.
- **Window** (FR-010a): today-forward, no far cap, small recent-past grace; no deep
  back-fill. A two-person household's volume is tiny, so an unbounded forward horizon stays
  far under Apps Script quotas.

### Backend additions

- **`CalendarSync.js`** (NEW) — the mirror brain (`syncCalendarForEvent_`,
  `syncCalendarForTask_`, and their shared calendar helpers), title/color/reminder builders,
  the "desired?" + window predicates, a small **locked single-cell writer** for
  `gcalEventId` (mirrors `readTableForWrite_`'s adoption write) that logs `gcal-sync`, the
  nightly entry point `syncCalendar()` with its **orphan sweep**, and the one-time
  `installCalendarTrigger()`.
- **`Api.js`** (EDIT) — after each Events/Tasks write, call the matching mirror inside a
  `try/catch` (mirror failure never fails the user write). New: wire into `createEvent_`,
  `updateEvent_`, `deleteEvent_`, `createTask_`, `updateTask_`, `completeTask_`,
  `reopenTask_`, and the tasks delete path.
- **`Config.js`** (EDIT) — `HEADERS.Tasks += 'gcalEventId'`; `GCAL_TRIGGER_HOUR = 5`;
  Settings seed `gcalEventReminderMin`, `gcalTaskReminderTime` (calendar id already seeded);
  the owner→EventColor map; `gcal-sync` in `ACTION_VERBS`; `API_VERSION` minor bump.
- **`Setup.js`** (NO code change) — its generic `migrateHeaders_` already appends
  `Tasks.gcalEventId` and `seedSettings_` picks up the new keys on the next `setupDatabase()`
  run. Re-run once after deploy.
- **`appsscript.json`** (EDIT) — add the broad `https://www.googleapis.com/auth/calendar`
  OAuth scope (read+write on accessible calendars). Chosen broad so **feature 011** needs no
  re-authorization (clarify / brief §5.16). Only the deploying shared account re-authorizes.
- **`SelfTest.js`** (EDIT) — unit blocks for the pure builders (title/color/reminder/window
  predicate; no Sheet/Calendar needed) and **guarded** live blocks (skipped when
  `householdCalendarId` is blank) that create a temp event/task, assert exactly one calendar
  entry appears, an edit moves it, a re-run makes no duplicate, complete/delete removes it,
  and the orphan sweep deletes a tagged entry with no backing row — cleaning up after itself.

No user-facing UI ships here. The frontend (feature 006) already renders Events/Tasks; this
feature is a pure backend outbound sync validated by `SelfTest.js` and
[quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript — same as 001–006.

**Primary Dependencies**: none (Principle IV). Reuses `Sheets.js`
(`listRecords_`, `updateRecordById_`, `withLock_`, `readTable_`, `readSettingsMap_`,
`getTimezone_`, `writeRowAsText_`), `ActivityLog.appendLog_`, 002's verified `actor`, and
`Recurring.js`'s `addDays_`. New platform surface: the built-in **`CalendarApp`** service
(`getCalendarById`, `createEvent`/`createAllDayEvent`, `CalendarEvent` `setTitle`/`setTime`/
`setAllDayDate`/`setColor`/`addPopupReminder`/`resetRemindersToDefault`/`setTag`/`getTag`/
`deleteEvent`, `Calendar.getEvents`). No advanced service, no npm.

**Storage**: same Google Sheet. **One additive column** — `gcalEventId` on the **Tasks** tab
(plain text: a Google event id or blank; hand-readable per Principle II). `Events.gcalEventId`
already exists. External store touched: the shared **Household Google Calendar** identified by
Settings `householdCalendarId`. Two new Settings keys (`gcalEventReminderMin`,
`gcalTaskReminderTime`).

**Testing**: `SelfTest.js` — pure-unit blocks for the title/color/reminder/window builders,
plus live blocks (guarded on a configured `householdCalendarId`, self-cleaning) covering
create→one-entry, update→move-in-place, re-run→no-duplicate, complete/delete→removal, stale
pointer→recreate, and orphan sweep. Live end-to-end in [quickstart.md](quickstart.md) on both
phones (Scenarios in that file).

**Target Platform**: Apps Script web app + one nightly time-driven trigger. Deploy: `clasp
push && clasp deploy` from `/backend`; **re-run `setupDatabase()` once** (adds
`Tasks.gcalEventId`, seeds new Settings); **run `installCalendarTrigger()` once** from the
editor; the deploying shared account **re-authorizes once** for the new calendar scope.

**Project Type**: web-service backend (frontend already consumes Events/Tasks from 006).

**Performance Goals**: immediate mirror adds one CalendarApp round-trip + one locked cell
write to each Events/Tasks mutation — well within 001's < 5s CRUD budget. The nightly
reconcile loops tens of events/tasks and one `getEvents(window)` call — dozens of calendar ops
at most, far under the 6-minute trigger limit.

**Constraints**: 6-minute execution limit (ample); all `start`/`end`/`dueDate` interpreted and
written in the single household timezone from Settings (FR-008); the Sheet stays
hand-editable — a hand-added Event/Task row (blank id adopted per 001 FR-022) is mirrored by
the next nightly run; `householdCalendarId` blank ⇒ safe no-op (FR-014).

**Scale/Scope**: two users; on the order of tens of live events/tasks at any time. No
pagination, no batching cleverness — straight-line reconcile (Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **I. Two Users Forever** — PASS. Owners stay `max`/`jaz`/`both` (mapped to three fixed
  calendar colors); no roles/tenancy. Sync is attributed to the existing `system` actor.
  Contention model = two humans + triggers.
- **II. The Sheet Is the Source of Truth** — PASS. The one new column (`Tasks.gcalEventId`) is
  a plain Google event-id string, not an opaque blob; either user can read it, and **clearing
  it by hand forces a fresh mirror** on the next run (a legible repair lever). The Setup
  migration appends it without touching existing data. Sync is strictly **outbound**: the app
  is authoritative and never reads calendar edits back into the Sheet, so the Sheet can never
  be silently mutated by Google-side changes.
- **III. Free-Tier Only** — PASS. `CalendarApp` on the shared Google account + a time-driven
  trigger. No new services, no keys, no paid quota.
- **IV. Boring and Debuggable** — PASS. One idempotent reconciler shared by the write path and
  the nightly path (not divergent code); the stored pointer means "does this row have a
  calendar entry, and which one?" is answerable *by looking at the row*; base `CalendarApp`
  only (no advanced service). Straight-line, inspectable.
- **V. Idempotent Generation** — PASS. Creation is gated on "pointer cell empty," so re-runs
  and overlaps never duplicate; the pointer + tag make update/delete hit the same entry; the
  locked cell-writer serializes the pointer write; a partway-failed run reconverges (FR-015,
  SC-005). Both paths call the same brain.
- **VI. Every State Change Is Logged** — PASS. Each calendar create/update/delete appends one
  `gcal-sync` ActivityLog row (actor `system` for reconcile/immediate mirror). No-op runs
  (nothing changed) write nothing and log nothing.
- **VII. Spec-Driven Development** — PASS. spec → clarify → this plan → tasks → implement on
  branch `007-gcal-sync`.

**No violations — Complexity Tracking omitted.** (The additive `Tasks.gcalEventId` column, the
new Settings keys, and the broad calendar scope are within Principle II/IV: plain
hand-readable fields and a deliberately-once-broad scope that spares 011 a second re-auth.)

## Project Structure

### Documentation (this feature)

```text
specs/007-gcal-sync/
├── plan.md              # This file
├── research.md          # Phase 0 — mapping store, idempotency, reconciler+sweep, owner color,
│                        #           reminders, window, scope, trigger cadence
├── data-model.md        # Phase 1 — Event/Task mirror mapping, owner→color table, calendar entry shape
├── quickstart.md        # Phase 1 — live validation (deploy, migrate, authorize, install trigger, verify on phones)
├── contracts/
│   └── api-007.md       # Phase 1 — no new API actions; sync side-effect semantics on existing writes + trigger
├── checklists/
│   └── requirements.md  # from /speckit.specify (all items passing)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── CalendarSync.js  # NEW — syncCalendarForEvent_/syncCalendarForTask_ + shared calendar helpers,
│                    #       title/color/reminder builders, desired?/window predicates, locked
│                    #       gcalEventId cell-writer (logs gcal-sync), syncCalendar() nightly entry
│                    #       point + orphan sweep, installCalendarTrigger()
├── Api.js           # EDIT — call the matching mirror (try/catch) after events.create/update/delete
│                    #        and tasks.create/update/complete/reopen/delete
├── Config.js        # EDIT — HEADERS.Tasks += gcalEventId; GCAL_TRIGGER_HOUR; new Settings seed keys;
│                    #        OWNER_EVENT_COLOR map; ACTION_VERBS += gcal-sync; API_VERSION bump
├── Setup.js         # (reused as-is — migrateHeaders_/seedSettings_ add the column + keys on re-run)
├── Sheets.js        # (reused as-is — listRecords_/updateRecordById_/withLock_/readTable_/getTimezone_)
├── Recurring.js     # (reused — addDays_ shared date helper)
├── appsscript.json  # EDIT — add https://www.googleapis.com/auth/calendar scope
└── SelfTest.js      # EDIT — unit builders + guarded self-cleaning live calendar blocks
```

**Structure Decision**: Matches the established flat `/backend` layout (one file per concern,
handlers registered in `Api.js`, generators/triggers in their own file). Calendar sync and its
CalendarApp surface get their own `CalendarSync.js` so the mirror brain and trigger are
inspectable in one place — mirroring how `Recurring.js`/`PrepTasks.js` isolate their engines.
No frontend changes.

## Complexity Tracking

No constitution violations; table intentionally empty.
