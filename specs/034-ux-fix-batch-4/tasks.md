---

description: "Task list for feature 034 — UX fix batch 4"
---

# Tasks: UX Fix Batch 4

**Input**: Design documents from `/specs/034-ux-fix-batch-4/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-behavior.md, quickstart.md

**Tests**: Included — the project's Definition of Done and SC-006 require new behavior to be covered by tests (Vitest for frontend, SelfTest.js for backend).

**Organization**: By user story (priority order). The five stories are independent and independently shippable; only the noted ListsView.tsx overlap between US3 and US4 must be sequenced.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 per spec.md

## Path Conventions

Web app: `backend/*.js` (Apps Script, flat), `frontend/src/**`. Tests are co-located `*.test.ts(x)` (frontend) or in `backend/SelfTest.js`.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before changes.

- [X] T001 Confirm baseline is green: `cd frontend && npm run build && npm test` pass on branch `034-ux-fix-batch-4` before edits.

---

## Phase 2: Foundational (Blocking Prerequisites)

**No foundational tasks.** The five stories touch disjoint code paths and share no blocking infrastructure; each can be implemented and tested on its own. Proceed directly to the story phases.

---

## Phase 3: User Story 1 — Book a dog walk over a conflict (Priority: P1) 🎯 MVP

**Goal**: Make the already-built backend override reachable — Book/Book-backup enabled for conflict/gate windows, blocked only for out-of-band windows.

**Independent Test**: On a fully-busy/gate-failing day, select such a window → Book is enabled → "Book anyway" confirm → walk books; an out-of-band window stays disabled. (quickstart US1)

### Implementation for User Story 1

- [X] T002 [US1] In `frontend/src/components/dashboard/DogWalkPlanner.tsx`, change `validatePendingWindow` (and its use for the backup slot) to return a reason **category** — `'out-of-band' | 'conflict' | 'gate' | 'ok'` — alongside the existing human `reason` string, instead of a bare `ok` boolean. Out-of-band = start/end outside `range`; conflict = busy overlap; gate = overlapped failing hour.
- [X] T003 [US1] In the same file, bind the **Book** and **Book backup** buttons' `disabled` to `bookWalk.isPending || category === 'out-of-band'` (not to any `!ok`). Keep the warning `reason` text visible for `conflict`/`gate` so the user sees why before committing. Confirm the existing `OVERRIDE_REQUIRED` → "Book anyway" (`confirmOverride: true`) path is reached on submit.
- [X] T004 [P] [US1] Update/extend `frontend/src/components/dashboard/DogWalkPlanner.test.tsx`: (a) a conflict/gate window leaves Book enabled and, on click + mocked `OVERRIDE_REQUIRED`, shows "Book anyway"; (b) an out-of-band window keeps Book disabled; (c) backup slot mirrors (a)/(b).

**Checkpoint**: US1 fully functional and testable independently.

---

## Phase 4: User Story 2 — Schedule a someday task without friction (Priority: P2)

**Goal**: Someday rows behave like every other task row (title → details), the overflow menu has a real Schedule item and no dead items, and the schedule dialog pre-selects the task's owner.

**Independent Test**: quickstart US2 — title opens detail sheet; ⋮ menu shows working Schedule and no dead items; dialog owner pre-selected; date+confirm schedules; cancel is a no-op.

### Implementation for User Story 2

- [X] T005 [P] [US2] In `frontend/src/components/task/ScheduleTaskDialog.tsx`, add an optional `initialOwner?: Owner` prop and seed `useState<Owner | null>(initialOwner ?? null)`. Owner stays changeable; date remains required to confirm.
- [X] T006 [US2] In `frontend/src/components/task/TaskRow.tsx`, add an optional `onSchedule?: () => void` prop and render a **Schedule** menu item when it's provided. Render each overflow-menu item **only when its handler is defined** (Snooze only if `onSnooze`, Edit due only if `onEditDue`, Schedule only if `onSchedule`) so no dead no-op items appear; if the menu would be empty, don't render the ⋮ trigger.
- [X] T007 [US2] In `frontend/src/components/task/TasksView.tsx`, change the Someday-section `TaskRow` wiring: `onDetail={() => { setDetailTask(task); setDetailEdit(false) }}` (open detail like other rows) and `onSchedule={() => onScheduleSomeday?.(task.id)}`. Pass the task's owner through to the schedule dialog as `initialOwner` (thread an owner alongside the existing `onScheduleSomeday(taskId)` — e.g. widen it to `(taskId, owner)` or look the task up where the dialog is rendered).
- [X] T008 [US2] (Reworked — simpler) `ScheduleTaskDialog` now self-seeds the owner from the warm `tasks` query (`useTasks`) by `taskId`, so **no** App.tsx/callback widening was needed; this also pre-seeds the owner on the calendar drag-drop schedule path. `initialOwner` remains an optional override for tests.
- [X] T009 [P] [US2] Update tests: `frontend/src/components/task/ScheduleTaskDialog.test.tsx` (owner pre-selected from `initialOwner`, date still required); `frontend/src/components/task/TaskRow.test.tsx` (no dead menu items; Schedule item fires `onSchedule`); `frontend/src/components/task/TasksView.test.tsx` (someday title opens detail, not the schedule dialog).

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Last-stocked date (Priority: P3)

**Goal**: Record when an item was last stocked and show it in the All view.

**Independent Test**: quickstart US3 — mark stocked → row shows "stocked <date>" in All view; toggle to needed preserves it; never-stocked shows nothing; sheet holds plain ISO; selfTest green.

### Backend

- [X] T010 [US3] In `backend/Config.js`, append `'stockedAt'` to `HEADERS.ListItems`. Do **not** add it to the mutable/updatable field set; ensure it is treated as server-managed (like `status`) so `createListItem_`/`updateListItem_` cannot set it (add an explicit rejection/strip if a client supplies it, mirroring the existing `status` guards in `backend/Lists.js`).
- [X] T011 [US3] In `backend/Lists.js` `setListItemStatus_`, when `targetStatus === 'stocked'` set `merged.stockedAt` to the household-local ISO-with-offset now (reuse the existing `isoWithOffset_`/date helper used elsewhere in backend); on `→ need` leave `stockedAt` untouched. Keep it inside the existing `withLock_`/no-op-when-unchanged path; no new log action.
- [X] T012 [P] [US3] In `backend/SelfTest.js`, add coverage: toggling to `stocked` sets a non-empty `stockedAt`; toggling back to `need` preserves it; a no-op toggle doesn't change it; `createListItem_`/`updateListItem_` reject/ignore a client-supplied `stockedAt`.

### Frontend

- [X] T013 [P] [US3] In `frontend/src/types/domain.ts`, add `stockedAt?: string` to `ListItem`.
- [X] T014 [US3] In `frontend/src/components/lists/ListItemRow.tsx`, add an optional `showStockedDate?: boolean` prop; when true and `item.stockedAt` is non-empty, render "stocked <short date>" (household tz, via the existing `datetime` formatter) in the row; empty/absent shows nothing.
- [X] T015 [US3] In `frontend/src/components/lists/ListsView.tsx`, pass `showStockedDate` only at the **All**-view `ListItemRow` call site(s) (not the Needed view).
- [X] T016 [P] [US3] Update `frontend/src/components/lists/ListItemRow.test.tsx`: shows the date when `showStockedDate` + `stockedAt` present; hidden when absent or in Needed view.

**Checkpoint**: US1–US3 independently functional. (Note: T014/T015 touch ListsView.tsx — sequence before or coordinate with US4's ListsView changes.)

---

## Phase 6: User Story 4 — All-view sort/group/order (Priority: P3)

**Goal**: Two independent All-view toggles and the two-block (stocked-above-needed) arrangement.

**Independent Test**: quickstart US4 — default = two blocks natural order; A–Z sorts within blocks; group-by-section groups within each block; unchecked never above checked in any combination.

### Implementation for User Story 4

- [X] T017 [P] [US4] In `frontend/src/lib/lists.ts`, add a pure `arrangeAllView(items, { alphabetical, groupBySection })` helper implementing: global split into `stocked` block then `need` block; within each block, group by `LIST_SECTIONS` (unsectioned → 'other', empty sections omitted) when `groupBySection`, else one run; sort by name (locale, case-insensitive, stable) when `alphabetical`, else natural order. Deterministic/stable output. Return shape per contracts/ui-behavior.md C4.
- [X] T018 [P] [US4] Add `frontend/src/lib/lists.test.ts` cases for `arrangeAllView`: two-block invariant (no need above stocked) across all four toggle combinations; section grouping/order + Other bucket; alphabetical stability; empty-section omission.
- [X] T019 [US4] In `frontend/src/components/lists/ListsView.tsx`, add two boolean toggle states (`alphabetical`, `groupBySection`) surfaced as controls in the **All** view only; render the All view from `arrangeAllView(...)` output (section headings reuse `LIST_SECTION_LABELS`). Preserve the Needed view unchanged. Keep the US3 `showStockedDate` prop on the rows.
- [X] T020 [US4] Update `frontend/src/components/lists/ListsView.test.tsx`: toggles present only in All view; toggling rearranges as specified; unchecked-below-checked invariant holds.

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 — Staples count on the dashboard nudge (Priority: P3)

**Goal**: Nudge states the needed-staples count.

**Independent Test**: quickstart US5 — nudge reads "Running low on staples — N needed" matching the current count (grammatical for N=1).

### Implementation for User Story 5

- [X] T021 [P] [US5] In `frontend/src/components/dashboard/GroceryNudge.tsx`, add a `count: number` prop and render it in the banner text ("Running low on staples — {count} needed", singular-correct for 1). Keep the calm tone and the navigate affordance.
- [X] T022 [US5] In `frontend/src/components/dashboard/DashboardHome.tsx`, compute the staple-needed count via the existing `groceryNeededStapleCount(listItems)` and pass it as `count` to `GroceryNudge` (alongside the existing `show`).
- [X] T023 [P] [US5] Update `frontend/src/components/dashboard/GroceryNudge.test.tsx` (create if absent): renders the count; singular vs plural wording; hidden when `show` is false.

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting

- [X] T024 [P] Run `/impeccable audit` on the changed UI (planner confirm bar, someday rows + schedule dialog, list rows/All-view controls, dashboard nudge); address findings.
- [X] T025 Full green: `cd frontend && npm run build && npm test` (no type errors, all tests pass).
- [X] T026 Backend deploy for US3: `cd backend && clasp push`, run `setupDatabase()` once (adds `stockedAt` column), run `selfTest` (green), then `clasp deploy -i <deploymentId>` to refresh the existing web-app URL.
- [X] T027 Live validation per `quickstart.md` — includes the US2 browser walkthrough to confirm the someday flow's feel/copy; write back any spec/copy changes. Mint a dev session token if needed (`clasp run mintDevSessionToken`).
- [X] T028 Update `BACKLOG.md` stage to "implemented, pending PR" and note the one-time `setupDatabase()` run in the deploy notes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: none (empty).
- **User Stories (Phases 3–7)**: independent; may proceed in any order. Recommended priority order US1 → US2 → US3 → US4 → US5.
- **Polish (Phase 8)**: after the desired stories are complete.

### Cross-story note

- **US3 and US4 both edit `frontend/src/components/lists/ListsView.tsx`** — do them in sequence (US3 first, then US4 wraps the All-view rendering), not in parallel. All other stories touch disjoint files.

### Within each story

- Implementation then its co-located tests (or tests alongside). US3 backend (T010–T012) before US3 frontend display is meaningful end-to-end, but the frontend type/display tasks can be built against the contract in parallel.

### Parallel Opportunities

- Across stories: US1, US2, US5 touch fully disjoint files and could be done in parallel by different people.
- Marked `[P]` tasks within a story (mostly the test files and the pure `lists.ts` helper) are parallel-safe.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 baseline → 2. US1 (T002–T004) → 3. Validate per quickstart US1 → ship the P1 bug fix.

### Incremental Delivery

US1 (P1 bug) → US2 → US3 (needs the one-time `setupDatabase()` + redeploy) → US4 → US5, validating each per quickstart, then Phase 8 polish and one PR for the batch.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Backend `stockedAt` is server-managed and plain ISO text — keeps the sheet hand-editable (constitution II) and reuses the existing lock + `list-item-stocked` log (constitution V/VI).
- No new API endpoints; US3 only widens the `listItems.list` item shape and the toggle write.
- Commit after each story or logical group; the whole batch merges as one PR (feature 034).
