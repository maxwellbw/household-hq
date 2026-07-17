---
description: "Task list for Bug-fix batch 4"
---

# Tasks: Bug-fix batch 4

**Input**: Design documents from `/specs/029-bug-fix-batch-4/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: Included — this repo tests every component (`*.test.tsx`) and backend suite (`selfTest*`). Test tasks accompany each story per house convention.

**Organization**: Grouped by user story (priority order from spec.md). The seven stories are mutually independent — any subset can ship. Recommended order = priority order (US1 → US7).

## Path Conventions

Web app: `frontend/src/…` (Vite + React + TS), `backend/*.js` (Apps Script). No new top-level dirs.

---

## Phase 1: Setup (baseline)

**Purpose**: Confirm a green starting point before touching anything.

- [ ] T001 Confirm baseline is green: `cd frontend && npm install && npm test && npm run build` (record the current test count), and `cd backend && clasp push && clasp run selfTestDogWalk` → `DOG WALK: ALL PASS`.
- [ ] T002 Start the local preview and sign in with a dev-session token: `cd frontend && npm run dev`, mint a token via `cd backend && clasp run mintDevSessionToken`, set `localStorage['hq.sessionToken']` in the preview, reload, and confirm the dashboard + calendar load (needed to reproduce US4/US7 live).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None. The seven fixes share no blocking prerequisite — each story's tasks are self-contained. Proceed directly to the story phases.

*(No foundational tasks.)*

---

## Phase 3: User Story 1 — Walks in the Day Peek + times (Priority: P1)

**Goal**: The dashboard Day Peek shows the peeked day's dog walk(s) with their time window, alongside events/tasks.

**Independent Test**: Tap a day with a booked walk → a 🐾 walk row with its `start–end` time appears; a day with none shows no walk row (quickstart US1).

- [ ] T003 [P] [US1] Add a `walksForDay(walks, dateKey, timezone)` selector (booked/suggested + needs-decision walks for that date, returning display time window) to `frontend/src/lib/dogwalks.ts`.
- [ ] T004 [P] [US1] Add unit tests for `walksForDay` (match day, multiple walks/day, needs-decision entry, empty day) in `frontend/src/lib/dogwalks.test.ts`.
- [ ] T005 [US1] Add a `PeekWalkRow` and a `walks` prop to `frontend/src/components/dashboard/DayPeekPanel.tsx`: render each walk with owner-`both` dot/🐾, `windowStart–windowEnd` via `formatTime`, and a needs-decision affordance (⚠️); keep event/task rows and the empty state intact.
- [ ] T006 [US1] Thread walks into the panel from `frontend/src/components/dashboard/DashboardHome.tsx`: pass `useDogWalks()` data (filtered via `walksForDay`) to `DayPeekPanel` for the selected day.
- [ ] T007 [US1] Update `frontend/src/components/dashboard/DayPeekPanel.test.tsx`: walk row renders with time window; needs-decision styling; no walk row when none; events/tasks unaffected.
- [ ] T008 [US1] `npm test` + `npm run build` green; live-check in preview per quickstart US1 (screenshot a day with a walk).

**Checkpoint**: Day Peek surfaces walks with times, independently shippable.

---

## Phase 4: User Story 2 — Done tasks read as done everywhere (Priority: P1)

**Goal**: Done tasks show `line-through` + de-emphasis on every task surface (Tasks tab & Day Peek already do; add detail sheet title + calendar chips).

**Independent Test**: Mark a task done → struck in Tasks tab, Day Peek, calendar chip, and detail sheet; open/snoozed never struck; toggling back removes it (quickstart US2).

- [ ] T009 [P] [US2] Strike done task chips in `frontend/src/components/calendar/EventContent.tsx`: when `_kind === 'task'` and the raw task `status === 'done'`, apply `line-through text-ink-faint` to the title span (covers month grid + day/week/next-7 lists, which reuse this component).
- [ ] T010 [P] [US2] Strike the title in `frontend/src/components/task/TaskDetailSheet.tsx` (`<h2>`, line ~89) when `task.status === 'done'`.
- [ ] T011 [US2] Update `frontend/src/components/calendar/EventContent.test.tsx` (done task chip struck; open/overdue not struck) and `frontend/src/components/task/TaskDetailSheet.test.tsx` (done title struck) — create the detail-sheet test assertion if absent.
- [ ] T012 [US2] `npm test` + `npm run build` green; live-check a done task across all four surfaces per quickstart US2.

**Checkpoint**: Done styling consistent everywhere.

---

## Phase 5: User Story 3 — Dismissed notices stay dismissed on refetch (Priority: P2)

**Goal**: A dismissed acknowledge / dog-walk notice stays hidden across in-session refetch and reload, reappearing only for a genuinely new underlying item.

**Independent Test**: Dismiss each notice → refocus tab (in-session refetch) with no underlying change → stays hidden; a new item re-shows a notice for that item only (quickstart US3).

- [ ] T013 [P] [US3] Add a `dogWalkNotices(walks, timezone)` selector to `frontend/src/lib/dogwalks.ts` that maps needs-decision walks to `{ key: dogWalkNoticeKey(...), date, slot, reason }` and filters by `isDismissed(key)` (mirrors `lib/ackNotices.ts`).
- [ ] T014 [US3] Refactor `frontend/src/components/dashboard/DogWalkNotice.tsx` to consume the persisted-filtered notices (via T013 or an inline `isDismissed(key) || dismissedThisSession.has(key)` filter) so dismissal survives remount/refetch; keep the immediate session-hide on click.
- [ ] T015 [US3] Belt-and-suspenders: make `frontend/src/components/dashboard/AckNotices.tsx` also honor persisted `isDismissed()` on render (its selector already filters, but guard the component too), and confirm `DashboardHome.tsx` wiring passes the right inputs.
- [ ] T016 [US3] Add/extend tests: `frontend/src/components/dashboard/DogWalkNotice.test.tsx` (dismissed stays hidden after a simulated remount/refetch; new reason re-shows) and a `dogWalkNotices` selector test in `frontend/src/lib/dogwalks.test.ts`.
- [ ] T017 [US3] `npm test` + `npm run build` green; live-check dismiss → tab refocus refetch → still hidden per quickstart US3.

**Checkpoint**: Notices respect dismissal across refetch.

---

## Phase 6: User Story 4 — Scroll always restored after sheets/dialogs (Priority: P2)

**Goal**: Opening/closing any sheet or dialog never leaves the page unscrollable; the background doesn't scroll while a sheet is open; correct under nested sheets and rapid open/close.

**Independent Test**: On phone width, exercise every sheet/dialog (incl. nested + rapid) → page scrolls after each close; background frozen while open (quickstart US4).

- [ ] T018 [US4] Add a ref-counted scroll lock (new `frontend/src/hooks/useScrollLock.ts` with a module-level counter, or inline in `useDialogA11y`): on lock, record + freeze the `<main>` scroll container (per `AppShell.tsx`); on unlock (cleanup), restore exactly when the count returns to 0. Guaranteed restore on unmount.
- [ ] T019 [US4] Wire the lock into `frontend/src/hooks/useDialogA11y.ts` so all 10 existing adopters (QuickAdd, Task detail/edit, Event detail/edit, Snooze, Confirm, ForceRank, ScheduleTask) inherit it with no per-sheet change.
- [ ] T020 [P] [US4] Add tests for the lock in `frontend/src/hooks/useScrollLock.test.ts` (or `useDialogA11y.test.ts`): lock on mount, restore on unmount, ref-count keeps lock through nested open, restores only when last closes.
- [ ] T021 [US4] `npm test` + `npm run build` green; live-check on `resize_window` mobile: open→close each sheet, a nested dialog-from-sheet, and a rapid open/close; confirm scroll restored each time and background frozen while open (quickstart US4).

**Checkpoint**: Scroll robust across all sheets.

---

## Phase 7: User Story 5 — Prep-template picker on event create/edit (Priority: P2)

**Goal**: The event create and edit forms let the user pick a prep-checklist template; its tasks attach on save (idempotently) via the existing backend.

**Independent Test**: Create/edit an event with a template → its prep tasks attach; re-apply same template → no duplicates (quickstart US5).

- [ ] T022 [P] [US5] Thread `templateId` through the event payloads in `frontend/src/hooks/useMutations.ts`: add `templateId?: string` to `NewEventInput`, `EventCreatePayload`, `buildEventPayload`, and the `useUpdateEvent` payload type (and the optimistic `Event` insert).
- [ ] T023 [US5] Add a prep-template `<select>` (distinct `eventType` from `useTemplates()`, plus a "None" option) to the event branch of `frontend/src/components/quickadd/QuickAddSheet.tsx`, sending `templateId` in the `createEvent.mutate` call.
- [ ] T024 [US5] Add the same picker to `frontend/src/components/event/EventEditSheet.tsx`, initialized from the event's current `templateId`, sending it in the update payload.
- [ ] T025 [US5] Add/extend tests: `QuickAddSheet.test.tsx` and `EventEditSheet.test.tsx` — picker lists templates, selection is sent as `templateId`; extend `useMutations.test.ts` for payload threading.
- [ ] T026 [US5] `npm test` + `npm run build` green; live-check: create an event with a template → verify prep tasks attach and re-apply doesn't duplicate (quickstart US5). No backend change needed (`syncPrepForEvent_` already handles it).

**Checkpoint**: One-off events can pull in a saved prep checklist.

---

## Phase 8: User Story 6 — Dog-walk finder runs dependably on the trigger (Priority: P3)

**Goal**: Trigger-driven finder runs obtain the forecast (retry transient failures) and book/suggest like manual runs; logs the specific failure mode.

**Independent Test**: `selfTestDogWalk` incl. a retry case passes; the next nightly trigger books or logs a specific reason (quickstart US6).

- [ ] T027 [US6] Harden `fetchForecast_` in `backend/DogWalk.js`: bounded retry loop (≤3 attempts, short `Utilities.sleep` backoff) around `UrlFetchApp.fetch` for transient failures (exception or non-200); return the parsed map on first success; stay well under the 6-min cap.
- [ ] T028 [US6] Distinct diagnostic logging in `backend/DogWalk.js`: log coords-unset vs. non-200 (with code) vs. exception (with message) vs. bad JSON separately (replace/augment the ambiguous "fetch failed or coordinates unset" line in `runDogWalkFinder`), preserving fail-closed defer-on-genuine-failure semantics.
- [ ] T029 [US6] Add a retry test case to `selfTestDogWalk` in `backend/SelfTest.js` (or `backend/DogWalk.js` test seam): forecast fetch fails first attempt, succeeds on retry → run still books; assert one row/slot (idempotency preserved).
- [ ] T030 [US6] `clasp push && clasp run selfTestDogWalk` → `DOG WALK: ALL PASS`; run `clasp run runDogWalkFinder` and confirm eligible weekdays get rows; note in PR to watch the next nightly trigger execution log per quickstart US6.

**Checkpoint**: Automated finder produces walks, not silent defers.

---

## Phase 9: User Story 7 — Calendar doesn't flash on refetch (Priority: P3)

**Goal**: A background refetch of unchanged data no longer flashes / fully re-renders the calendar; real changes still update.

**Independent Test**: Tab refocus → refetch with unchanged data → no visible flash; a real edit updates only the affected chip (quickstart US7).

- [ ] T031 [US7] **Reproduce live first**: on the preview, open the calendar and trigger a window-focus refetch to observe the flash; use console/React devtools to confirm whether it's `useCalendarApp` re-instantiation, `events.set` replacing the collection, or lost structural sharing (research R7). Record the pinned mechanism in a comment on the fix.
- [ ] T032 [US7] Apply the minimal fix in `frontend/src/components/calendar/CalendarHome.tsx`: stabilize the calendar app instance and gate the `calendarApp.events.set(scheduleXEvents)` effect behind an actual content-change signature (memoized key of id+start+end+owner+status), so an unchanged refetch doesn't re-render all chips; if needed, memoize query-derived arrays to preserve referential stability, and isolate the "Last synced" text so it doesn't force a heavy re-render.
- [ ] T033 [P] [US7] Add/extend a test in `frontend/src/components/calendar/CalendarHome.test.tsx`: an unchanged data update does not call `events.set` (or does not churn the event signature); a real change does.
- [ ] T034 [US7] `npm test` + `npm run build` green; live-verify the flash is gone on refetch and a real edit still updates (screenshot before/after) per quickstart US7.

**Checkpoint**: Calendar stable on refetch.

---

## Phase 10: Polish & Cross-Cutting

**Purpose**: Batch-level verification, audit, deploy, and bookkeeping before the PR.

- [ ] T035 Full `cd frontend && npm test && npm run build` green (report new test count vs. baseline from T001).
- [ ] T036 Run `/impeccable audit` on the changed UI (US1/US2/US3/US4/US5/US7 surfaces); fix any WCAG AA / contrast findings (owner colors, struck-text contrast, picker labels).
- [ ] T037 Backend: `cd backend && clasp push && clasp deploy -i <deploymentId>` to refresh the existing web-app URL; re-run `clasp run selfTestDogWalk` post-deploy.
- [ ] T038 Walk the full [quickstart.md](quickstart.md) live (dev token) and record per-story results for the PR.
- [ ] T039 Update `BACKLOG.md` (029 → implement/deployed with validation notes) and write any spec deviations back into `spec.md`.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** before everything; **Phase 2** empty.
- **User stories (Phases 3–9) are independent** — implement in priority order (US1→US7) or cherry-pick. No story blocks another.
- **Within a story**: selector/type task → component task → test task → verify (roughly sequential; `[P]` tasks touch different files and can run together).
- **Polish (Phase 10)** last, after the stories you're shipping are done.

## Parallel Opportunities

- Across stories: US1, US2, US6 touch disjoint files and can be done in parallel by different sessions.
- `[P]` within stories: T003/T004 (US1 selector+test), T009/T010 (US2 two files), T013 (US3 selector), T020 (US4 test), T022 (US5 types), T033 (US7 test).
- US6 is backend-only (`DogWalk.js`, `SelfTest.js`) — fully parallel to all frontend stories.

## Implementation Strategy

- **MVP (highest value first)**: US1 (walks in day peek) + US2 (done strikethrough) — both P1, both small, both immediately visible on the dashboard/calendar.
- **Then** the P2 reliability trio: US3 (dismissals), US4 (scroll lock), US5 (prep picker).
- **Then** P3: US6 (walk trigger — backend, verify against live trigger log) and US7 (calendar flash — repro-driven).
- Each story is a self-contained, independently testable increment; ship the batch as one PR (per prior fix-batch convention) once the included stories are validated.

**Total: 39 tasks** — Setup 2, Foundational 0, US1 6, US2 4, US3 5, US4 4, US5 5, US6 4, US7 4, Polish 5.
