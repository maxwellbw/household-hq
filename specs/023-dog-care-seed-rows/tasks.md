---
description: "Task list for feature 023 — Dog-care recurring seed rows"
---

# Tasks: Dog-care recurring seed rows

**Input**: Design documents from `/specs/023-dog-care-seed-rows/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/cadences.md](contracts/cadences.md),
[quickstart.md](quickstart.md)

**Tests**: This project validates the backend through editor-run `SelfTest.js` (see
quickstart §A and the definition of done in CLAUDE.md). Self-test tasks are the feature's
regression net, not optional TDD scaffolding.

**Scope note**: Reuses feature 015's `seedRecurringPack()` and the seed-key + ledger
machinery **unchanged**. The only code changes are (a) two new fixed cadences added in
lockstep across backend engine + frontend cadence list, and (b) four dog-care rows appended
to `SEED_PACK`. No new API action, no new screen, no Sheet schema/column change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Apps Script backend under `backend/` (flat `.js` files, clasp-managed; no `src/` nesting).
Frontend under `frontend/src/` (Vite + React + TS).

---

## Phase 1: Setup

**Purpose**: No project scaffolding needed — all files exist. This phase is a no-op marker;
the feature's real foundation is the two new cadences (Phase 2).

*(No setup tasks — proceed to Foundational.)*

---

## Phase 2: Foundational — the two new cadences (BLOCKING)

**Purpose**: Add `sixweekly` (+42d) and `eightweekly` (+56d) everywhere the cadence value
set is enumerated, in lockstep, so the engine can step them, writes/hand-edits validate,
and the frontend displays + offers them. **This blocks US1** — the nail-trim/grooming seed
rows carry these cadences and would fail validation / lack a step arm without this phase.

**⚠️ Backend engine + validator must land together**: a cadence in `CADENCES` with no
`CADENCE_STEP_` arm throws `VALIDATION_FAILED` at generation time (contracts/cadences.md).

- [X] T001 Add `'sixweekly'` and `'eightweekly'` to the `CADENCES` array in `backend/Config.js` (order by interval: after `'monthly'`, before `'quarterly'`).
- [X] T002 Add two `case` arms to `CADENCE_STEP_` in `backend/Recurring.js`: `case 'sixweekly': return addDays_(ymd, 42);` and `case 'eightweekly': return addDays_(ymd, 56);` (place alongside `weekly`/`biweekly`, before the month-based cases).
- [X] T003 [P] Extend the `Cadence` union type in `frontend/src/types/domain.ts` to include `'sixweekly'` and `'eightweekly'` (ordered by interval, between `'monthly'` and `'quarterly'`).
- [X] T004 [P] In `frontend/src/components/more/RecurringManager.tsx`, add `sixweekly: 'Every six weeks'` and `eightweekly: 'Every eight weeks'` to `CADENCE_LABELS`, and add both values to the `CADENCES` dropdown array (same interval order).
- [X] T005 [P] In `frontend/src/components/quickadd/QuickAddSheet.tsx`, add `'sixweekly'` and `'eightweekly'` to its local `CADENCES` dropdown array (same interval order) so both new cadences are hand-selectable when creating a recurring rule.

**Checkpoint**: `cd frontend && npm run build` compiles (proves the widened `Cadence` type
flows through `dashboard.ts`'s `RARE_CADENCES` and all cadence consumers with no other
edits). Backend `CADENCE_STEP_('sixweekly', d)` / `('eightweekly', d)` return +42/+56 days.

---

## Phase 3: User Story 1 — Seed the standard dog-care routine (Priority: P1) 🎯 MVP

**Goal**: Running `seedRecurringPack()` appends the four dog-care chores as ordinary
Recurring rows (flea/tick + heartworm monthly, nail trim sixweekly, grooming eightweekly),
all owned by `both`, each generating occurrences through the existing engine.

**Independent Test**: On an unseeded DB, run `seedRecurringPack()`; confirm exactly four new
Recurring rows with the right cadences/owner/seedKeys and a `create` ActivityLog row each
(quickstart §B), then `generateRecurringTasks()` materializes their occurrences (§F).

- [X] T006 [US1] Append the four dog-care chores to the `SEED_PACK` constant in `backend/Config.js` (from [data-model.md](data-model.md)): `flea-tick`/"Flea/tick meds"/`monthly`, `heartworm`/"Heartworm meds"/`monthly`, `nail-trim`/"Nail trim"/`sixweekly`, `grooming`/"Grooming"/`eightweekly` — each `{ seedKey, title, cadence, anchorRule: 'today', defaultOwner: 'both' }`, no season fields.

**Checkpoint**: `seedRecurringPack()` seeds all four; occurrences generate. US1 delivers the
MVP on its own.

---

## Phase 4: User Story 2 — Re-running seeding is safe (Priority: P1)

**Goal**: Re-running never duplicates a dog-care rule and never resurrects a hand-deleted
one. This behavior is inherited from 015's unchanged mechanism; the work here is proving it
covers the new chores.

**Independent Test**: Seed twice → no duplicates, no new log rows (quickstart §C); delete a
seeded row by hand, seed again → not recreated (§D).

- [X] T007 [US2] In `unitSeedPack_()` in `backend/SelfTest.js`, update the pack-size assertion from `SEED_PACK.length === 8` to `=== 12`, and confirm the existing per-chore cadence/owner-validity and seed-key-uniqueness loops now cover all 12 chores (the `CADENCES.indexOf(c.cadence) >= 0` check exercises the two new cadences added in Phase 2).

*(No new idempotency/never-resurrect code — `seedRecurringPack()` and the ledger from 015
are unchanged; `liveSeedPack_()` already exercises those guarantees against an isolated
test pack.)*

**Checkpoint**: `selfTestSeedPack()` logs `SEED PACK: ALL PASS` with the updated count.

---

## Phase 5: User Story 3 — Hand-tune after seeding (Priority: P2)

**Goal**: The household can edit a seeded rule's date/cadence/owner in More → Recurring —
including selecting "Every six weeks" / "Every eight weeks" — and edits survive re-seeding.

**Independent Test**: Edit Nail trim in the app (change date; confirm the new cadence labels
appear in the dropdown); re-run `seedRecurringPack()`; edits persist, no duplicate
(quickstart §E, §G). Edit-preservation is already covered by `liveSeedPack_()`; the frontend
dropdown coverage comes from Phase 2 (T004/T005).

- [X] T008 [US3] Add or extend a Vitest for `RecurringManager` in `frontend/src/components/more/` asserting the cadence `<select>` renders options for `sixweekly` ("Every six weeks") and `eightweekly` ("Every eight weeks"), and that a rule with `cadence: 'eightweekly'` displays its label (not a blank/undefined) — guards the FR-003a hand-selectable + display requirement.

**Checkpoint**: Frontend test green; `npm run build` clean.

---

## Phase 6: Polish & cross-cutting

- [X] T009 [P] Add a unit assertion to `unitSeedPack_()` in `backend/SelfTest.js` for the new cadence step math: `occurrencesInWindow_` or `CADENCE_STEP_` advances `sixweekly` by exactly 42 days and `eightweekly` by exactly 56 days over one step (mirrors the `unitAlternatingBins_` style); assert the nail-trim/grooming pack entries use these cadences.
- [X] T010 Run the full backend `selfTest()` from the Apps Script editor and `cd frontend && npm run build` + Vitest; confirm all green (quickstart §A, §G). Frontend half done in this session: `npm run build` clean, 322/322 Vitest green. **Backend `selfTest()` still needs a manual run from the Apps Script editor** (sandbox has no Apps Script execution) — see the post-merge follow-up note pattern in `BACKLOG.md`.
- [X] T011 Update `BACKLOG.md`: mark 023 stage and note the `sixweekly`/`eightweekly` cadence addition (the small frontend touch beyond the original "backend-only" framing) in the shipped/notes section on merge.

---

## Dependencies & execution order

- **Phase 2 (cadences) blocks Phase 3 (US1)**: the seed rows reference `sixweekly`/
  `eightweekly`; without the engine step arm + validator entry they fail to generate.
- **US1 → US2 → US3** in priority order, but US2 and US3 add only test/coverage tasks on top
  of the already-inherited 015 behavior, so they carry low risk.
- **Parallel within Phase 2**: T003/T004/T005 (three separate frontend files) can run in
  parallel with each other and with the backend T001/T002. T001 and T002 are separate files
  (Config.js, Recurring.js) and may also run in parallel, but must both land before any
  self-test or generation run.

## Parallel execution example

```
# After deciding to implement, the Phase 2 edits touch 5 distinct files:
T001 backend/Config.js         (CADENCES)      ─┐
T002 backend/Recurring.js      (CADENCE_STEP_) ─┤ all independent files → parallelizable
T003 frontend/.../domain.ts    (Cadence type)  ─┤
T004 frontend/.../RecurringManager.tsx         ─┤
T005 frontend/.../QuickAddSheet.tsx            ─┘
# Then T006 (SEED_PACK, Config.js) — sequential after T001 since it's the same file.
```

## Implementation strategy

**MVP = Phase 2 + Phase 3 (US1)**: the two cadences plus the four seed rows. That alone
delivers the whole user-visible value (seed a standard dog-care routine). Phases 4–5 are
regression coverage proving the inherited idempotency/edit-preservation extends to the new
chores and cadences; Phase 6 is verification + backlog bookkeeping.
