# Implementation Plan: Recurring Events

**Branch**: `025-recurring-events` | **Date**: 2026-07-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-recurring-events/spec.md`

## Summary

Extend the recurrence concept — today feature 004 only materializes **Tasks** — to also
materialize **Events**, with full cadence parity (weekly / biweekly / monthly / sixweekly /
eightweekly / quarterly / annually) and optional season bounds. Recurring-event rules live
in their own **`RecurringEvents`** tab (a distinct rule type, per the clarify session). A
nightly generator materializes each rule's due occurrences within a dedicated, hand-tunable
**events lookahead** (default 60 days) into ordinary Events, idempotently (deterministic
occurrence id + a `lastGenerated` watermark that also delivers never-resurrect), links each
occurrence back to its rule via a new `recurringEventId` column on Events, and — when the
rule names a prep template — reuses feature 005's `syncPrepForEvent_` unchanged so every
occurrence arrives with its prep tasks. Occurrences are **all-day by default** (date-only
`start`/`end`, which the frontend already renders as all-day) or **timed** when the rule
carries a time-of-day + duration. Deleting an occurrence event cascade-cleans its
outstanding prep. Rule CRUD rides the existing JSON API; a new More-hub manager mirrors the
existing recurring-chore manager.

The whole design is a deliberate parallel of the proven 004 (recurrence) + 005 (prep)
machinery — same date math, same determinism/idempotency, same watermark, same trigger
installer shape — reused rather than reinvented (Constitution Principle IV/V).

## Technical Context

**Language/Version**: Google Apps Script (V8 / ES2015+) backend; TypeScript + React 18
frontend (Vite).

**Primary Dependencies**: Backend depends only on built-in Apps Script services
(`SpreadsheetApp`, `Utilities`, `ScriptApp`, `LockService`). Frontend: TanStack Query,
Tailwind, shadcn/ui, existing `authedCall` client. No new dependencies either side
(Principle III/IV; no npm in Apps Script).

**Storage**: The household Google Sheet. One **new tab `RecurringEvents`** (rule rows); one
**new column `recurringEventId`** on the existing `Events` tab; one new **Settings** key
`recurringEventsLookaheadDays`. All human-readable and hand-editable.

**Testing**: Backend `SelfTest.js` (in-repo, run from the Apps Script editor); frontend
Vitest + Testing Library. `npm run build` must pass with no type errors.

**Target Platform**: Apps Script web app (Execute as Me, access Anyone) + GitHub Pages PWA.

**Project Type**: Web application (`/backend` Apps Script + `/frontend` Vite).

**Performance Goals**: Nightly generator well within the 6-minute execution budget; one
tab read per generation, batched per-record writes through existing locked primitives.

**Constraints**: Two users forever; Sheet stays hand-editable; idempotent generation; every
state change logged; all dates ISO 8601 strings in the household timezone.

**Scale/Scope**: Two users, a handful of recurring-event rules, a 60-day materialization
window. No scale concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ PASS | No roles/tenancy/scale. Owner stays max/jaz/both. |
| II. The Sheet Is the Source of Truth | ✅ PASS | New tab + column are plain, labeled, hand-editable; `setupDatabase()` provisions them additively and tolerates hand edits; the generator reads a tab once and writes back through locked primitives. |
| III. Free-Tier Only | ✅ PASS | No new external service; built-in Apps Script + existing frontend deps only. |
| IV. Boring and Debuggable | ✅ PASS | Deliberate parallel of 004/005 — reuses `occurrencesInWindow_`, `inSeason_`, `addMonthsClamped_`, `syncPrepForEvent_`; same deterministic-id + watermark idioms. |
| V. Idempotent Generation | ✅ PASS | Deterministic occurrence id (`createRecord_` id-replay) + `lastGenerated` watermark; overlapping/retried runs never duplicate; never-resurrect falls out of the watermark exactly as in 004. |
| VI. Every State Change Is Logged | ✅ PASS | All writes go through `createRecord_`/`updateRecordById_`/`deleteRecordById_`, which append to ActivityLog. |
| VII. Spec-Driven Development | ✅ PASS | spec → clarify → plan → tasks → implement, on branch `025-recurring-events`. |

**Gate result: PASS. No violations — Complexity Tracking left empty.**

No new OAuth scope: the trigger installer reuses `script.scriptapp`, already granted for
features 004/005. `appsscript.json` is unchanged, so **no re-authorization is required**.

## Project Structure

### Documentation (this feature)

```text
specs/025-recurring-events/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── recurring-events.md   # Phase 1 output — JSON API for recurringEvents.*
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # /speckit.tasks output (not created here)
```

### Source Code (repository root)

```text
backend/
├── RecurringEvents.js   # NEW — occurrence math, generator, trigger installer, rule CRUD
├── Recurring.js         # reuse: occurrencesInWindow_, inSeason_, addMonthsClamped_, addDays_, monthOf_, ymd_
├── PrepTasks.js         # reuse (unchanged): syncPrepForEvent_ for occurrence prep
├── Api.js               # + recurringEvents.* handlers; deleteEvent_ cascade-cleans prep (FR-017)
├── Config.js            # + RecurringEvents HEADERS, Events.recurringEventId, FIELD_TYPES, REQUIRED_ON_CREATE,
│                        #   ID_TABS, Settings seed key, trigger hour, lookahead default; 'time' type
├── Validation.js        # + 'time' type; Events start/end accept all-day (date-only)
├── Setup.js             # setupDatabase() provisions the new tab/column/setting (additive)
└── SelfTest.js          # + occurrence-math, generator, prep, cascade-delete, CRUD tests

frontend/
├── src/types/domain.ts                        # + RecurringEventRule; Event.recurringEventId?
├── src/hooks/useRecurringEvents.ts            # NEW — list/create/update/delete (mirrors useRecurring.ts)
├── src/components/more/RecurringEventsManager.tsx  # NEW — rule manager (mirrors RecurringManager.tsx)
├── src/components/more/MoreView.tsx           # + "Recurring Events" section + hub link
└── src/components/calendar/*                  # no change — isAllDay() already renders date-only as all-day
```

**Structure Decision**: Web application. Backend work concentrates in one new file
(`RecurringEvents.js`) plus small, additive edits to `Config.js`/`Api.js`/`Validation.js`/
`Setup.js`/`SelfTest.js`. Frontend adds one hook + one manager component and a section in
the existing More hub, reusing the calendar's existing all-day rendering.

## Phase 0 — Research

See [research.md](research.md). Every clarify-session decision and every design choice
(new tab vs. shared tab, all-day representation, occurrence link column, lookahead sizing,
trigger ordering, cascade delete) is recorded there with rationale and rejected
alternatives.

## Phase 1 — Design & Contracts

- **[data-model.md](data-model.md)** — the `RecurringEvents` tab schema, the new
  `Events.recurringEventId` column, field types, the deterministic occurrence id, all-day
  vs. timed derivation, and the watermark/never-resurrect invariant.
- **[contracts/recurring-events.md](contracts/recurring-events.md)** — the
  `recurringEvents.list/create/update/delete` JSON actions (request/response/errors),
  mirroring the `recurring.*` contract.
- **[quickstart.md](quickstart.md)** — live validation steps: provision, install the
  trigger, create an all-day birthday rule with a prep template + a timed quarterly rule,
  run the generator, verify occurrences + prep + idempotency + season + delete/never-
  resurrect + cascade-clean.

## Complexity Tracking

No constitution violations — no entries.
