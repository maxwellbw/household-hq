# Implementation Plan: Sheets Schema and API

**Branch**: `001-sheets-schema-and-api` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-sheets-schema-and-api/spec.md`

## Summary

Provision the six-tab Google Sheet database (Events, Tasks, TaskTemplates, Recurring,
ActivityLog, Settings) and build the Apps Script web-app API every later feature calls:
a single `doPost` routing `action` strings through one JSON envelope, with header-name
column mapping, script-lock-serialized idempotent writes, ActivityLog appends on every
mutation, and an idempotent `setupDatabase()` provisioning routine. Transport is decided
once here: `text/plain` POST for everything (see [research.md](research.md) D1).

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript

**Primary Dependencies**: none — dependency-free by constitution (Principle IV); Apps
Script built-ins only (`SpreadsheetApp`, `LockService`, `Utilities`, `ContentService`)

**Storage**: one Google Sheet, tabs as tables; `SPREADSHEET_ID` in `backend/Config.js`

**Testing**: `SelfTest.js` — a manually-run function exercising CRUD + edge cases
against the live Sheet, plus curl checks per [quickstart.md](quickstart.md) (Apps Script
has no test runner; keep it boring)

**Target Platform**: Apps Script web app (`clasp push && clasp deploy` from `/backend`)

**Project Type**: web-service backend (frontend consumes it from feature 006 on)

**Performance Goals**: < 5s per operation (SC-003); one `getDataRange().getValues()`
read and one batch write per request

**Constraints**: 6-min execution ceiling; no CORS preflight support (drives D1); no
HTTP status control (envelope `ok` is the discriminator); free tier only

**Scale/Scope**: exactly 2 users, tens of requests/day, hundreds-to-thousands of rows;
no pagination

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Two Users Forever | ✅ Pass | No roles/tenancy; `owner` enum is `max\|jaz\|both`; actor is a declared string until 002 |
| II | Sheet Is Source of Truth | ✅ Pass | Header-name mapping (D3), plain-text/ISO values (D6), blank-ID adoption (FR-022), hand-edit tolerance (US3); no cache or shadow state |
| III | Free-Tier Only | ✅ Pass | Apps Script + Sheets only; zero external services in this feature |
| IV | Boring and Debuggable | ✅ Pass | No dependencies, no bundler; one file per concern; SelfTest over framework |
| V | Idempotent Generation | ✅ Pass | Client-supplied IDs with replay-returns-existing (D5); `setupDatabase()` re-runnable (D7); locks via `LockService` (D4) |
| VI | Every State Change Logged | ✅ Pass | Single write path appends ActivityLog row per mutation (FR-019, FR-022) |
| VII | Spec-Driven | ✅ Pass | spec.md + clarify session complete; this plan; deviations go back into spec |

**Post-Phase-1 re-check (2026-07-07)**: all seven gates still pass — the design in
data-model.md and contracts/api.md introduces no new services, dependencies, roles, or
unlogged write paths. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-sheets-schema-and-api/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions D1–D8, risk R1
├── data-model.md        # Phase 1 — six tabs, columns, validation, formats
├── quickstart.md        # Phase 1 — deploy + curl validation walkthrough
├── contracts/
│   └── api.md           # Phase 1 — envelope, actions, error codes
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── .clasp.json          # created by `clasp create` (initial-setup.md Phase 6)
├── appsscript.json      # V8 runtime, webapp config, timezone
├── Config.js            # SPREADSHEET_ID, API_VERSION, TAB/HEADER constants
├── Api.js               # doGet (ping), doPost (parse → route → envelope), error mapping
├── Sheets.js            # tab access, header map (D3), row⇄record, batch read/write, blank-ID adoption
├── Validation.js        # owner/status/cadence enums, date parsing, season window, per-action payload checks
├── ActivityLog.js       # append-only log writer
├── Setup.js             # setupDatabase() provisioning (D7)
└── SelfTest.js          # manually-run end-to-end checks
```

**Structure Decision**: single `backend/` Apps Script project, one file per concern,
flat (Apps Script has no folders). No frontend work in this feature. **Prerequisite**:
`backend/` is created by `clasp create` in initial-setup.md Phase 6, which must happen
before `/speckit.implement` runs.

## Key Design Decisions (full detail in research.md)

- **D1 Transport (FR-015)**: everything is a `text/plain;charset=utf-8` POST to
  `doPost`; `doGet` is a health ping only; no custom headers ever; decided once for all
  future features.
- **D2 Envelope (FR-012/016)**: request `{token, action, payload}`; response
  `{ok, data}` | `{ok, error:{code, message, field?}}`; closed error-code set; HTTP
  status always 200.
- **D3 Header mapping (FR-020)**: name→index map per request; `SCHEMA_MISMATCH` on
  missing headers; extra hand-added columns preserved.
- **D4 Locking (FR-018)**: script lock, 30s wait, `BUSY` on timeout, reads lock-free.
- **D5 Idempotency (FR-017)**: client-supplied UUIDs; create replay returns the
  existing record as success.
- **D6 Dates (FR-009)**: ISO 8601 local strings, household timezone from Settings;
  plain-text column formats so Sheets never coerces.
- **D7 Provisioning (FR-021)**: `setupDatabase()` — create-if-missing only, seeds
  Settings keys, safe to re-run forever; operator-run, not an API action.
- **D8 Config**: IDs as constants in `Config.js`, committed.
- **R1 Risk → feature 002**: web-app deploy mode ("execute as user accessing") breaks
  browser CORS; 002 must decide the mode and update CLAUDE.md. Nothing in 001 depends
  on the outcome.

## Complexity Tracking

No constitution violations; table intentionally empty.
