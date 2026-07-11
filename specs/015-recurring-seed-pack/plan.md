# Implementation Plan: Recurring Seed Pack & Alternating Weeks

**Branch**: `015-recurring-seed-pack` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-recurring-seed-pack/spec.md`

## Summary

Add a one-time, editor-runnable `seedRecurringPack()` function (mirroring `setupDatabase()` /
`installRecurringTrigger()`) that appends a curated starter pack of common home-maintenance
recurring chores — plus the weekly/alternating curbside-bin rules — as ordinary rows in the
Recurring tab. Alternating bin collection is expressed entirely with the **existing** engine
(trash weekly; recycling + yard waste biweekly, anchored one week apart), so no engine code
changes. Idempotency and never-resurrect are enforced by (a) a new plain-text **`seedKey`**
column on the Recurring tab identifying each pack-origin row, and (b) a hand-editable
**applied-keys ledger** in Settings that durably remembers every key the seeder has applied so a
household-deleted chore is never re-added. The feature also ships a short documentation recipe for
the offset-biweekly alternating pattern.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), no npm/bundler.

**Primary Dependencies**: Existing backend modules only — `Sheets.js` primitives
(`createRecord_`, `listRecords_`, `readSettingsMap_`), `Recurring.js` occurrence math
(`occurrencesInWindow_`, `addDays_`) reused for self-test assertions, `Config.js` schema
constants (`HEADERS`, `CADENCES`, `SETTINGS_SEED`), `Setup.js` migration path (`migrateHeaders_`).

**Storage**: The one Google Sheet. Touched tabs: **Recurring** (one new `seedKey` column, new
rows), **Settings** (one new ledger key `recurringSeedApplied`), **ActivityLog** (one `create`
row per newly-seeded chore, via the existing `createRecord_` path — no bespoke summary-log
mechanism).

**Testing**: `SelfTest.js` — add a `seedRecurringPack` section run from the editor (idempotence,
edit-preservation, never-resurrect, bin alternation via `occurrencesInWindow_`), self-cleaning.

**Target Platform**: Apps Script web app + editor-run functions; data surfaces in the existing
frontend recurring-rule management UI (feature 012). No frontend work in this feature.

**Project Type**: Web app (backend `/backend` Apps Script + frontend `/frontend`); this feature is
backend + docs only.

**Performance Goals**: N/A — a manual one-shot function over ~8 rows, well within the 6-minute
execution limit. Reads the Recurring tab once, writes appended rows through existing locked
primitives.

**Constraints**: Idempotent and safe to re-run (Principle V); every write logged (Principle VI);
Sheet stays human-readable and hand-editable (Principle II); dependency-free, straight-line code
(Principle IV); dates are `YYYY-MM-DD` strings in the household timezone.

**Scale/Scope**: Two users; ~8 seeded rules; one new column; one new Settings key. No API surface
change (editor-run only, like `setupDatabase`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Two Users Forever** | PASS — owners stay `max`/`jaz`/`both` (pack defaults `both`); no roles, tenancy, or generalization introduced. |
| **II. The Sheet Is the Source of Truth** | PASS — `seedKey` is a plain-text slug column; the ledger is a simple `; `-delimited list in a Settings value. Both human-readable and hand-editable; the seeder appends only and tolerates hand-reordered/edited rows. No opaque blobs. |
| **III. Free-Tier Only** | PASS — no new services; pure Sheet writes. |
| **IV. Boring and Debuggable** | PASS — one straight-line editor-run function mirroring `setupDatabase()`; no new dependencies or abstractions. Two small mechanisms (column + ledger) each with one clear purpose (see research R2). |
| **V. Idempotent Generation** | PASS — re-runs add at most one row per chore; writes go through `createRecord_` (locked). Ledger + `seedKey` column make the skip decision deterministic. |
| **VI. Every State Change Is Logged** | PASS — each newly-seeded rule appends its own `create` `ActivityLog` row (actor `system`) via the existing `createRecord_` path, exactly like the recurring generator logs per occurrence; a no-op run logs nothing (FR-009). |
| **VII. Spec-Driven Development** | PASS — on feature branch `015-recurring-seed-pack`; spec → clarify → plan chain followed. |

**Result**: No violations. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/015-recurring-seed-pack/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R5
├── data-model.md        # Phase 1 — seedKey column, ledger, the seed pack table
├── quickstart.md        # Phase 1 — editor-run validation steps
├── contracts/
│   └── seed-pack.md      # Editor-run function contract (not an API action)
└── tasks.md             # Phase 2 — /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
backend/
├── Config.js            # + seedKey in HEADERS.Recurring; + SEED_PACK constant;
│                         #   + recurringSeedApplied in SETTINGS_SEED
├── Seed.js              # NEW — seedRecurringPack() editor entry point + helpers
├── Setup.js             # unchanged behavior; migrateHeaders_ auto-adds the seedKey column
├── Recurring.js         # unchanged (engine already handles biweekly + season bounds)
├── Sheets.js            # + a small setSettingValue_ helper for the ledger (if not foldable)
├── SelfTest.js          # + seedRecurringPack self-test section
└── README.md            # + "Alternating-week bins" recipe + seedRecurringPack usage
```

**Structure Decision**: Backend-only. New logic lives in a dedicated `backend/Seed.js` (one file,
one concern — mirrors how `Setup.js` and `Recurring.js` isolate their entry points). Schema and
pack data are declared as constants in `Config.js` alongside the other tab/schema definitions. No
`/frontend` changes; no new API action in `Api.js` (the seeder is an editor-run function, exactly
like `setupDatabase()` and `installRecurringTrigger()`).

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
