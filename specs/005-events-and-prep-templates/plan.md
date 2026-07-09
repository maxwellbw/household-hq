# Implementation Plan: Events and Prep Templates

**Branch**: `005-events-and-prep-templates` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-events-and-prep-templates/spec.md`

## Summary

Turn "we have guests this weekend" into a concrete, dated, owned prep plan without anyone
transcribing a checklist. Two threads:

1. **Prep-checklist libraries + the generator.** The **TaskTemplates** tab holds reusable
   prep steps grouped by `eventType` (a "checklist" = the set of steps sharing an event
   kind). An **Event** selects a checklist by carrying a `templateId` equal to that kind.
   A single idempotent brain — `syncPrepForEvent_(event, actor)` — materializes one dated
   **Task** per matching step (linked back via `eventId`, dated `event.start + offsetDays`).
   It runs **on save** (synchronous, immediate) and **nightly** (a reconcile trigger that
   catches hand-edited Sheet rows and missed runs), both idempotent.

2. **Event + template management over the JSON API.** Events CRUD already exists (001/003);
   this feature wires prep generation into create/update/delete and adds the three missing
   `templates.create/update/delete` actions (`templates.list` already exists).

The whole design reuses the 001/002/003/004 engine — `Sheets.js` mutations
(locked/logged/idempotent), `Validation.js`, `ActivityLog`, and the exact idempotency
pattern feature 004 established.

### The idempotency + non-resurrection model (the one hard part)

Feature 004 got at-most-once generation from a **deterministic Task id** plus a
`lastGenerated` high-water on each rule. Events have no natural high-water, so this feature
adds two mechanisms:

- **Deterministic prep-task id** `'p' + hex(MD5(eventId + '|' + templateStepId))` (research
  D1). Date-independent, so re-dating an event moves the *same* row instead of duplicating;
  `createRecord_`'s id-replay collapses re-runs/overlaps to one row (FR-011). The `p`+32-hex
  shape (a UUID has hyphens and never matches `^p[0-9a-f]{32}$`) also **identifies** prep
  tasks so cleanup never touches a user's manually event-linked task.
- **A `prepGeneratedFor` marker column on Events** (research D2) — stores the `templateId`
  whose prep has been materialized for that event. It is the tombstone that 004 got from
  `lastGenerated`: the generator **creates** prep only on a *transition* (`templateId !=
  prepGeneratedFor` — a fresh tag, a retag, or a hand-added row with a blank marker); in the
  **steady state** (`templateId == prepGeneratedFor`) it only re-dates surviving prep and
  **never creates**, so a hand-deleted prep task is not resurrected (FR-014). This one field
  also lets the nightly run detect a **hand-edited retag** in the Sheet (SC-006).

`syncPrepForEvent_` therefore does, per event: compute the desired prep set for the current
`templateId`; on a transition, remove the old template's *outstanding* prep (keep completed,
FR-016), create the desired set (deterministic ids → replay-safe), and advance
`prepGeneratedFor`; in steady state, re-date outstanding survivors to `start + offsetDays`
(FR-015) and create nothing. Every mutation goes through the existing locked/logged helpers.

### Backend additions

- **`PrepTasks.js`** (NEW) — `syncPrepForEvent_`, the deterministic id + prep-id matcher, the
  desired-set/date math (reusing `addDays_` from `Recurring.js`), the nightly entry point
  `generatePrepTasks()`, and its one-time installer `installPrepTrigger()`.
- **`Api.js`** (EDIT) — call `syncPrepForEvent_` from `createEvent_`/`updateEvent_`; add a
  `deleteEvent_` that purges **all** of an event's prep on delete (FR-017); add
  `templates.create/update/delete` handlers.
- **`Config.js`** (EDIT) — add `prepGeneratedFor` to `HEADERS.Events`;
  `REQUIRED_ON_CREATE.TaskTemplates`; prep trigger hour constant.
- **`Setup.js`** (EDIT) — a small, general **header migration**: for an already-provisioned
  tab, append any expected header column that is missing (so `prepGeneratedFor` lands on the
  live Events tab without disturbing existing columns/data). Idempotent; re-run-safe.
- **`SelfTest.js`** (EDIT) — unit blocks for the prep-id + offset date math, and live blocks
  for generate/idempotency/re-date/retag/delete-purge/non-resurrection and template CRUD.

No user-facing UI ships here — event/checklist management and prep display are consumed by
the calendar UI in feature 006. This feature delivers the generator, the template-management
actions, event-prep wiring, and validates them via `SelfTest.js` and [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript — same as 001–004.

**Primary Dependencies**: none (constitution Principle IV). Reuses `Sheets.js`
(`createRecord_`, `updateRecordById_`, `deleteRecordById_`, `listRecords_`, `readTableForWrite_`,
`withLock_`, `readSettingsMap_`, `getTimezone_`), `Validation.js` (`rejectUnknownFields_`,
`requireFields_`, `validateFields_`), `ActivityLog.appendLog_`, 002's verified `actor`, and
`Recurring.js`'s `addDays_` date helper. `Utilities.computeDigest` (built-in) derives the
deterministic id. No new external calls.

**Storage**: same Google Sheet. **One additive column** — `prepGeneratedFor` on the Events tab
(plain text, a `templateId` string or blank; hand-readable per Principle II). Generated rows
land in the existing **Tasks** tab reusing its `eventId`/`dueDate`/`owner` columns. Prep steps
live in the existing **TaskTemplates** tab (provisioned in 001, now API-writable). No new tab,
no new Settings key.

**Testing**: `SelfTest.js` — a unit block for `prepTaskId_` + offset date math + the prep-id
matcher (no Sheet needed), and live blocks that seed a template + event, run the generator, and
assert: exactly one prep task per step; re-run makes no duplicate; moving the event re-dates
outstanding prep and leaves completed prep; retag swaps the set (keeps completed); deleting the
event purges all prep; a hand-deleted prep task is not resurrected; and template CRUD
round-trips. Live end-to-end in [quickstart.md](quickstart.md).

**Target Platform**: Apps Script web app + a nightly time-driven trigger (`clasp push && clasp
deploy` from `/backend`; `setupDatabase()` re-run once for the column migration; trigger
installed once from the editor). No new OAuth scopes beyond 004's `script.scriptapp` (already
granted for the recurring trigger).

**Project Type**: web-service backend (frontend consumes it from feature 006 on).

**Performance Goals**: CRUD within 001's < 5s budget. The nightly generator loops a handful of
events × a few steps each — dozens of row writes at most, far under the 6-minute trigger limit.
Each event's prep goes through the existing lock-per-mutation path (Two Users Forever ⇒
negligible contention).

**Constraints**: 6-minute execution limit (ample); event `start`/`end` are ISO datetimes and
prep `dueDate` is the ISO date `start[0:10] + offsetDays`, all in the single household timezone;
the Sheet stays hand-readable/editable — a hand-added Event or TaskTemplates row (blank id
adopted per 001 FR-022; hand-set `templateId`) is materialized by the next nightly run.

**Scale/Scope**: two users; on the order of tens of events and a handful of checklist kinds
lifetime. No pagination, no batching cleverness — straight-line generation (Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **I. Two Users Forever** — PASS. Owners stay `max`/`jaz`/`both`; no roles/tenancy. Generation
  is attributed to the existing `system` actor. Contention model = two humans + triggers.
- **II. The Sheet Is the Source of Truth** — PASS. The one new column (`prepGeneratedFor`) is a
  plain `templateId` string, not an opaque blob; the Setup migration appends it without touching
  existing data, and either user can read/clear it by hand (clearing it forces regeneration).
  Prep tasks, events, and templates are all hand-readable; a hand-added row is picked up by the
  next run (SC-006). Row position never used as identity (deterministic ids by content).
- **III. Free-Tier Only** — PASS. Pure Apps Script trigger + Sheets; no new services, no keys,
  no network calls.
- **IV. Boring and Debuggable** — PASS. One idempotent function (`syncPrepForEvent_`) shared by
  every path instead of four divergent code paths; dependency-free date math reusing 004's
  `addDays_`; the marker column makes "was this event's prep generated, and for which template?"
  answerable by *looking at the row*. Straight-line, inspectable.
- **V. Idempotent Generation** — PASS. Deterministic prep-task id makes creation replay-safe
  under re-run/overlap; every mutation goes through `withLock_`; the `prepGeneratedFor` marker
  bounds creation to transitions and prevents resurrection (the events analogue of 004's
  watermark). Both the save path and the nightly path call the same idempotent brain.
- **VI. Every State Change Is Logged** — PASS. Each generated/purged/re-dated Task write goes
  through `createRecord_`/`updateRecordById_`/`deleteRecordById_`, which append exactly one
  ActivityLog row (by `system` for generation, by the acting user for event/template CRUD).
  Steady-state runs with no date change write nothing and log nothing (no-op nights stay silent).
- **VII. Spec-Driven Development** — PASS. spec → clarify → this plan → tasks → implement on
  branch `005-events-and-prep-templates`.

**No violations — Complexity Tracking omitted.** (The additive `prepGeneratedFor` column and the
Setup header-migration are within Principle II, not violations: a plain hand-readable field and a
safe, idempotent provisioning step.)

## Project Structure

### Documentation (this feature)

```text
specs/005-events-and-prep-templates/
├── plan.md              # This file
├── research.md          # Phase 0 — id/tombstone, sync brain, timing, date math, delete-purge, trigger
├── data-model.md        # Phase 1 — Event (+ prepGeneratedFor), TaskTemplate, generated prep Task
├── quickstart.md        # Phase 1 — live validation guide (deploy, migrate, seed, run, verify)
├── contracts/
│   └── api-005.md       # Phase 1 — templates.create/update/delete + event-prep + generation semantics
├── checklists/
│   └── requirements.md  # from /speckit.specify (all items passing)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── PrepTasks.js    # NEW — syncPrepForEvent_(), prepTaskId_ + prep-id matcher, desired-set/date
│                   #       math, generatePrepTasks() nightly entry point, installPrepTrigger()
├── Api.js          # EDIT — wire syncPrepForEvent_ into createEvent_/updateEvent_; deleteEvent_
│                   #        (purge all prep); templates.create/update/delete handlers
├── Config.js       # EDIT — HEADERS.Events += prepGeneratedFor; REQUIRED_ON_CREATE.TaskTemplates;
│                   #        PREP_TRIGGER_HOUR; API_VERSION minor bump
├── Setup.js        # EDIT — append missing header columns to already-provisioned tabs (migration)
├── Sheets.js       # (reused as-is — createRecord_/updateRecordById_/deleteRecordById_/listRecords_)
├── Validation.js   # (reused as-is — rejectUnknownFields_/requireFields_/validateFields_)
├── Recurring.js    # (reused — addDays_ shared date helper)
└── SelfTest.js     # EDIT — unit prep-id/date math + live generate/idempotency/re-date/retag/
                    #        delete-purge/non-resurrection + template CRUD blocks
```

**Structure Decision**: Matches the established flat `/backend` layout (one file per concern,
handlers registered in `Api.js`). Prep generation and its date math get their own `PrepTasks.js`
so the trigger surface and the `syncPrepForEvent_` brain are inspectable in one place, mirroring
how `Recurring.js` isolates the recurring engine. No frontend changes (UI is feature 006).

## Complexity Tracking

No constitution violations; table intentionally empty.
