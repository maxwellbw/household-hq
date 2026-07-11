---
description: "Task list for feature 017 — Calendar views & 7-day surfaces"
---

# Tasks: Calendar views & 7-day surfaces

**Input**: Design documents from `/specs/017-calendar-views/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: INCLUDED — the project has an established Vitest + @testing-library suite (150 green at
baseline) and the plan/research call for unit + component coverage. Pure helpers get unit tests;
new components get component tests.

**Scope note**: Frontend-only, presentation over existing data. **No backend, Sheet, trigger, or
stored-field changes; no `clasp` deploy.** All paths are under `frontend/`.

**Shared-file note**: `frontend/src/components/calendar/CalendarHome.tsx` is touched by US1, US2,
US4, and US6 — those edits are sequential on that file (not `[P]` with each other).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US7 per spec.md
- Exact file paths included

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before changes.

- [X] T001 Verify baseline green in `frontend/`: run `npm run test` and `npm run build` (zero type errors) and note the passing test count.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared date helpers used by more than one story (US1 next-7 + US7 strip).

**⚠️ CRITICAL**: Complete before starting US1/US7.

- [X] T002 [P] Add `nextNDaysRange(n: number, tz?)` to `frontend/src/lib/datetime.ts` — returns a `DayRange` from today → today+(n-1) inclusive, household-tz based (reuse `todayKey`/Temporal `PlainDate`).
- [X] T003 [P] Unit tests for `nextNDaysRange` in `frontend/src/lib/datetime.test.ts` (today-first, correct span, month-boundary crossing).

**Checkpoint**: Shared helpers available.

---

## Phase 3: User Story 1 - Week & Next-7 views (Priority: P1) 🎯 MVP

**Goal**: A view switcher offering a fixed Sun–Sat **Week** and a rolling **Next 7 days**, both rendered as all-day day-list columns with owner-colored chips, on desktop and mobile.

**Independent Test**: Select Week → exactly Sun–Sat of the current week; select Next 7 days → today first + 6 days; both show owner-colored chips; prev/next moves a week / shifts the window; works at mobile width.

### Tests for User Story 1

- [X] T004 [P] [US1] Component test: `DayListView` renders 7 Sunday-first columns in `week` mode and today-first columns in `next7` mode, with owner colors, in `frontend/src/components/calendar/DayListView.test.tsx`.
- [X] T005 [P] [US1] Component test: `CalendarViewSwitcher` shows Month/Week/Next-7 and toggles mode (desktop + mobile) with correct `aria-pressed`/`aria-current`, in `frontend/src/components/calendar/CalendarViewSwitcher.test.tsx`.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create `frontend/src/components/calendar/DayColumn.tsx` — one day's header (today emphasis) + owner-colored chips reusing `EventContent` visual language (owner edge/tint/dot/initial); empty day renders an empty column.
- [X] T007 [US1] Create `frontend/src/components/calendar/DayListView.tsx` — modes `week` | `next7` | `day`; Sunday-first for `week` (reuse `weekRange`), today-first for `next7` (use `nextNDaysRange(7)`), single day for `day`; buckets owner-filtered items by `dayKey`; prev/next nav (±7 for week/next7, ±1 for day); reuses parent `onEventClick` routing. Depends on T006.
- [X] T008 [P] [US1] Create `frontend/src/components/calendar/CalendarViewSwitcher.tsx` — labeled control group Month/Week/Next-7; renders on both breakpoints; `mode`/`onChange`/`isMobile` props per `contracts/ui-contract.md`.
- [X] T009 [US1] Wire into `frontend/src/components/calendar/CalendarHome.tsx`: hold `mode: CalendarViewMode`; render `CalendarViewSwitcher` above the calendar; `month` → existing Schedule-X (month-grid desktop / month-agenda mobile), `week`/`next7` → `DayListView` fed by the same in-memory item model; preserve empty-state + detail-sheet routing. Depends on T007, T008.

**Checkpoint**: US1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Sunday-start everywhere (Priority: P1)

**Goal**: Every week-oriented surface starts on Sunday.

**Independent Test**: Month grid leftmost header is Sunday; week view first day is Sunday; "this week" math runs Sun–Sat.

- [X] T010 [US2] Set `firstDayOfWeek: 7` in the Schedule-X config in `frontend/src/components/calendar/CalendarHome.tsx` (installed build: MONDAY=1…SUNDAY=7). Sequential with other CalendarHome edits.
- [X] T011 [P] [US2] Audit `frontend/src/lib/datetime.ts` week helpers and their callers (dashboard `weekRange`, etc.) to confirm all week grouping is Sunday-based; add/adjust a regression test in `frontend/src/lib/datetime.test.ts` if a gap is found.

**Checkpoint**: Sunday-start consistent across month, week views, and dashboard math.

---

## Phase 5: User Story 6 - Overdue tasks surface on today (Priority: P2)

**Goal**: Open standalone tasks past due render on **today** with an Overdue badge, display-only, stored date untouched, today-only.

**Independent Test**: A past-due open task shows on today with an Overdue badge and not on its original date; raw `dueDate` unchanged; completing/rescheduling clears it.

### Tests for User Story 6

- [X] T012 [P] [US6] Unit tests in `frontend/src/lib/datetime.test.ts` for `isOverdue` (open + past due = true; due today = false; done/snoozed = false; no dueDate = false).
- [X] T013 [P] [US6] Unit test for the overdue-remap (today-only placement, original date omitted, `dueDate` unchanged) — co-locate with the mapping helper's test file.

### Implementation for User Story 6

- [X] T014 [P] [US6] Add `isOverdue(task, todayKey)` to `frontend/src/lib/datetime.ts` (`status==='open' && !!dueDate && dueDate < todayKey`).
- [X] T015 [US6] In `frontend/src/components/calendar/CalendarHome.tsx` (and the `DayListView` item model), remap open past-due standalone tasks to **today** with `_overdue: true` and omit them from their original date; non-overdue dated tasks keep their real date. Depends on T014. Sequential with other CalendarHome edits.
- [X] T016 [US6] Render a distinct **Overdue** badge (text + color, not color-only) on `_overdue` task chips in `frontend/src/components/calendar/EventContent.tsx`.

**Checkpoint**: Overdue-on-today works in month + week/next-7 (shared model), no stored writes.

---

## Phase 6: User Story 7 - Dashboard rolling 7-day strip (Priority: P2)

**Goal**: Seven day-tiles (today first) with owner-colored dots/counts; tapping a tile opens the calendar on that date.

**Independent Test**: Dashboard shows 7 today-first tiles with owner summaries (empty tiles present); tapping opens the calendar focused on that date.

### Tests for User Story 7

- [X] T017 [P] [US7] Unit test for the day-tile summary helper (counts by owner over next 7 days, today-first, empty days = zeroed-but-present) in `frontend/src/lib/dashboard.test.ts`.
- [X] T018 [P] [US7] Component test: `SevenDayStrip` renders exactly 7 today-first tiles, owner counts, empty tiles present, and calls `onOpenDate` on tap, in `frontend/src/components/dashboard/SevenDayStrip.test.tsx`.

### Implementation for User Story 7

- [X] T019 [P] [US7] Add a `sevenDayTiles(events, tasks, tz)` helper to `frontend/src/lib/dashboard.ts` producing `DayTileSummary[]` per `data-model.md` (uses `nextNDaysRange(7)`, `dayKey`).
- [X] T020 [US7] Create `frontend/src/components/dashboard/SevenDayStrip.tsx` — 7 tiles, owner-colored dots/counts, empty tiles present, tiles are buttons with accessible names; `onOpenDate` prop. Depends on T019.
- [X] T021 [US7] Render `SevenDayStrip` in `frontend/src/components/dashboard/DashboardHome.tsx`.
- [X] T022 [US7] Deep-link wiring in `frontend/src/App.tsx`: lift `calendarFocusDate`; Dashboard `onOpenDate` sets it + switches `active` to `'calendar'`; add optional `focusDate` prop to `frontend/src/components/calendar/CalendarHome.tsx` seeding Schedule-X `selectedDate` once. Depends on T020. Sequential with other CalendarHome edits.

**Checkpoint**: Strip + calendar deep-link functional.

---

## Phase 7: User Story 4 - De-cluttered desktop month grid (Priority: P2)

**Goal**: Dense desktop month cells show compact chips + "+N more"; activating it jumps to that day's list.

**Independent Test**: A day with ≥5 items shows bounded chips + "+N more" without overflowing the row; activating it opens a single-day list of all that day's items; sparse days show no "+N more".

- [X] T023 [US4] In `frontend/src/components/calendar/CalendarHome.tsx`, add `monthGridOptions: { nEventsPerDay }` and wire `onClickPlusEvents(date)` → switch `mode` to single-day `DayListView` anchored on that date. Depends on US1 `DayListView` (T007). Sequential with other CalendarHome edits.
- [X] T024 [P] [US4] Confirm (quickstart Scenario D) a capped cell stays within one grid row at desktop widths and tune `nEventsPerDay` (3–4); record the chosen value in a code comment.

**Checkpoint**: Month grid de-cluttered; overflow jumps to day view.

---

## Phase 8: User Story 3 - Month navigation on mobile (Priority: P2)

**Goal**: Prev/next month controls visible + full month reachable on phone widths.

**Independent Test**: On mobile width, prev/next month controls are visible without horizontal scroll and change the month; a tall month scrolls so every week is reachable.

- [X] T025 [US3] Adjust `frontend/src/components/calendar/calendar-theme.css` so month prev/next controls are visible/tappable on mobile and the month content scrolls (no cut-off weeks).
- [X] T026 [P] [US3] Responsive verification per quickstart Scenario C at mobile width (record result); add a note if a wrapper control is needed beyond CSS.

**Checkpoint**: Mobile month navigation is a working surface, not a dead-end.

---

## Phase 9: User Story 5 - Prep-task progress on event chips (Priority: P3)

**Goal**: Event chips show "M/N tasks" (done/total); no indicator when no prep tasks.

**Independent Test**: Event with a prep checklist shows "M/N tasks" matching state; completing a prep task updates it; no-prep events show nothing.

### Tests for User Story 5

- [X] T027 [P] [US5] Update `frontend/src/lib/tether.test.ts` to assert `doneTaskCount`/`totalTaskCount` derivation on `EventWithTasks`.
- [X] T028 [P] [US5] Component test: `EventContent` renders "M/N tasks" when total>0 and nothing when total===0, in `frontend/src/components/calendar/EventContent.test.tsx`.

### Implementation for User Story 5

- [X] T029 [P] [US5] Extend `EventWithTasks` in `frontend/src/lib/tether.ts` with `totalTaskCount = tasks.length` and `doneTaskCount = tasks.filter(t => t.status==='done').length`.
- [X] T030 [US5] In `frontend/src/components/calendar/EventContent.tsx`, render "{done}/{total} tasks" when total>0 (replace the current "{open} prep tasks" text); render none when total===0. Depends on T029.

**Checkpoint**: Prep progress visible and reactive.

---

## Phase 10: Polish & Cross-Cutting

- [X] T031 [P] Run quickstart.md Scenarios A–G on desktop **and** mobile widths; record results.
- [X] T032 [P] Run `/impeccable audit` on new/changed UI (switcher, day columns, day-tiles, overdue badge, "+N more"); fix any WCAG 2.1 AA issues.
- [X] T033 Ensure `npm run test` + `npm run build` green; confirm no new backend writes / stored fields (SC-008).
- [X] T034 Update `BACKLOG.md` (017 stage → implemented/pending PR) and any spec deltas discovered during implementation.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** → user stories.
- **US1 (P1)** is the MVP and provides `DayListView`, which **US4 (T023)** reuses — so US4 follows US1.
- **US2, US6, US7, US3, US5** are otherwise independent; US6/US7 depend only on the foundational helpers.
- **Shared file** `CalendarHome.tsx`: T009 (US1) → T010 (US2) → T015 (US6) → T022 (US7) → T023 (US4) are sequential edits to the same file; do not parallelize them with each other.
- **EventContent.tsx**: T016 (US6 badge) and T030 (US5 progress) both edit it — sequence them.
- **Polish** last.

### Parallel Opportunities

- T002 ∥ T003 (helper + its test spec authoring).
- Within US1: T004/T005 (test specs) and T006/T008 (DayColumn, Switcher — different files) can run in parallel; T007 then T009 are sequential.
- Across stories after US1: US7 (dashboard files) and US5 (tether/EventContent) touch mostly different files and can progress in parallel, minding the EventContent sequencing note.

---

## Implementation Strategy

### MVP First
1. Setup + Foundational.
2. US1 (Week & Next-7 views) → validate independently → this is the headline deliverable.

### Incremental Delivery
US1 → US2 → US6 → US7 → US4 → US3 → US5, validating each against its Independent Test, then Polish. Each story adds value without breaking the previous.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Every state-changing action (completing/rescheduling an overdue task) uses **existing** logged mutations — this feature adds none.
- Verify new tests fail before implementing where practical; keep the suite green.
- No `clasp`/backend deploy for this feature.
