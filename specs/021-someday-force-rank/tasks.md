---

description: "Task list for feature 021 — Someday force-rank + Tasks-tab Someday section"
---

# Tasks: Someday Force-Rank + Tasks-Tab Someday Section

**Input**: Design documents from `specs/021-someday-force-rank/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-021.md](contracts/api-021.md)

**Tests**: Included — this codebase tests with Vitest (`*.test.ts[x]`) + backend `SelfTest.js`, and the DoD requires new backend Sheet-writers and pure logic to be covered.

**Organization**: Grouped by user story. US1 (Someday section) is the MVP and ships independently; US2 (force-rank) layers the ordering; US3 (change resilience) hardens it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- File paths are exact; frontend under `frontend/src/`, backend under `backend/`.

---

## Phase 1: Setup

**Purpose**: Existing repo — no scaffolding. Confirm working baseline only.

- [ ] T001 Verify baseline: `cd frontend && npm run build && npm test` pass on branch `021-someday-force-rank` before changes (captures a green starting point).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `somedayRank` column + type that every render/sort/write path in both stories references.

**⚠️ CRITICAL**: Both user stories depend on this phase.

- [ ] T002 Add `'somedayRank'` as the trailing column of `HEADERS.Tasks` in `backend/Config.js` (per [data-model.md](data-model.md)); keep it last so existing/hand-added rows are unaffected.
- [ ] T003 [P] Add `somedayRank?: string` to the `Task` interface in `frontend/src/types/domain.ts` (mirrors the Sheet string; blank = unranked).

**Checkpoint**: The field exists end-to-end (blank everywhere); no behavior change yet.

---

## Phase 3: User Story 1 - Dedicated Someday section on the Tasks tab (Priority: P1) 🎯 MVP

**Goal**: Pull standalone open undated tasks out of **Open** into a labelled, collapsible **Someday** section at the bottom of the Tasks tab — expanded by default, owner-filtered, calm empty state, complete/reopen + existing schedule action intact, rendered in shared-rank-then-title order.

**Independent Test**: Create undated tasks → they appear under a **Someday** section (not in Open); collapse/expand works; owner filter scopes it; event-attached undated task is excluded; empty filter shows a calm empty state. (Works with all-blank ranks — visible as title order — before US2 exists.)

### Tests for User Story 1

- [ ] T004 [P] [US1] Update `frontend/src/lib/tasks.test.ts`: `groupTasks` no longer returns undated tasks in `open`; a new `someday` slice returns standalone open undated tasks sorted by `somedayRank` ascending then `title`; dated/undated split is correct; the `9999-99-99` sentinel is gone.
- [ ] T005 [P] [US1] Update/extend `frontend/src/components/task/TasksView.test.tsx`: Someday section renders undated tasks separately from Open, is expanded by default, collapses/expands, respects owner filter, and shows the empty state when no someday tasks match.

### Implementation for User Story 1

- [ ] T006 [US1] In `frontend/src/lib/tasks.ts`: remove the `UNDATED_SENTINEL` routing from `groupTasks` (Open = dated open tasks only) and add a `someday` slice (standalone-undated handled by caller/tether) sorted by `somedayRank` (numeric ascending) then `title`; export a reusable `somedaySort` comparator. Update `GroupedTasks` type accordingly.
- [ ] T007 [P] [US1] In `frontend/src/lib/tether.ts`: change `somedayTasks(...)` to sort by the shared `somedaySort` (rank-then-title) instead of title-only, so the home dashboard and Tasks tab agree (SC-003).
- [ ] T008 [US1] In `frontend/src/components/task/TasksView.tsx`: render a collapsible **Someday** section below Open/Done using the existing chevron + `aria-expanded` disclosure idiom, **expanded by default**; feed it standalone open undated tasks (reuse `tether`/`groupTasks`), respect the owner filter, wire `TaskRow` complete/reopen + the existing schedule dialog, and show a calm empty state when none match.
- [ ] T009 [US1] Manual-verify against [quickstart.md](quickstart.md) Scenario A; confirm undated tasks left the Open section entirely.

**Checkpoint**: Someday section is a standalone, shippable improvement (MVP) even with no ranking yet.

---

## Phase 4: User Story 2 - Force-rank the Someday list with "This or that?" (Priority: P1)

**Goal**: A resumable binary-insertion "this or that?" session producing one shared household ranking, persisted via a batched `tasks.rank` endpoint, immediately driving the Someday order for both users.

**Independent Test**: With ≥2 someday tasks, run a session answering pairwise prompts (≪ every-pair count); the section re-renders in the chosen order; the other user sees the same order; leave mid-session and resume without repeating answers; <2 tasks → action is a calm no-op.

### Tests for User Story 2

- [ ] T010 [P] [US2] Create `frontend/src/lib/forceRank.test.ts`: comparison count for N items stays ≤ ~N·log₂N and never hits N·(N−1)/2 (SC-002); single-winner placement is correct; `reconcile` drops missing IDs and appends new ones without losing answered comparisons (resume/drift).
- [ ] T011 [US2] Add `rankTasks_` coverage to `backend/SelfTest.js`: writes dense 1-based `somedayRank` over the submitted order, clears `somedayRank` on previously-ranked tasks absent from the order (no phantom ranks), appends exactly one `rank-someday` ActivityLog row, skips unknown IDs, and is idempotent on re-run. Exercise `rankTasks_` (the public/handler path), not just an inner helper.

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create `frontend/src/lib/forceRank.ts`: pure binary-insertion engine per [data-model.md](data-model.md) — `startSession`, `nextPair`, `applyAnswer`, `finalOrder`, `reconcile` over the `ForceRankSession` shape. No I/O.
- [ ] T013 [US2] In `backend/Api.js`: add `rankTasks_(payload, actor)` — read Tasks once, assign dense 1-based `somedayRank` over `order` (skip unknown IDs), clear `somedayRank` on ranked tasks not in `order`, batch-write under `LockService`, append one `rank-someday` ActivityLog entry; register `'tasks.rank'` in the dispatch map. Idempotent; validates `order` is an array (empty = clear all) per [contracts/api-021.md](contracts/api-021.md).
- [ ] T014 [P] [US2] (Optional but preferred) In `backend/Validation.js`/`backend/Config.js`: add a positive-integer validator/type for `somedayRank` so a non-blank value must be a positive integer (blank always valid).
- [ ] T015 [US2] In `frontend/src/hooks/useMutations.ts`: add `useRankTasks()` calling `tasks.rank` with `{ order }`, invalidating `['tasks']` on success (mirror existing mutation pattern).
- [ ] T016 [US2] Create `frontend/src/hooks/useForceRankSession.ts`: back the engine with `localStorage` (stable key), seed/resume via `reconcile` against current someday IDs, clear on complete/cancel — same-device resume (FR-013).
- [ ] T017 [US2] Create `frontend/src/components/task/ForceRankDialog.tsx`: the "this or that?" pairwise UI driven by `useForceRankSession`; shows two `TaskRow`/labels, one tap picks a winner and advances, progress affordance, on completion calls `useRankTasks` and on failure keeps the prior order + surfaces a "didn't save" toast (FR-016).
- [ ] T018 [US2] Wire the force-rank entry point into the Someday section (`TasksView.tsx`, and/or `SomedayList.tsx`): a control that opens `ForceRankDialog`, disabled/hidden as a calm no-op when fewer than two someday tasks exist (FR-014).
- [ ] T019 [P] [US2] Create `frontend/src/components/task/ForceRankDialog.test.tsx`: pairwise flow advances on selection, completes to a full order, calls the rank mutation, and on a rejected mutation shows the error while preserving the previous order; <2 tasks path is a no-op.
- [ ] T020 [US2] Manual-verify [quickstart.md](quickstart.md) Scenarios B & C (shared order across users; same-device resume); confirm one `rank-someday` log row and dense `1..N` in the Sheet.

**Checkpoint**: Someday tasks render in a persisted shared order that either user can (re)author.

---

## Phase 5: User Story 3 - The ranking absorbs everyday changes (Priority: P2)

**Goal**: New/never-ranked tasks land predictably at the bottom; scheduling/completing a ranked task doesn't scramble survivors; a task returning to Someday reappears at its preserved rank; concurrent changes don't duplicate or resurrect.

**Independent Test**: After a ranking, add a new undated task (→ bottom, others unchanged); schedule a ranked task away (survivors keep order); clear its date (→ returns at preserved rank); no dup/stale rows after refresh.

### Tests for User Story 3

- [ ] T021 [P] [US3] Extend `frontend/src/lib/tasks.test.ts` (and/or `tether` tests): a new blank-rank task sorts to the bottom of Someday without reordering ranked tasks (FR-017/018); removing a ranked task leaves survivors' relative order intact (FR-019); a re-added task with a preserved `somedayRank` slots back into position (FR-020).

### Implementation for User Story 3

- [ ] T022 [US3] Confirm/adjust that the render-order rules (T006/T007) and `rankTasks_` phantom-clear (T013) fully deliver FR-017–FR-021 — new tasks append unranked, scheduled/completed tasks drop out without renumbering survivors, returned tasks reappear at preserved rank; make any small correction needed (no design change expected).
- [ ] T023 [US3] Manual-verify [quickstart.md](quickstart.md) Scenario D (add / schedule-away / return) and the concurrent-change edge case.

**Checkpoint**: Ranking survives real day-to-day list churn.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T024 Verify save-failure path (quickstart Scenario E) and guard path (Scenario F) hold across the UI; confirm no partial order is ever shown as saved.
- [ ] T025 Run `/impeccable audit` on the new Someday section + ForceRankDialog; address findings before PR (DESIGN.md compliance, WCAG 2.1 AA, owner color as identity).
- [ ] T026 `cd frontend && npm run build && npm test` fully green; `cd backend && clasp push && clasp deploy -i <deploymentId>` and run `selfTest()` in the editor.
- [ ] T027 Update [BACKLOG.md](../../BACKLOG.md) stage for 021 (→ implement/deployed as appropriate) and note anything learned; keep the "start feature" loop bookkeeping current.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational: T002–T003)** blocks everything.
- **US1 (Phase 3)** depends only on Foundational; it is the **MVP** and can ship alone (renders all-blank ranks as title order).
- **US2 (Phase 4)** depends on Foundational; builds on US1's render path (the section is where the order shows). Backend T013/T011 are independent of the frontend engine T012 and can proceed in parallel.
- **US3 (Phase 5)** depends on US1 render rules + US2 `rankTasks_`; it is largely verification + minor hardening.
- **Polish (Phase 6)** after the desired stories are complete.

### Within stories

- Write/adjust tests (T004/T005, T010/T011, T021) before or alongside the implementation they cover; verify red→green.
- `lib` pure functions before the components that consume them (T006 before T008; T012/T016 before T017).

### Parallel opportunities

- T003 ∥ T002 (different files).
- US1: T004 ∥ T005 (test files); T007 ∥ T006's consumers (different file).
- US2: T010 (engine test) ∥ T011 (backend selftest) ∥ T012 (engine) ∥ T013/T014 (backend) — frontend engine and backend endpoint are independent until wiring (T015–T018).

---

## Implementation Strategy

1. **Foundational** (T002–T003) → field exists.
2. **US1** (T004–T009) → **STOP & VALIDATE** the Someday section; this is a deployable MVP on its own.
3. **US2** (T010–T020) → force-rank + persisted shared order.
4. **US3** (T021–T023) → resilience verification/hardening.
5. **Polish** (T024–T027) → impeccable audit, build/deploy/selfTest, backlog.

## Notes

- [P] = different files, no incomplete-task dependency.
- The whole feature is small: one backend column + one endpoint, a pure engine, a hook, one dialog, and the section. Keep the engine I/O-free so it stays unit-testable (Constitution IV).
- One shared ranking only — never per-owner (Constitution I).
