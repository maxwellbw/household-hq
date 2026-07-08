# Implementation Plan: Tasks CRUD and Activity Log

**Branch**: `003-tasks-crud-and-activity-log` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-tasks-crud-and-activity-log/spec.md`

## Summary

Turn 001's raw task CRUD into the full behavioral contract, and open the ActivityLog for
reading as a household feed. Three backend additions, no schema changes:

1. **Dedicated lifecycle actions** `tasks.complete` and `tasks.reopen` replace
   "set `status` via `tasks.update`" as the completion mechanism. Complete stamps the
   verified completer + time and logs a distinguishable `complete` action; re-completing a
   `done` task is a **no-change** (original attribution preserved, zero new log rows — the
   idempotency the spec demands, FR-003/FR-006). Reopen clears the task's completion stamp,
   logs `reopen`, and is likewise a no-change on an already-open task. `tasks.update` keeps
   title/owner/dueDate edits (set, move, **clear** the due date) and now refuses
   `status`/`completedBy`/`completedAt` so completion has exactly one path and the feed
   never shows a completion as a generic "update" (FR-015).
2. **Identity-relative slices** on `tasks.list` via an optional `filter` ∈
   `mine|theirs|ours|all|default`. The slice is computed server-side from the **verified
   actor**, never a client-supplied "who am I" (FR-009). `default` = mine ∪ ours, directly
   retrievable so the feature-006 UI needn't stitch two requests (FR-010). `both` tasks live
   in `ours` only — the three named slices stay pairwise-disjoint and union to `all`
   (Clarifications 2026-07-08).
3. **Activity feed read** `activity.list` returns the ActivityLog newest-first, bounded by
   `limit` (default generous) and/or `since`, each entry carrying the structured columns
   plus a composed human-readable `summary` ("Jaz completed 'Buy flea meds'"). Entries
   render from data captured at log time, so deleted targets still read meaningfully
   (FR-013); `system` entries are attributed to the system, not a person (FR-011). The log
   stays append-only — no API path edits or prunes it (FR-014).

The UI ships in feature 006; this feature delivers the service capabilities and validates
them via `SelfTest.js` and [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript — same as 001/002

**Primary Dependencies**: none (constitution Principle IV). Reuses `Sheets.js` read/write
engine, `Validation.js`, `ActivityLog.appendLog_`, and 002's verified `actor`/`identity`.
No new external calls.

**Storage**: same Google Sheet, same columns — this feature **adds no schema columns**
(spec Key Entities). Tasks lifecycle uses the existing `status`/`completedBy`/`completedAt`
columns; the feed reads the existing `ActivityLog` tab (`timestamp, actor, action,
targetId, detail`).

**Testing**: `SelfTest.js` — extend the live Task round-trip to exercise
complete/reopen/no-change and the four slices; add a feed read assertion (newest-first,
bounded, survives a deleted target). Live end-to-end in [quickstart.md](quickstart.md).

**Target Platform**: Apps Script web app (`clasp push && clasp deploy` from `/backend`)

**Project Type**: web-service backend (frontend consumes it from feature 006 on)

**Performance Goals**: within 001's < 5s budget (SC-001). Every action reads at most one
tab once and writes at most one row + one log row (CLAUDE.md Sheets rule); the feed reads
ActivityLog once and returns a bounded slice.

**Constraints**: envelope frozen by 001 (`text/plain` POST, `{token, action, payload}`,
always HTTP 200, `ok` discriminates); slices derive from the verified actor, never a
client parameter (FR-009); ActivityLog is append-only (Principle VI).

**Scale/Scope**: exactly two people; a household generating tens of log entries a week; the
feed's default bound is sized to cover "since I last looked" for at least weekly checking.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Two Users Forever | ✅ Pass | Slices are the three owner values (`max`/`jaz`/`both`) plus `all`/`default` — no roles, tenancy, or scale. `default` is literally "my stuff + our stuff" for two known people. Feed actors stay `max`/`jaz`/`system`. |
| II | Sheet Is Source of Truth | ✅ Pass | Feed is a read-only projection of ActivityLog rows; no cache or shadow state. No new columns; `snoozed` rows read honestly (FR-007). Filtering is in-memory over one tab read. |
| III | Free-Tier Only | ✅ Pass | No new services or calls; pure in-process reads/writes on the existing Sheet. |
| IV | Boring and Debuggable | ✅ Pass | Straight-line handlers reusing `Sheets.js`; complete/reopen are small explicit functions; the feed is `readTable_` → reverse → slice → compose. No abstractions. |
| V | Idempotent Generation | ✅ Pass | Re-completing a `done` task is a no-change with zero duplicate rows or log entries (the idempotency requirement itself, FR-003/SC-006); writes stay under `withLock_`. No triggers/generators added. |
| VI | Every State Change Is Logged | ✅ Pass | complete/reopen each append exactly one entry with a distinguishable action name (FR-015); the no-change case is *not* a state change, so it logs nothing. Reads (list/feed) log nothing. Feed never mutates the log (FR-014). |
| VII | Spec-Driven Development | ✅ Pass | This plan; own branch `003-…`; deviations from 001's raw semantics are written into the 003 contract delta, not shipped silently. |

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-tasks-crud-and-activity-log/
├── plan.md              # This file
├── research.md          # Phase 0 — the four design decisions below
├── data-model.md        # Phase 1 — Task lifecycle state machine, feed-entry & slice projections
├── quickstart.md        # Phase 1 — live validation script (curl envelopes)
├── contracts/
│   └── api-003.md        # Phase 1 — delta over 001's api.md: new actions + tightened update
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/                 # Apps Script project (clasp-managed) — all changes are here
├── Api.js               # + tasks.complete / tasks.reopen / activity.list handlers;
│                        #   tasks.list gains filter; tasks.update refuses status/completion
├── Sheets.js            # + readActivityLog_ / feed slice helper; + completeTask_/reopenTask_
│                        #   lifecycle writes (or kept in Api.js — see research D3)
├── ActivityLog.js       # unchanged append API; feed reads via Sheets.js
├── Config.js            # + action-verb/name maps for feed summaries; slice constants
├── SelfTest.js          # + complete/reopen/no-change, slice membership, feed assertions
└── README.md            # note the tightened completion path + new actions
```

**Structure Decision**: The backend stays flat (001's decision — no per-entity files). New
handlers join the existing `HANDLERS` registry in `Api.js`; storage/read helpers join
`Sheets.js`; summary/verb maps join `Config.js`. Nothing new is created outside `/backend`.
The frontend is untouched (feature 006 consumes these actions).

## Complexity Tracking

> No Constitution Check violations — this section intentionally empty.
