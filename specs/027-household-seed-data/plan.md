# Implementation Plan: Household Seed Data + Supporting Engine Extensions

**Branch**: `027-household-seed-data` | **Date**: 2026-07-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-household-seed-data/spec.md`

## Summary

Load Max and Jaz's real starting data — two shopping lists, eight birthdays, five
anniversaries, ~13 recurring maintenance/yard/holiday/vet tasks, and two prep templates —
in one re-runnable pass, and add the three small engine capabilities that data needs
(six-month cadence, computed "weekend before Thanksgiving" recurrence, and ordinal
"Nth anniversary" titles), plus a client-side list-item search box.

The technical approach is **maximum reuse of the existing seed pattern**: the recurring
tasks simply extend the existing `SEED_PACK`/`seedRecurringPack()` (feature 015/023); three
sibling seed functions (`seedLists`, `seedTemplates`, `seedEvents`) mirror it row-for-row
for the other three data kinds, each with its own per-item `seedKey` + Settings applied
ledger so re-runs, hand-edits, and hand-deletions behave exactly as they do today. A single
`seedHousehold()` runs all four from the editor. The engine extensions are additive: two new
cadence values and one token-substitution in the recurring-event generator — no rewrites.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+); TypeScript 5 / React 18 (Vite) on the frontend.

**Primary Dependencies**: None new. Backend stays dependency-free (Principle IV). Frontend reuses existing shadcn/ui + TanStack Query hooks.

**Storage**: The one Google Sheet — tabs `Lists`, `ListItems`, `TaskTemplates`, `RecurringEvents`, `Recurring`, `Events`, `Tasks`, `Settings`, `ActivityLog`. This feature migrates four tabs to add a `seedKey` column and adds three Settings ledger keys.

**Testing**: `SelfTest.js` (editor-run backend assertions, extending `selfTestSeedPack()`); Vitest for frontend (`lib/lists.test.ts` and friends).

**Target Platform**: Apps Script web app + triggers; GitHub Pages PWA.

**Project Type**: Web application (backend + frontend).

**Performance Goals**: N/A — seeding is a one-time editor run over a few dozen rows; each write goes through the existing locked/idempotent primitives.

**Constraints**: 6-minute Apps Script execution limit (trivially satisfied — ~60 row writes); Sheet must stay human-readable and hand-editable (Principle II); idempotent generation (Principle V); every write logged (Principle VI).

**Scale/Scope**: Two users, one household. ~38 list items, 13 recurring events, ~21 template rows, 13 recurring tasks. No scale accommodations.

## Constitution Check

*GATE: evaluated before Phase 0 and re-checked after design. No violations.*

- **I. Two Users Forever**: Every seeded owner is `max`, `jaz`, or `both`. No roles, tenancy,
  or generalization introduced. ✅
- **II. The Sheet Is the Source of Truth**: New `seedKey` columns hold short human-readable
  slugs; anniversary titles carry a documented `{nth}` token that is legible in the raw
  Sheet; all dates ISO 8601. Seeding tolerates and preserves hand edits (identity is the
  seed key, never row position or title). ✅
- **III. Free-Tier Only**: No new services or paid dependencies. ✅
- **IV. Boring and Debuggable**: Reuses the established seed pattern verbatim; three
  sibling functions over one clever generic (three similar blocks beat an abstraction). The
  two new cadences and the Thanksgiving computation are small, pure, unit-testable helpers.
  No new frameworks. ✅
- **V. Idempotent Generation**: Each pack has a per-item `seedKey` + a Settings applied
  ledger (mirrors `recurringSeedApplied`); occurrence/prep generation already uses
  deterministic ids. A second run writes nothing; a hand-deleted seed row is never
  resurrected. ✅
- **VI. Every State Change Is Logged**: Seeding writes through `createRecord_`, which
  appends its own ActivityLog row per creation; a no-op run logs nothing. ✅
- **VII. Spec-Driven Development**: This plan is produced under the standard chain on its own
  branch. ✅

**Result**: PASS (pre-design and post-design). Complexity Tracking table intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/027-household-seed-data/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R7
├── data-model.md        # Phase 1 — schema deltas, seed packs, cadences, ledgers
├── quickstart.md        # Phase 1 — editor + live validation scenarios A–H
├── contracts/
│   ├── seed-functions.md    # Editor entry points (seedHousehold + 3 siblings)
│   └── engine-extensions.md # New cadences + ordinal-title token contract
└── checklists/requirements.md
```

### Source Code (repository root)

```text
backend/
├── Config.js            # + SEED_PACK 027 rows; + EVENT_SEED_PACK, TEMPLATE_SEED_PACK,
│                        #   LIST_SEED_PACK; + 'semiannually'/'thanksgiving-sat' to CADENCES;
│                        #   + seedKey to Lists/ListItems/TaskTemplates/RecurringEvents SCHEMA;
│                        #   + eventSeedApplied/templateSeedApplied/listSeedApplied Settings
├── Recurring.js         # + CADENCE_STEP_ 'semiannually'; + occurrencesInWindow_ special
│                        #   branch + pure helpers for 'thanksgiving-sat'
├── RecurringEvents.js   # + ordinal-title token substitution in generateForEventRule_
├── Seed.js              # + seedLists(), seedTemplates(), seedEvents(), seedHousehold();
│                        #   + computeSeedAnchor_ new anchorRules (today+Nmo, monthday-MM-DD)
├── Setup.js             # setupDatabase() migrates the four tabs to add seedKey
└── SelfTest.js          # extend selfTestSeedPack(); add ordinal + Thanksgiving + seed asserts

frontend/src/
├── types/domain.ts                            # + 'semiannually' | 'thanksgiving-sat' to Cadence
├── components/more/RecurringManager.tsx        # + labels + CADENCES entries
├── components/more/RecurringEventsManager.tsx  # + labels + CADENCES entries
├── components/quickadd/QuickAddSheet.tsx       # + CADENCES entries (+ label source)
├── components/lists/ListsView.tsx              # + search box filtering items by name
└── lib/lists.ts (+ lists.test.ts)              # + pure filterItemsByName helper + tests

docs/seed-data.md         # source of truth for the data (already written; kept in sync)
```

**Structure Decision**: Existing web-app layout. The overwhelming majority of work is
backend data + engine; the only frontend changes are the additive cadence labels and the
list search box. No new source files beyond tests are required — seed packs live in the
existing `Config.js`, seed functions in the existing `Seed.js`.

## Phase 0 — Research

See [research.md](research.md). Resolves: making four heterogeneous seed packs idempotent
with the existing pattern (R1); where `seedKey` columns live and the migration (R2); the
six-month cadence (R3); the ordinal-title token design (R4); the computed Thanksgiving
recurrence (R5); per-birthday prep-template modeling so owner + lead time vary (R6); and the
list-search UX (R7).

## Phase 1 — Design & Contracts

See [data-model.md](data-model.md), [contracts/](contracts/), and [quickstart.md](quickstart.md).

- **data-model.md**: the four `seedKey` migrations; the three new Settings ledgers; the two
  new cadence values and their semantics; the `{nth}` title token; and a pointer to
  `docs/seed-data.md` as the authoritative row-level dataset (not duplicated).
- **contracts/**: the editor-run seed entry points and their idempotency contract; the
  cadence enum + ordinal-title contract shared by backend and frontend.
- **quickstart.md**: run `setupDatabase()` → `selfTest()`/`selfTestSeedPack()` →
  `seedHousehold()`, then live-verify each data kind and the search box.

## Complexity Tracking

No constitutional violations — table intentionally empty.
