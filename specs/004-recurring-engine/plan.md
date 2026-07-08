# Implementation Plan: Recurring Chore Engine

**Branch**: `004-recurring-engine` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-recurring-engine/spec.md`

## Summary

Give the household chores that re-appear on their own. A nightly time-driven trigger reads
the **Recurring** tab, computes which occurrences fall due inside a lookahead window, and
materializes each as an ordinary **Task** (linked back via `recurringId`). Plus full
create/edit/delete of the rules themselves over the existing JSON API. No new tab and no
new columns — the Recurring schema (`id, title, cadence, anchorDate, defaultOwner,
lastGenerated, seasonStart, seasonEnd`) was provisioned in feature 001 exactly for this.

Four backend additions, all reusing the 001/002/003 engine:

1. **The generator** `generateRecurringTasks()` — a trigger entry point (also runnable
   from the editor). For each rule it walks occurrences from just past the rule's
   `lastGenerated` high-water mark up to `today + lookahead`, creating a Task per in-season
   occurrence and advancing `lastGenerated`. Idempotency comes from a **deterministic Task
   id** = hash(`recurringId | dueDate`): re-runs and overlapping executions replay to the
   same row instead of duplicating (FR-006/FR-007, reusing `createRecord_`'s id-replay).
   The `lastGenerated` high-water gives the **tombstone**: the generator never looks back
   before it, so a user-deleted occurrence is never resurrected (FR-013).

2. **Rule CRUD** actions `recurring.create` / `recurring.update` / `recurring.delete`
   (list already exists from 001). Validation reuses `rejectUnknownFields_`,
   `requireFields_`, `validateFields_`, and the already-present `validateSeasonWindow_`.
   `lastGenerated` is generator-managed — refused on create/update like 003 refuses
   `status` on `tasks.update` — so a rule's watermark is never client-forgeable.

3. **Occurrence math** — pure, dependency-free date helpers (`addDays_`,
   `addMonthsClamped_`, an occurrence walker, a season test) operating on `YYYY-MM-DD`
   strings in the household timezone. Month/quarter/annual cadences clamp to month length
   (Jan 31 → Feb 28/29) and leap day (Feb 29 → Feb 28); weekly/biweekly step 7/14 days.

4. **The nightly trigger** — a one-time installer `installRecurringTrigger()` creates a
   single daily time-driven trigger for `generateRecurringTasks` (idempotent: it removes
   any existing trigger for the same function first). Run once from the editor after deploy.

The lookahead horizon (default **30 days**) is read from a new `recurringLookaheadDays`
Settings key so it stays hand-tunable (FR-016). No user-facing UI ships here — rule
management and occurrence display are consumed by the calendar UI in feature 006. This
feature delivers the generator, the rule-management actions, and validates them via
`SelfTest.js` and [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript — same as 001–003

**Primary Dependencies**: none (constitution Principle IV). Reuses `Sheets.js`
(`createRecord_`, `updateRecordById_`, `deleteRecordById_`, `listRecords_`, `withLock_`,
`readSettingsMap_`, `getTimezone_`), `Validation.js` (incl. `validateSeasonWindow_`),
`ActivityLog.appendLog_`, and 002's verified `actor`. No new external calls;
`Utilities.computeDigest` (built-in) derives the deterministic id.

**Storage**: same Google Sheet, **no schema change** — the Recurring tab and its
`lastGenerated`/`seasonStart`/`seasonEnd` columns already exist (Config.HEADERS, FIELD_TYPES).
Generated rows land in the existing Tasks tab, reusing its `recurringId` and `dueDate`
columns. One new **Settings** row (`recurringLookaheadDays`), seeded but never overwriting a
hand-set value.

**Testing**: `SelfTest.js` — add a unit block for occurrence math + season windows (no Sheet
needed) and a live block that seeds a rule, runs the generator, and asserts: correct dated
tasks, re-run makes no duplicate, a deleted occurrence is not resurrected, an out-of-season
rule generates nothing, and rule CRUD round-trips. Live end-to-end in [quickstart.md](quickstart.md).

**Target Platform**: Apps Script web app + a time-driven trigger (`clasp push && clasp deploy`
from `/backend`; trigger installed once from the editor).

**Project Type**: web-service backend (frontend consumes it from feature 006 on)

**Performance Goals**: within 001's < 5s request budget for the CRUD actions. The nightly
generator processes a handful of rules × a few occurrences each — dozens of row writes at
most, far under the 6-minute trigger limit. Each rule reads/writes through the existing
lock-per-mutation path (Two Users Forever = negligible contention).

**Constraints**: 6-minute execution limit (ample); all dates ISO `YYYY-MM-DD` in the single
household timezone; Sheet stays hand-readable/editable (a hand-added Recurring row with a
blank id is adopted and materialized like any other, per 001 FR-022).

**Scale/Scope**: two users, on the order of 10–30 recurring rules lifetime. No pagination,
no batching cleverness — straight-line generation (Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **I. Two Users Forever** — PASS. Owners stay `max`/`jaz`/`both`; no roles/tenancy. The
  generator is attributed to the existing `system` actor. Contention model assumes exactly
  two humans + triggers.
- **II. The Sheet Is the Source of Truth** — PASS. No new tab, no opaque blobs; season
  bounds are plain integers, `lastGenerated` a plain ISO date. Rules and generated tasks are
  hand-readable and hand-editable; a hand-added rule row is picked up by the next run
  (SC-006). Row position never used as identity.
- **III. Free-Tier Only** — PASS. Pure Apps Script trigger + Sheets; no new services, no
  keys, no network calls.
- **IV. Boring and Debuggable** — PASS. Dependency-free date math in straight-line code;
  reuses the tested 001/003 read/write/validate/log helpers rather than re-abstracting.
- **V. Idempotent Generation** — PASS (this feature is the archetype). Deterministic Task id
  makes creation replay-safe under re-run and overlap; every mutation goes through
  `withLock_`; the `lastGenerated` high-water bounds work and prevents resurrection.
- **VI. Every State Change Is Logged** — PASS. Each generated Task appends a `create` row by
  `system` (via `createRecord_`). Advancing a rule's `lastGenerated` goes through
  `updateRecordById_`, which logs one `update` by `system`, and only when the value actually
  changes (no-op nights write and log nothing). Rule create/edit/delete log under the acting
  user. See research D5 for why this is a real (not silent) state change.
- **VII. Spec-Driven Development** — PASS. spec → clarify → this plan → tasks → implement on
  branch `004-recurring-engine`.

**No violations — Complexity Tracking omitted.**

## Project Structure

### Documentation (this feature)

```text
specs/004-recurring-engine/
├── plan.md              # This file
├── research.md          # Phase 0 — occurrence math, idempotency/tombstone, trigger, logging
├── data-model.md        # Phase 1 — Recurring rule + generated Task + Settings key
├── quickstart.md        # Phase 1 — live validation guide (deploy, seed, run, verify)
├── contracts/
│   └── api-004.md       # Phase 1 — recurring.create/update/delete + generation semantics
├── checklists/
│   └── requirements.md  # from /speckit.specify (all items passing)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── Recurring.js     # NEW — generateRecurringTasks(), occurrence math, season test,
│                    #       deterministic id, rule create/update helpers, trigger installer
├── Api.js           # EDIT — register recurring.create/update/delete handlers
├── Config.js        # EDIT — REQUIRED_ON_CREATE.Recurring; lookahead default + Settings seed
├── Validation.js    # (reused as-is — validateSeasonWindow_ already present)
├── Sheets.js        # (reused as-is — createRecord_/updateRecordById_/deleteRecordById_)
├── Setup.js         # (reused — new Settings key flows through SETTINGS_SEED)
└── SelfTest.js      # EDIT — unit occurrence math + live generator/CRUD blocks
```

**Structure Decision**: Matches the established flat `/backend` layout (one file per concern,
handlers registered in `Api.js`). The generator and its date math get their own `Recurring.js`
so the trigger surface and occurrence logic are inspectable in one place, mirroring how
`ActivityLog.js` isolates the log. No frontend changes (UI is feature 006).

## Complexity Tracking

No constitution violations; table intentionally empty.
