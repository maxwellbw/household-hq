---

description: "Task list for feature 014 — Home Dashboard"
---

# Tasks: Home Dashboard

**Input**: Design documents from `/specs/014-home-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-view.md, quickstart.md

**Tests**: Included. This codebase unit-tests its `lib/` pure logic (see `datetime.test.ts`,
`tasks.test.ts`, etc.) and the plan requires it. Component render test included per the
`SomedayList`/`CalendarHome` precedent.

**Organization**: Grouped by user story. Frontend-only, read-only, **no new dependencies**,
**no `clasp`/backend deploy**. All data comes from existing hooks (`useTasks`, `useEvents`,
`useRecurring`, `useSettings`, `useAuth`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md
- All paths are relative to repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the homes for the new code.

- [x] T001 Create the dashboard component directory `frontend/src/components/dashboard/` and a stub `frontend/src/lib/dashboard.ts` (typed empty exports for `smartViews`, `loadBalance`, `resolveViewer`, `highlights`) so later tasks have a landing spot.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Timezone range helpers + the nav/landing shell that every user story renders inside.

**⚠️ CRITICAL**: No user-story section can render until the shell (T004–T006) exists, and all three stories depend on the range helpers (T002).

- [x] T002 [P] Add timezone-aware range helpers to `frontend/src/lib/datetime.ts`: `weekendRange(timezone)` (current/upcoming **Fri–Sun**), `weekRange(timezone, weekStartsOn='sunday')`, `monthRange(timezone)` (each returns inclusive `{startKey,endKey}` day-keys), and `inRange(dayKey, range)`. Derive weekday via `Temporal.PlainDate.from(key).dayOfWeek` — no device `Date`.
- [x] T003 Add unit tests for the range helpers in `frontend/src/lib/datetime.test.ts` (weekend when today is a weekday vs. Fri/Sat/Sun; week Sunday-start boundaries; month first/last day; `inRange` inclusivity). Depends on T002.
- [x] T004 [P] Add `'home'` to the `NavSection` union and as the **first** entry (label "Home", icon `Home` from lucide-react) in `frontend/src/components/shell/navItems.ts`.
- [x] T005 [P] Create `frontend/src/components/dashboard/DashboardHome.tsx` shell: wire `useTasks`/`useEvents`/`useRecurring`/`useSettings`/`useAuth`, handle pending/error consistently with other views, and render placeholders for the three sections (read-only; no mutations).
- [x] T006 Set the dashboard as the landing view in `frontend/src/App.tsx`: initialize `active` to `'home'` and render `<DashboardHome />` for `'home'`; leave the calendar tab, owner filter, and Someday list unchanged. Depends on T004, T005.

**Checkpoint**: App boots to an (empty) dashboard; Calendar remains one tap away (FR-001, FR-007, SC-001).

---

## Phase 3: User Story 1 — Smart views: Today / Overdue / This weekend (Priority: P1) 🎯 MVP

**Goal**: At-a-glance answer to "what's due today, what's overdue, what's this weekend?"

**Independent Test**: With seeded tasks/events, the dashboard groups them into Today / Overdue / This weekend correctly, owner-colored, with calm empty states (quickstart Scenarios A–C).

- [x] T007 [US1] Implement `smartViews(tasks, events, timezone)` in `frontend/src/lib/dashboard.ts`: **Today** = open tasks with `dayKey(dueDate)==todayKey` + events whose day-range includes today; **Overdue** = open tasks with `dayKey(dueDate) < todayKey` (strictly before); **Weekend** = open tasks + overlapping events in `weekendRange`. Exclude non-open and undated tasks; keep Overdue and Today disjoint.
- [x] T008 [P] [US1] Unit tests for `smartViews` in `frontend/src/lib/dashboard.test.ts` (Scenario B; overdue vs today disjoint; multi-day event appears in weekend and, on Friday, in Today; undated/done excluded). Depends on T007.
- [x] T009 [US1] Create `frontend/src/components/dashboard/SmartViews.tsx` rendering the three groups with owner color coding **plus a non-color signal** (label/initial), reusing existing `TaskRow`/`EventContent` presentation patterns.
- [x] T010 [US1] Add calm, on-brand empty states per group in `SmartViews.tsx` (match `frontend/src/components/calendar/EmptyState.tsx` tone) — never a blank area (FR-011).
- [x] T011 [US1] Render `<SmartViews />` inside `frontend/src/components/dashboard/DashboardHome.tsx`.

**Checkpoint**: US1 is a complete, demonstrable MVP (smart views + dashboard-as-home).

---

## Phase 4: User Story 2 — Week & month load balance (Priority: P2)

**Goal**: "Who has more this week/month?" answered without counting — Max / Jaz / Both.

**Independent Test**: Seeded per-owner tasks produce correct week and month counts; `both` is standalone; completed excluded; shared account shows both by name (quickstart Scenario D).

- [x] T012 [US2] Implement `loadBalance(tasks, range)` (per-owner open-task counts `{max,jaz,both}`, `both` never folded into individuals, undated/non-open excluded) and `resolveViewer(session)` (acting person → "you", else names; shared → `null`) in `frontend/src/lib/dashboard.ts`.
- [x] T013 [P] [US2] Unit tests in `frontend/src/lib/dashboard.test.ts` (Scenario D: viewer=4/other=5; `both` standalone; completed excluded; month ≥ week; shared account has no "you", never an owner — FR-009). Depends on T012.
- [x] T014 [US2] Create `frontend/src/components/dashboard/LoadBalance.tsx` showing week + month counts for Max/Jaz/Both with an at-a-glance "who has more" framing (viewer as "you") and owner colors meeting WCAG AA.
- [x] T015 [US2] Render `<LoadBalance />` inside `frontend/src/components/dashboard/DashboardHome.tsx`.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Contextual highlights (Priority: P3)

**Goal**: A few warm, sparse callouts (noteworthy events, rare chores) — or nothing.

**Independent Test**: Seeded weekend/multi-day event and a quarterly chore surface as highlights; weekly chores don't; nothing noteworthy → no highlights (quickstart Scenario E).

- [x] T016 [US3] Implement `highlights(events, recurring, tasks, timezone)` in `frontend/src/lib/dashboard.ts`: return ≤3 callouts — noteworthy events within ~7 days that are multi-day or on the weekend (with day-range detail), and rare chores = open tasks whose linked `recurringId` rule `cadence ∈ {quarterly, annually}` due within ~14 days; return `[]` when none qualify.
- [x] T017 [P] [US3] Unit tests in `frontend/src/lib/dashboard.test.ts` (Scenario E: quarterly highlighted, weekly not; cap ≤3; no filler → `[]`). Depends on T016.
- [x] T018 [US3] Create `frontend/src/components/dashboard/Highlights.tsx` (sparse callouts, owner-colored, plain warm phrasing; renders nothing/calm empty line when the list is empty — never filler, FR-010).
- [x] T019 [US3] Render `<Highlights />` inside `frontend/src/components/dashboard/DashboardHome.tsx`.

**Checkpoint**: All three view stories independently functional.

---

## Phase 6: User Story 4 — Governance amendment (Priority: P1, gating) 🔒

**Goal**: Amend the "calendar is home" principle to "dashboard is home." **Gates merge — Max must co-approve** (constitution amendment process); does not gate the code work above.

**Independent Test**: `PRODUCT.md`, `DESIGN.md`, the constitution, and `CLAUDE.md` no longer assert calendar-as-landing; all describe the dashboard as home with the calendar as primary secondary navigation (quickstart Scenario G).

- [x] T020 [P] [US4] Amend `DESIGN.md`: change "Calendar is home." (and the "Surface: a calendar-first…" line) to describe the **dashboard** as the landing view, calendar as primary secondary navigation.
- [x] T021 [P] [US4] Amend `PRODUCT.md`: update the "calendar-first tool / calendar is home" statement and the "Calendar first, everything else in service of it" principle to dashboard-first landing (calendar remains the organizing metaphor for scheduled items).
- [x] T022 [US4] Amend `.specify/memory/constitution.md`: update the Development Workflow "calendar-first" wording, bump **Version 1.0.0 → 1.1.0** (MINOR), update **Last Amended** date, and add a Sync Impact Report entry noting DESIGN.md/PRODUCT.md/CLAUDE.md co-updates.
- [x] T023 [US4] Update `CLAUDE.md` Design Context (and any "calendar-first" mention) to state the dashboard is home, keeping it consistent with the amended docs.

**Checkpoint**: Amendment ready for Max's co-approval; PR must not merge before it.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T024 Add `frontend/src/components/dashboard/DashboardHome.test.tsx`: render test with seeded query-client data — app lands on dashboard, all three sections present, quiet-week shows only calm empty states (SC-006).
- [x] T025 Run `/impeccable audit` on the dashboard UI; fix any owner-color contrast / WCAG 2.1 AA findings (SC-005) and general polish.
- [x] T026 `cd frontend && npm run build && npm test` green (no type errors); walk quickstart.md Scenarios A–F locally.
- [x] T027 Update `BACKLOG.md` (stage → built / PR link) and the "Currently active" note per the start-feature loop.

---

## Dependencies & Execution Order

- **Setup (T001)** → no deps.
- **Foundational (T002–T006)** → after T001. T003 needs T002; T006 needs T004+T005. **Blocks all stories.**
- **US1 (T007–T011)** → after Foundational. T008 needs T007; T009–T011 need T007 + the shell.
- **US2 (T012–T015)** → after Foundational. Independent of US1 (renders in the same shell).
- **US3 (T016–T019)** → after Foundational. Independent of US1/US2.
- **US4 (T020–T023)** → doc-only; can be done any time on this branch; **gates merge**, not code.
- **Polish (T024–T027)** → after the view stories you intend to ship.

### Parallel opportunities

- Foundational: T002, T004, T005 are different files → parallel; T003 follows T002; T006 follows T004+T005.
- Each story's test task (T008, T013, T017) is [P] once its logic task lands.
- US1, US2, US3 can be built in parallel after Foundational (they touch separate section files + separate functions in `dashboard.ts`; coordinate the shared `dashboard.ts`/`DashboardHome.tsx` edits).
- US4 doc edits T020, T021 are [P] (different files); T022/T023 follow to keep versions consistent.

---

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** (Scenarios A–C). Dashboard-as-home + smart views is a shippable increment.

### Incremental delivery

US1 (MVP) → US2 (load balance) → US3 (highlights), each independently testable. US4 (amendment) prepared in parallel and **co-approved by Max before the PR merges**. Polish (T024–T027) closes out build/test/audit/BACKLOG.

---

## Notes

- Frontend-only, read-only: no backend edit, no `clasp` deploy, no ActivityLog writes.
- No new npm dependencies (Constitution IV) — reuse `temporal-polyfill`, react-query, lucide-react, existing owner/date helpers.
- All date bucketing via household timezone helpers in `lib/datetime.ts` — never the device clock.
- **Do not merge** until the US4 amendment (T020–T023) is co-approved by Max.
