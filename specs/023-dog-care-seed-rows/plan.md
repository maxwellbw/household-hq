# Implementation Plan: Dog-care recurring seed rows

**Branch**: `023-dog-care-seed-rows` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-dog-care-seed-rows/spec.md`

## Summary

Add four dog-care chores (flea/tick meds, heartworm meds, nail trim, grooming) to the
existing `SEED_PACK` (feature 015), all owned by `both` and year-round. Flea/tick and
heartworm are `monthly`; nail trim and grooming need two **new fixed cadences** —
`sixweekly` (+42 days) and `eightweekly` (+56 days) — added to the recurring engine's step
function, the backend cadence allow-list/validator, and the frontend cadence type + labels
+ dropdown so seeded rows display and stay hand-selectable. No new API action, no new
screen. Seeding stays the manual, re-runnable `seedRecurringPack()` step; idempotency,
edit-preservation, and never-resurrect all come for free from 015's seed-key + ledger
machinery.

## Technical Context

**Language/Version**: Google Apps Script (V8, ES2015+) backend; TypeScript + React + Vite
frontend (matches the rest of the repo).

**Primary Dependencies**: Backend — none (Apps Script built-ins only). Frontend — existing
React/Tailwind/shadcn stack; no new packages.

**Storage**: The single Google Sheet. New rows land in the existing **Recurring** tab via
`createRecord_`; the applied-seed ledger lives in the **Settings** key
`recurringSeedApplied` (both from 015). No schema/column change — the two new cadences are
just new legal values in the existing typed `cadence` column.

**Testing**: Backend — `SelfTest.js` (`selfTest()` / `selfTestSeedPack()`), run from the
Apps Script editor. Frontend — Vitest (`npm run build` + component tests).

**Target Platform**: Apps Script web-app backend + GitHub Pages PWA frontend.

**Project Type**: Web (backend + frontend), but this feature is almost entirely backend
config; the frontend change is a bounded cadence-list extension.

**Performance Goals**: N/A — one-time manual seed of four rows; the nightly recurring
generator already materializes occurrences within its existing budget.

**Constraints**: Constitution II (Sheet stays human-readable/hand-editable — cadence values
must read plainly), V (idempotent), VI (every state change logged). Apps Script 6-min limit
is a non-issue for four appended rows.

**Scale/Scope**: Two users; four new seed chores; two new cadence values. ~1 backend data
file touched (Config.js) + Recurring.js step + Validation reuse; ~4 small frontend edits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ No roles/tenancy; chores owned by `max`/`jaz`/`both` only
  (all four seeded `both`).
- **II. The Sheet Is Source of Truth / hand-editable** — ✅ New cadences are plain,
  self-describing string values (`sixweekly`, `eightweekly`) in the existing `cadence`
  column; rows stay hand-editable. The validator accepting them means a hand-typed value
  is honored, not rejected.
- **III. Free-Tier Only** — ✅ No new services.
- **IV. Boring & Debuggable** — ✅ Two `case` arms in the existing switch (+42d/+56d) and
  two array entries. No new mechanism; mirrors `weekly`/`biweekly`.
- **V. Idempotent Generation** — ✅ Reuses 015's `seedRecurringPack()` unchanged; seed-key
  identity + ledger already guarantee no duplicates and no resurrection.
- **VI. Every State Change Logged** — ✅ Each seeded row goes through `createRecord_`, which
  appends its own `create` ActivityLog row; a no-op re-run writes nothing.
- **VII. Spec-Driven Development** — ✅ This spec/plan; one clarification recorded.

**Result: PASS.** No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/023-dog-care-seed-rows/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── cadences.md      # The FE⇄BE cadence-value contract (the only shared interface)
├── checklists/
│   └── requirements.md  # From /speckit-specify + /speckit-clarify
└── tasks.md             # /speckit-tasks output (not created here)
```

### Source Code (repository root)

```text
backend/
├── Config.js       # CADENCES: add 'sixweekly','eightweekly'; SEED_PACK: +4 dog-care chores
├── Recurring.js    # CADENCE_STEP_: add cases sixweekly→+42d, eightweekly→+56d
├── Validation.js   # unchanged (cadence type already checks membership in CADENCES)
└── SelfTest.js     # extend unitSeedPack_ count/cadence asserts + a step-math assert

frontend/src/
├── types/domain.ts                       # Cadence union: add the two values
├── components/more/RecurringManager.tsx   # CADENCE_LABELS + CADENCES dropdown: add both
├── components/quickadd/QuickAddSheet.tsx   # CADENCES dropdown: add both (parity)
└── lib/dashboard.ts                        # no logic change (RARE_CADENCES unchanged);
                                            # only the Cadence type flows through
```

**Structure Decision**: Existing web layout (`/backend` Apps Script, `/frontend` Vite).
No new files except the spec artifacts; every code change is additive to an existing file.

## Complexity Tracking

> No Constitution violations — section intentionally empty.
