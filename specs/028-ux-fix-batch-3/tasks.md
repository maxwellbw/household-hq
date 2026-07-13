# Tasks: UX Fix Batch 3

**Input**: Design documents from `/specs/028-ux-fix-batch-3/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8 hold every design decision — read it first), data-model.md, contracts/api.md

**Tests**: Included, per this repo's definition of done (vitest for frontend behavior; backend checks live in `backend/SelfTest.js`). House style is tests-alongside, not strict TDD.

**Organization**: Grouped by user story, priority order from spec.md. Stories are independent of each other except where flagged (US5 builds on US4's selector; US3's meta tag is shared groundwork).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US7 from spec.md

## Path Conventions

Web app: `backend/` (Apps Script, dependency-free, `.js`) + `frontend/src/` (Vite/React/TS). Backend gotcha (CLAUDE.md): editor/trigger entry points must NOT have a trailing underscore; private helpers MUST.

---

## Phase 1: Setup (baseline)

**Purpose**: Confirm a green baseline so regressions are attributable.

- [ ] T001 Run `cd frontend && npm install && npx vitest run && npm run build` — confirm the existing suite (322 tests) and build are green before touching anything. Record the test count.

---

## Phase 2: Foundational

No blocking prerequisites — the app, auth, data layer, and mutation patterns all exist. The one cross-cutting file edit (viewport meta, needed by both halves of US3) is kept inside US3. Stories can proceed in any order after T001.

---

## Phase 3: User Story 1 — Whole year of birthdays/anniversaries visible (P1) 🎯 MVP

**Goal**: Annual-class recurring events (`annually`, `thanksgiving-sat` cadences) materialize 366 days ahead; every other cadence keeps the 60-day window. Backend-only. Design: research.md R1.

**Independent Test**: quickstart.md §B — after one `generateRecurringEvents()` run, every seeded birthday/anniversary for the next 12 months exists in Events; a weekly rule has nothing beyond ~60 days; re-run creates nothing new.

- [ ] T002 [US1] In `backend/Config.js`: add `var RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS = 366;` next to the existing `RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS` (line ~178, keep the comment style), and add the Settings seed row `['recurringEventsYearlyLookaheadDays', '366', <description matching neighbors>]` beside the existing `recurringEventsLookaheadDays` row (line ~276). Follow the exact format of the surrounding rows; confirm `setupDatabase()` (backend/Setup.js) seeds missing Settings keys from this table automatically (it does for the existing keys — verify, don't assume).
- [ ] T003 [US1] In `backend/RecurringEvents.js` `generateRecurringEvents()` (line ~114): read both settings once (`recurringEventsLookaheadDays` → fallback 60, `recurringEventsYearlyLookaheadDays` → fallback `RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS`, same `>0` guard style), compute `windowEndShort` and `windowEndYearly`, and pass the right one per rule: annual-class is `rule.cadence === 'annually' || rule.cadence === 'thanksgiving-sat'` (NOTE: the cadence value is `annually`, NOT `yearly` — see `CADENCES` in Config.js:95). `generateForEventRule_` itself is unchanged. Update the function's doc comment.
- [ ] T004 [US1] In `backend/SelfTest.js`, extend `liveRecurringEventGeneration_()` (line ~704): add an `annually` rule anchored ~10 months out and assert its first occurrence IS generated (wide window), plus a `weekly` rule and assert nothing beyond the short window; assert a second generation run creates no new rows (idempotency at the wide window). Clean up with the `selftest-` prefix pattern used throughout the file. Also add a pure-math check to `unitRecurringEventMath_()` if window selection is factored into a testable helper.

**Checkpoint**: `clasp push` + run the (still-monolithic until US7) recurring self-test suites from the editor, or defer live verification to quickstart §B at the end. Frontend untouched.

---

## Phase 4: User Story 2 — Saving a task/event feels instant (P1)

**Goal**: Create/edit sheets close immediately; optimistic cache insert/patch; revert + toast on failure. Client mints the record id so the optimistic row is the real row. Design: research.md R2; contract: contracts/api.md.

**Independent Test**: quickstart.md §C — create/edit close instantly and survive settle; airplane-mode create reverts with a toast; one-tap actions unregressed.

- [ ] T005 [P] [US2] In `frontend/src/lib/quickAdd.ts`: add optional `id?: string` to `NewEventInput` and `NewOneTimeTaskInput` and pass it through `buildEventPayload`/`buildOneTimeTaskPayload` into the API payload when present. Do NOT add it to `NewRecurringInput` (recurring creates stay non-optimistic, R2). Update `frontend/src/lib/quickAdd.test.ts` (or the co-located test file) for the pass-through.
- [ ] T006 [US2] In `frontend/src/hooks/useMutations.ts`: make `useCreateOneTimeTask` and `useCreateEvent` optimistic, following the exact `onMutate`/`onError`/`onSettled` shape of `useSetTaskStatus` (line ~97): mint `const id = input.id ?? crypto.randomUUID()` (put it on the variables so `mutationFn` and `onMutate` see the same id — mint it in the hook's `mutate` wrapper or require it on input from the caller, whichever keeps both code paths reading one value), cancel + snapshot `['tasks']` / `['events']`, insert a full optimistic record built from the input (task: `status: 'open'`, empty `completedBy/completedAt/ackBy/ackAt/notes` defaults matching `types/domain.ts`; event: `start`/`end`/`owner` etc. from the built payload), revert on error, invalidate on settle. On error also fire the existing toast (`useToast`) with a plain "Couldn't save — try again" style message consistent with the app's copy.
- [ ] T007 [US2] In `frontend/src/hooks/useMutations.ts`: make `useUpdateEvent` (line ~59) and the task-update mutation (`tasks.update`, line ~172 — used by TaskEditSheet/schedule flows) optimistic the same way: `onMutate` patches the matching record's changed fields in the cache, revert + toast on error, invalidate on settle. Do not touch the already-optimistic hooks (complete/reopen/snooze/unsnooze/acknowledge/rank) beyond leaving them provably unchanged.
- [ ] T008 [US2] Switch the save flows from awaited to fire-and-close: in `frontend/src/components/quickadd/QuickAddSheet.tsx`, the task edit sheet `frontend/src/components/task/TaskEditSheet.tsx`, and the event edit sheet under `frontend/src/components/event/` — call `mutate(...)` and close the sheet immediately instead of `await mutateAsync(...)`; validation errors that are detectable client-side still block close (unchanged); server-side failures now surface via the T006/T007 toast instead of inline sheet errors. Recurring-rule mode in QuickAddSheet keeps its current awaited behavior.
- [ ] T009 [US2] Tests in `frontend/src/hooks/` and component tests: add vitest coverage for (a) optimistic insert visible in `['tasks']`/`['events']` cache before the mutation resolves, (b) revert on rejection + toast fired, (c) client-supplied id ends up in the API payload, (d) QuickAddSheet closes without awaiting resolution (mock a never-resolving mutation). Mirror the testing patterns of the existing optimistic-hook tests if present, else component-level tests.

**Checkpoint**: `npx vitest run` green; manual dev-server sanity pass of create/edit if the sandbox allows.

---

## Phase 5: User Story 3 — App behaves like an app on the phone (P2)

**Goal**: No focus auto-zoom / double-tap zoom; bottom nav clear of the iPhone home indicator with no gap and no desktop dead space. Design: research.md R3 + R4.

**Independent Test**: quickstart.md §D on a real iPhone.

- [ ] T010 [P] [US3] In `frontend/index.html`: change the viewport meta to `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` (one meta tag; `viewport-fit=cover` is required for `env(safe-area-inset-*)` to be non-zero).
- [ ] T011 [P] [US3] In `frontend/src/index.css`: add `touch-action: manipulation` for interactive elements (`a, button, input, select, textarea, [role="button"]` or on the body — match Tailwind-layer conventions used in this file), and a coarse-pointer guard `@media (pointer: coarse) { input, select, textarea { font-size: 16px; } }` so iOS never auto-zooms on focus even if the meta is loosened later (inputs are `text-sm`/14px today — this rule intentionally overrides only on touch devices).
- [ ] T012 [US3] In `frontend/src/components/shell/AppShell.tsx`: bottom nav (line ~93, `fixed inset-x-0 bottom-0 … sm:hidden`) gets safe-area padding, e.g. `pb-[env(safe-area-inset-bottom)]` on the nav container so the 44px tab row sits above the home indicator while the nav background reaches the screen edge; `<main>`'s mobile clearance `pb-16` (line ~77) becomes `pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0`; the FAB's `bottom-20` (line ~85) becomes `bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6`. `env()` resolves to 0 on indicator-less devices — no conditionals. Verify desktop layout unchanged.

**Checkpoint**: build green; browser-preview visual check at mobile viewport (safe-area insets are simulator/device-only — the CSS just must not break flat-bottom rendering).

---

## Phase 6: User Story 4 — Tap a day on the dashboard strip to see that day (P2)

**Goal**: Inline day panel below the 7-day strip with an open-in-calendar link; tile taps toggle/switch it. Design: research.md R5.

**Independent Test**: quickstart.md §E.

- [ ] T013 [US4] In `frontend/src/lib/dashboard.ts`: add pure selector `itemsForDay(tasks: Task[], events: Event[], dateKey: string, timezone: string)` returning that day's `{ events, tasks }` using exactly the same membership rules as `sevenDayTiles` (line ~87: event span `startK ≤ k ≤ endK`; task `dueDate` on `k`; same status filter) — factor the shared predicates so tile counts and panel contents cannot disagree (spec SC-006). Unit tests in `frontend/src/lib/dashboard.test.ts` (membership, ordering — events first then tasks, stable/sensible order).
- [ ] T014 [P] [US4] Create `frontend/src/components/dashboard/DayPeekPanel.tsx`: props `{ dateKey, events, tasks, onOpenCalendar: (dateKey: string) => void, onOpenTask/onOpenEvent (match how DashboardHome's other sections open the existing TaskDetailSheet / event detail sheet) }`. Renders a labelled region (`role="region"`, `aria-label` = the long day label via `formatDayLabel`) with the day's items in the app's card/row idiom (owner color dots per DESIGN.md — reuse existing item-row presentation patterns from the dashboard/calendar rather than inventing one), an explicit friendly empty state for zero items, and a quiet "Open in calendar" link-button calling `onOpenCalendar(dateKey)`. New test file `DayPeekPanel.test.tsx`: items render, empty state, calendar callback, a11y label.
- [ ] T015 [US4] In `frontend/src/components/dashboard/SevenDayStrip.tsx`: tiles become toggles — new props `activeDateKey: string | null` and `onToggleDate(dateKey)` replacing the direct `onOpenDate` call; add `aria-expanded={tile.dateKey === activeDateKey}` and a visible selected style consistent with the `isToday` treatment (distinct from it — selected ≠ today). Update `SevenDayStrip.test.tsx`.
- [ ] T016 [US4] In `frontend/src/components/dashboard/DashboardHome.tsx`: add `const [peekDateKey, setPeekDateKey] = useState<string | null>(null)`; wire `onToggleDate` (same key → null, different → switch), render `DayPeekPanel` directly below the strip when open, pass the existing `onOpenDate` prop through as the panel's `onOpenCalendar`, and wire item taps to the same detail-sheet plumbing the rest of the dashboard uses. Focus stays on the tapped tile (panel opens below; don't steal focus). Update `DashboardHome.test.tsx`: toggle open/switch/close, calendar link pass-through, items reach the panel.

**Checkpoint**: vitest green; dashboard behaves in the dev-server preview.

---

## Phase 7: User Story 5 — Snoozed items show on the week strip (P2)

**Goal**: Snoozed tasks counted/shown on their snoozed-until day (`dueDate` already holds it), styled identically. Design: research.md R6. Depends on US4's `itemsForDay` existing (T013).

**Independent Test**: quickstart.md §F.

- [ ] T017 [US5] In `frontend/src/lib/dashboard.ts`: widen the task status filter in `sevenDayTiles` (line ~101, currently `t.status !== 'open' → skip`) and in `itemsForDay` to `t.status === 'open' || t.status === 'snoozed'`. Touch NOTHING else on the dashboard (smart views, load balance, highlights keep excluding snoozed — spec FR-010).
- [ ] T018 [US5] In `frontend/src/lib/dashboard.test.ts`: flip the existing exclusion expectations (the `'excludes done and snoozed tasks'` test at ~line 336 and the strip-related case at ~line 125 **only where they cover the 7-day strip**) to assert snoozed inclusion on the snoozed-until day; add: snoozed-until-today counts today; snoozed beyond 7 days absent; `done` still excluded; smart-views/load-balance suites unchanged and still green.

**Checkpoint**: vitest green — counts now equal open + snoozed per day.

---

## Phase 8: User Story 6 — Acknowledge UI looks like it belongs (P3)

**Goal**: Presentation-only redesign of the "not yet committed" / "I've got it" treatment on TaskRow, TaskDetailSheet, and AckNotices. Mechanics (`useAcknowledgeTask`, ackBy/ackAt, ntfy ping, dismissible notice) untouched. Design direction: research.md R7 — collapse card-level state + action into a single quiet owner-colored outline chip (state text + tap-to-commit in one ≥44px control); the detail sheet keeps a full-width action; AckNotices restyled to match.

**Independent Test**: quickstart.md §G — clean phone-width rendering, unchanged behavior, AA + touch-target pass.

- [ ] T019 [US6] Redesign the ack presentation in `frontend/src/components/task/TaskRow.tsx` per R7 (single chip control replaces the stacked badge + button; visible only to the assignee for their own unacknowledged tasks — preserve today's visibility/eligibility logic exactly). Keep all handlers/hooks as-is. WCAG 2.1 AA contrast and 44px touch floor are hard gates.
- [ ] T020 [P] [US6] Restyle the ack block in `frontend/src/components/task/TaskDetailSheet.tsx` (full-width commit action, calm hierarchy per DESIGN.md) and `frontend/src/components/dashboard/AckNotices.tsx` (the assigner-facing notice) to match T019's visual language. No mechanic changes; dismissal/localStorage behavior untouched.
- [ ] T021 [US6] Run `/impeccable critique` on the three redesigned surfaces and iterate; update `AckNotices.test.tsx` and any affected TaskRow/TaskDetailSheet tests for the new structure (behavioral assertions — acknowledge fires, visibility rules — must all still pass unchanged; only DOM-structure assertions may change).

**Checkpoint**: vitest green; ack flow behaviorally identical.

---

## Phase 9: User Story 7 — Backend self-check can finish (P3)

**Goal**: Four public chunked runners replacing the over-limit monolith; `selfTest()` becomes a fail-loud guard. Design: research.md R8 (chunk membership is fixed there — follow it exactly). Do this AFTER T004 so the new US1 checks land in chunk 2.

**Independent Test**: quickstart.md §A — each chunk passes in <~4 min from the editor; `selfTest()` throws with instructions.

- [ ] T022 [US7] In `backend/SelfTest.js`: add `selfTest1Core()`, `selfTest2Recurring()`, `selfTest3SeedAndLists()`, `selfTest4CalendarAndComms()` — public names (NO trailing underscore — trigger/editor gotcha in CLAUDE.md), each calling exactly the suites listed in research.md R8 in the monolith's original relative order, each ending `Logger.log('SELFTEST n/4 (<name>): ALL PASS')`. Replace `selfTest()`'s body with the fail-loud guard: log the four runner names in order and `throw new Error(...)` pointing to them (so a partial run can never be mistaken for a pass). Keep `selfTestSeedPack()` and `selfTestSessionTokens()` untouched. Add a header comment block mapping every suite → its chunk so "union == old monolith" is reviewable at a glance (all 42 suite calls accounted for, each in exactly one chunk).
- [ ] T023 [US7] Coverage audit: diff the union of the four chunks' call lists against the old `selfTest()` body (git show HEAD:backend/SelfTest.js) — every suite present exactly once, none duplicated, none dropped. Record the audit result in the header comment.

**Checkpoint**: editor runs deferred to quickstart §A post-deploy.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T024 [P] Run `/impeccable audit` across all changed UI (QuickAdd/edit save flows, bottom nav, SevenDayStrip + DayPeekPanel, ack surfaces) and fix findings (AA contrast, touch targets, focus visibility — the usual repeat offenders per past batches).
- [ ] T025 [P] Full frontend gate: `cd frontend && npx vitest run && npm run build` — zero type errors, all tests green. Report final test count vs. T001's baseline.
- [ ] T026 Write back any implementation deviations into `specs/028-ux-fix-batch-3/spec.md` / `plan.md` / `research.md` (constitution VII — never silently shipped), and update `BACKLOG.md`: 028 stage → `implemented, pending PR` when done.
- [ ] T027 Backend deploy + live validation: `cd backend && clasp push && clasp deploy -i <existing deploymentId>`, then walk `specs/028-ux-fix-batch-3/quickstart.md` §A → §H in order (§A chunks, §B backfill run — this is the moment the birthdays appear; §C–§G need the real iPhone; flag for Jaz anything the sandbox can't do). Record results in the PR description.

---

## Dependencies & Execution Order

- **T001** first (baseline).
- **US1 (T002–T004)**: independent; backend only. Do before US7 (T004's new checks must exist when chunks are cut).
- **US2 (T005–T009)**: independent. T005 before T006; T006+T007 before T008; T009 last.
- **US3 (T010–T012)**: independent; T010/T011 parallel, T012 after T010 (needs `viewport-fit=cover`).
- **US4 (T013–T016)**: independent; T013 first, T014/T015 parallel after, T016 last.
- **US5 (T017–T018)**: after US4's T013 (shares `itemsForDay`).
- **US6 (T019–T021)**: independent; T019 before T021, T020 parallel with T019.
- **US7 (T022–T023)**: after T004.
- **Polish (T024–T027)**: after everything; T024/T025 parallel; T027 last.

### Parallel opportunities

After T001, the story groups US1, US2, US3, US4, US6 can proceed in parallel (disjoint files). Within stories: T005∥T010∥T011∥T013∥T014∥T019∥T020 touch seven different files.

## Implementation Strategy

MVP = US1 alone (the "our data looks broken" fix — deployable with just T002–T004 + a backfill run). Then US2 (the every-day pain), then US3–US5 (device feel + dashboard), then US6–US7, polish, deploy, quickstart. Commit per task or coherent group; each checkpoint is a safe pause point.
