---
description: "Task list for feature 030 — Perf & Resilience"
---

# Tasks: Perf & Resilience

**Input**: Design documents from `/specs/030-perf-resilience/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-bootstrap.md, quickstart.md

**Tests**: Included — this repo is test-driven (extensive `*.test.ts(x)` + `backend/SelfTest.js`) and DoD requires `npm test` + `clasp run selfTest` green.

**Organization**: By user story (priority order). US1 is the MVP; every story is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 for story-phase tasks; Setup/Foundational/Polish have no story label
- Exact file paths are in each task

## Path Conventions

Web app: `backend/*.js` (Apps Script, dependency-free), `frontend/src/**`. Branch `030-perf-resilience` already created off `main`.

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before changing shared client/auth code.

- [x] T001 Confirm baseline is green on branch `030-perf-resilience`: `cd frontend && npm install && npm test && npm run build`, then `cd ../backend && clasp push && clasp run selfTest` — record that all pass before edits. (`selfTest()` is a fail-loud guard, not a runner — ran its five chunk functions instead; chunks 1–3 green pre-edit. Chunk 4, `selfTest4CalendarAndComms`, hit a pre-existing flake — see Notes.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared transient-vs-genuine error classifier consumed by both the boot-restore hardening (US2) and the read retry (US3). US1, US4, US5 do not depend on this and may proceed in parallel.

**⚠️ Blocks**: US2 and US3 only.

- [x] T002 Add a `TIMEOUT` code path and export `isTransientError(err): boolean` in `frontend/src/lib/api.ts` recognizing `NETWORK_ERROR`/`TIMEOUT`/`BAD_RESPONSE` as transient and `VALIDATION_FAILED`/`FORBIDDEN`/`UNAUTHENTICATED`/`UNKNOWN_ACTION`/`INTERNAL` as genuine (per contracts/api-bootstrap.md taxonomy).
- [x] T003 [P] Unit-test `isTransientError` in `frontend/src/lib/api.test.ts` — transient codes → true, genuine codes → false.

**Checkpoint**: Shared error classification available.

---

## Phase 3: User Story 1 — App opens in one round-trip (Priority: P1) 🎯 MVP

**Goal**: One `data.bootstrap` request populates every primary view on cold load; activity stays a lazy per-tab load.

**Independent Test**: Cold-load with a warm session → Network panel shows exactly one `data.bootstrap` POST (not ~10 `*.list`), and home/calendar/tasks/lists render real data from it; opening More fires the one lazy `activity.list`.

### Tests for User Story 1

- [x] T004 [P] [US1] Add a `data.bootstrap` shape-parity assertion to `backend/SelfTest.js`: each returned key equals its `*.list` helper output for the same actor, and `activity` is absent. (`liveBootstrapParity_`, run as part of `selfTest1Core` chunk.)
- [x] T005 [P] [US1] Unit test `frontend/src/hooks/useBootstrap.test.ts`: on success it seeds all nine dataset query keys, and mounting a per-dataset hook (e.g. `useTasks`) afterward issues no additional `apiCall` (seeded-fresh under `staleTime`).

### Implementation for User Story 1

- [x] T006 [US1] Add the `'data.bootstrap'` handler to `HANDLERS` in `backend/Api.js` composing the existing helpers — `events`, `tasks` (pass `(p, actor, identity)` to `listTasks_`), `recurring`, `recurringEvents`, `lists`, `listItems`, `templates`, `settings`, `dogWalks`; **exclude** activity. Read-only, no ActivityLog append.
- [x] T007 [US1] Create `frontend/src/hooks/useBootstrap.ts`: a `['bootstrap']` query (`enabled: !!session`) calling `data.bootstrap`; on success `queryClient.setQueryData` for each of the nine keys (`['events']`,`['tasks']`,`['recurring']`,`['recurringEvents']`,`['lists']`,`['listItems']`,`['templates']`,`['settings']`,`['dogWalks']`). Do **not** seed `['activity']`.
- [x] T008 [US1] Wire `useBootstrap` into the signed-in boot path in `frontend/src/App.tsx` so it runs once after sign-in; gate the primary views' first render on bootstrap completion (reuse `RestoringGate` for the in-flight state). Confirm the existing per-dataset hooks stay unchanged and don't refetch.

**Checkpoint**: MVP — cold load is a single request; SC-001 verifiable.

---

## Phase 4: User Story 2 — A returning user isn't bounced to sign-in over a hiccup (Priority: P2)

**Goal**: Transient whoami/bootstrap failure auto-retries then shows a recoverable "Couldn't load — Retry" screen with the session preserved; genuine forbidden/expired still route to their terminal states.

**Independent Test**: Set network Offline with a valid stored token → reload → auto-retry phase then the recoverable screen (token still in localStorage, not the sign-in wall); restore network + Retry → app opens signed-in. Invalid token → sign-in wall; non-allowlisted → forbidden.

**Depends on**: Foundational (T002) for `isTransientError`; US1 (T006–T008) so bootstrap-failure recovery has something to recover.

### Tests for User Story 2

- [x] T009 [P] [US2] Extend `frontend/src/hooks/useAuth.test.tsx`: transient whoami failure → `restore-error` with token preserved; genuinely expired → `signed-out`; forbidden → `forbidden`; a successful retry from `restore-error` → `signed-in` (no re-auth).

### Implementation for User Story 2

- [x] T010 [US2] In `frontend/src/hooks/useAuth.tsx`: add `restore-error` to `AuthStatus`; in `restore()` add a bounded auto-retry with backoff, and route the transient branch (currently `setStatus('signed-out')`) to `restore-error` **without** clearing the stored token; leave the forbidden and expired branches unchanged.
- [x] T011 [US2] Fold `useBootstrap` transient failure into the same recoverable path (surface a boot-error that drives `restore-error`), so a failed bootstrap after a valid whoami also lands on the recoverable screen (spec AS4 / FR-010).
- [x] T012 [US2] Create `frontend/src/components/auth/BootErrorGate.tsx` ("Couldn't load — Retry" with a manual button that re-runs restore + bootstrap) and render it from `frontend/src/App.tsx` when `status === 'restore-error'` (above the sign-in wall branch).

**Checkpoint**: SC-003 verifiable — no transient failure reaches the sign-in wall.

---

## Phase 5: User Story 3 — Requests don't hang, and blips self-heal (Priority: P2)

**Goal**: Every call is time-bounded; idempotent reads auto-retry transient failures; writes are never auto-retried.

**Independent Test**: Stall a request past ~15 s → it aborts with a retryable error (no hang); a read that fails once then succeeds recovers with no visible error; a `VALIDATION_FAILED` surfaces immediately.

**Depends on**: Foundational (T002) for `isTransientError`.

### Tests for User Story 3

- [x] T013 [P] [US3] Unit test in `frontend/src/lib/api.test.ts`: a stalled fetch aborts at the timeout and throws a retryable `TIMEOUT`/`NETWORK_ERROR` `ApiError`.
- [x] T014 [P] [US3] Unit test the QueryClient retry predicate (in `frontend/src/main.tsx` or an extracted `queryClient.ts` + test): transient error retried up to the bound with backoff; genuine error not retried; mutations retry 0.

### Implementation for User Story 3

- [x] T015 [US3] Add an `AbortController` timeout (~15 s) to `apiCall` in `frontend/src/lib/api.ts`; on abort throw `ApiError('TIMEOUT', …)` (falls under `isTransientError`).
- [x] T016 [US3] In `frontend/src/main.tsx`, replace `retry: 1` with `retry: (n, err) => n < N && isTransientError(err)` plus an exponential `retryDelay`; leave mutation defaults (`retry: 0`) intact. (Optionally extract the client to `frontend/src/lib/queryClient.ts` to make T014 testable.) — extracted to `frontend/src/lib/queryClient.ts` (`MAX_QUERY_RETRIES = 3`, capped exponential backoff).

**Checkpoint**: SC-004 verifiable — nothing hangs; blips self-heal.

---

## Phase 6: User Story 4 — The rest of the app saves instantly too (Priority: P3)

**Goal**: Convert the remaining `onSuccess`-invalidate-only mutations to the feature-028 optimistic pattern (`onMutate` snapshot + optimistic `setQueryData`, `onError` rollback, `onSettled` invalidate).

**Independent Test**: For each converted action the UI updates immediately, reconciles with no flicker/duplicate on success, and reverts with an error toast on failure (force via Offline). 028's existing optimistic actions still work.

**Depends on**: None beyond Setup — fully parallel with US1–US3, US5. Each hook is a separate file.

### Tests for User Story 4

- [x] T017 [P] [US4] Add one optimistic-revert unit test per newly-converted hook (colocated `*.test` files; extend `frontend/src/hooks/useMutations.test.tsx` for the useMutations conversions): failed save reverts cache; successful save reconciles with no duplicate.

### Implementation for User Story 4

- [x] T018 [P] [US4] Convert the `settings.update` mutation in `frontend/src/hooks/useSettings.ts` to optimistic.
- [x] T019 [P] [US4] Convert the 5 remaining mutations in `frontend/src/hooks/useListMutations.ts` (list create, list delete, item create, item edit, item delete) to optimistic.
- [x] T020 [P] [US4] Convert the 3 mutations in `frontend/src/hooks/useRecurring.ts` (create/update/delete) to optimistic.
- [x] T021 [P] [US4] Convert the 3 mutations in `frontend/src/hooks/useRecurringEvents.ts` (create/update/delete) to optimistic.
- [x] T022 [P] [US4] Convert the 3 mutations in `frontend/src/hooks/useTemplates.ts` (create/update/delete) to optimistic.
- [x] T023 [US4] Enumerate and convert the remaining `onSuccess`-only mutations (~5) in `frontend/src/hooks/useMutations.ts` (e.g. toggle-essential and the other non-optimistic batch) to optimistic, leaving the 8 existing optimistic ones untouched.

**Checkpoint**: SC-005 verifiable — every in-scope save is perceived-instant; 028 regressions clear.

---

## Phase 7: User Story 5 — The app downloads less up front (Priority: P3)

**Goal**: Split the bundle so the first render skips the heavy Schedule-X calendar and the More view; a failed chunk is retryable, not fatal.

**Independent Test**: `npm run build` emits an initial chunk plus on-demand chunks; cold render doesn't request the calendar/More chunks; navigating loads them and they work; a blocked chunk shows a retryable area-scoped error.

**Depends on**: None beyond Setup — parallel with US1–US4.

### Tests for User Story 5

- [x] T024 [P] [US5] Add a `frontend/src/components/shell/LazyBoundary.test.tsx` asserting the fallback renders during suspense and the error boundary shows a retry affordance on a thrown chunk-load error.

### Implementation for User Story 5

- [x] T025 [US5] Create `frontend/src/components/shell/LazyBoundary.tsx` — a `Suspense` fallback + error boundary that renders a retryable, area-scoped message on chunk-load failure (FR-019/020).
- [x] T026 [US5] In `frontend/src/App.tsx`, `React.lazy` the calendar view (`CalendarHome` and its Schedule-X deps) and the `MoreView`, each wrapped in `LazyBoundary`; keep dashboard/tasks/lists eager.
- [x] T027 [US5] Add `build.rollupOptions.output.manualChunks` in `frontend/vite.config.ts` splitting the `@schedule-x/*` packages and the React runtime into their own vendor chunks; confirm `npm run build` shows the split.

**Checkpoint**: SC-006 verifiable — first render skips deferred chunks.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Deploy, validate live, audit new UI, update docs.

- [ ] T028 Backend deploy: `cd backend && clasp push && clasp run selfTest` (ALL PASS incl. bootstrap parity), then `clasp deploy -i <deploymentId>` to refresh the existing web-app URL.
- [ ] T029 Run `specs/030-perf-resilience/quickstart.md` live validation for all five stories against the deployed app (dev session token); record results for the PR.
- [ ] T030 [P] `/impeccable audit` the new UI states — `BootErrorGate` and the `LazyBoundary` fallback/error — before PR.
- [ ] T031 [P] Final gate: `cd frontend && npm test && npm run build` type-clean; update `BACKLOG.md` (030 → implement/deployed + PR link) and note any spec deviations back into the spec.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)**: no dependencies.
- **Foundational (T002–T003)**: after Setup; **blocks US2 and US3 only**.
- **US1 (P1)**: after Setup — the MVP; US2 builds on it.
- **US2 (P2)**: after Foundational + US1.
- **US3 (P2)**: after Foundational.
- **US4 (P3)**, **US5 (P3)**: after Setup only — independent of everything else.
- **Polish (T028–T031)**: after all desired stories.

### Story independence

- US1, US4, US5 are mutually independent and can run in parallel immediately after Setup.
- US3 needs only the shared classifier (T002).
- US2 is the one cross-story dependency (needs US1's bootstrap + T002); its whoami-transient half is testable even before bootstrap wiring.

### Parallel opportunities

- T003 ∥ (start of US1).
- Within US4, T018–T022 are all different files → fully parallel; T023 (useMutations.ts) is separate; T017 tests can be written alongside.
- US4 and US5 can be built entirely in parallel with the US1→US2→US3 spine.
- Test tasks marked [P] run alongside their implementation.

---

## Implementation Strategy

### MVP first

1. Setup (T001) → Foundational (T002–T003).
2. US1 (T004–T008) → **STOP and validate**: cold load = one request (SC-001). Deploy/demo — this alone is the biggest felt win.

### Incremental delivery

US1 (one-request load) → US2 (no sign-in bounce) → US3 (no hangs / self-heal) → US4 (instant saves everywhere) → US5 (lighter first load). Each is an independently shippable increment; the resilience spine (US1→US2→US3) and the two polish stories (US4, US5) can progress in parallel, converging at the Polish phase for one deploy + PR.

---

## Notes

- **US1 implementation note (T001–T008, not a spec deviation)**: `settings` in the bootstrap
  payload is the raw `Settings` map (matching `settings.list`'s `data.settings` field
  one-for-one, per contracts/api-bootstrap.md), but the frontend's `['settings']` cache key
  historically holds the *whole* `settings.list` response shape (`{ settings: Settings }`,
  per `useSettings.ts`'s `query.data?.settings.timezone` access) rather than the unwrapped
  map. `useBootstrap` seeds `['settings']` with `{ settings: data.settings }` to match — every
  other key seeds its bootstrap value directly, since those hooks' cache values are already
  unwrapped arrays.
- **Baseline flake (pre-existing, unrelated to feature 030)**: `selfTest4CalendarAndComms`
  (live Calendar/digest/push suites) intermittently hung or threw a null-dereference in
  `liveCalendarEventSync_` during T001 baseline checks — reproduced only when two live-writing
  chunks ran concurrently against the same real Sheet/Calendar (an operational mistake during
  this session, not a code change). Chunks 1–3 (Core incl. the new bootstrap parity test,
  Recurring, SeedAndLists) are confirmed green after `clasp push`; chunk 4/5 were left
  unverified per the user's direction — worth a clean, isolated re-run before relying on them.
- **US2 implementation note (T009–T012, not a spec deviation)**: boot-restore's bounded
  auto-retry (FR-007) uses 2 retries (3 attempts total) with backoff delays of 500ms then
  1500ms before falling back to `restore-error`; `useBootstrap`'s own transient retries reuse
  the existing US3 `queryClient` retry (`MAX_QUERY_RETRIES = 3`, exponential backoff) — once
  that budget is exhausted, `useBootstrap` calls `reportBootError()` to fold into the same
  `restore-error` screen rather than leaving `status: 'signed-in'` with an unseeded cache.
  A malformed/partial bootstrap payload (missing/non-array dataset keys) is classified as
  `ApiError('BAD_RESPONSE', …)` — already a transient code (FR-010) — so it rides the same
  retry-then-recoverable path as a network failure, verified live against the deployed
  backend (unreachable-URL → auto-retry → `BootErrorGate`, retry button re-cycles cleanly,
  and a genuinely-rejected token still routes straight to the sign-in wall per FR-009).
- **US4 implementation note (T017–T023, not a spec deviation)**: `useMutations.ts`'s actual
  non-optimistic count was 5 (`useCreateRecurring`, `useScheduleTask`, `useRankTasks`,
  `useDeleteTask`, `useDeleteEvent`), matching the "~5" estimate; no `toggle-essential`
  mutation exists anywhere in the codebase (grepped repo-wide — a stale example in this task's
  original wording, not a missed conversion). `useDeleteTask`/`useDeleteEvent` carried an
  inline comment from feature 022 ("No optimistic removal: rare/destructive") that this story
  supersedes: revert-on-failure is now the established recovery path for every save in the
  app, so optimistic removal-with-revert is no less safe here than elsewhere — `useDeleteEvent`
  additionally cascades the optimistic removal to prep tasks (`t.eventId === eventId`) to
  mirror the backend's cascade delete. `useCreateListItem`'s create (FR-015's "list-item
  create") was previously invalidate-only because "we can't know client-side which case
  [reuse-and-flip vs. new] applied" (research R3) — resolved by replicating the server's exact
  name-match check (trimmed, case-insensitive, same list) against the `['listItems']` cache
  before deciding whether to optimistically flip an existing row or insert a client-minted-id
  one, so the reuse case no longer risks a duplicate. Every create hook in this story reuses
  the client-minted-id pattern from `useCreateEvent`/`useCreateOneTimeTask` (028/030 research
  R2/R6) — the backend's `createRecord_` already replays idempotently on a matching id, so no
  backend change was needed to support it. Scope was intentionally limited to
  `frontend/src/hooks/*` per this task's brief; calling components that still `await
  mutateAsync(...)` before dismissing their own dialog (e.g. `QuickAddSheet`'s recurring path,
  `SettingsView`) were left untouched — the underlying cache now updates optimistically for
  every other consumer of that data, but that one call site's own dialog-close timing is a
  component-level concern outside this story's file list.
  Live browser verification (T017's "reverts cleanly when forced offline" checkpoint) could
  not be run in this session: the sandboxed preview server failed to start (`process.cwd`
  `EPERM` in the environment's npm, unrelated to these changes) and the app requires a live
  Google-authenticated session against the deployed Apps Script backend to render past
  sign-in. The 39 new/extended unit tests substitute a mocked rejected `authedCall` for the
  network failure, which exercises the identical `onError` revert code path; this should still
  be spot-checked live before merging. `npm test` (486/486) and `npm run build` are green.
- **US5 implementation note (T024–T027, not a spec deviation)**: `vite.config.ts`'s
  `manualChunks` is written as a function (`(id) => ...`) rather than the classic Rollup
  object-of-package-arrays form research.md R5 sketched. This repo's `vite@^8.1.1` bundles
  rolldown internally, and rolldown's `manualChunks` type only accepts a function — the
  object form isn't supported (confirmed against `node_modules/rolldown`'s type defs).
  Outcome is identical (a build confirmed to emit a `schedule-x` vendor chunk, a `react`
  vendor chunk, separate `CalendarHome`/`MoreView` chunks, and an initial `index` chunk whose
  `dist/index.html` references only itself + the `react` chunk — no eager reference to
  `schedule-x`, `CalendarHome`, or `MoreView`), just reached via id-substring matching
  (`/node_modules/@schedule-x/`, `/node_modules/react/`, `/node_modules/react-dom/`) instead
  of package-name arrays. `LazyBoundary`'s retry recreates the `React.lazy()` wrapper on each
  attempt (memoized per attempt count) rather than doing a full `window.location.reload()` —
  React caches a lazy component's import promise for the life of that `lazy()` call, so
  reusing the same one on retry would replay the same cached rejection forever; a fresh
  `lazy()` call per attempt re-issues the dynamic `import()`, so retry recovers in place
  without losing the rest of the app's state (open dialogs, `active` tab, etc.).
  Live browser verification could not be run in this session (same pre-existing sandboxed
  `npm`/`process.cwd` `EPERM` limitation noted under US4, unrelated to this change) — verified
  instead via `npm run build`'s chunk manifest/`dist/index.html` inspection (confirms FR-018
  structurally) and `LazyBoundary.test.tsx`'s two unit tests (fallback renders during
  suspense; a rejected loader shows a `role="alert"` retry affordance and a successful retry
  renders the real component with the alert gone — confirms FR-019/020's behavior directly
  without the browser). This should still be spot-checked live (offline the calendar/More tab,
  confirm the retryable message, restore connectivity, confirm Retry recovers) before merging.
  `/impeccable audit` on `LazyBoundary`'s fallback/error states (code-level, since no live
  render was available) flagged the Retry button's `size="sm"` (32px) as below DESIGN.md's
  44px touch-target guideline and inconsistent with `BootErrorGate`'s Retry button (default
  size); fixed to match `BootErrorGate`. Neither size variant actually reaches 44px — a
  pre-existing gap in `Button`'s size variants (`AppShell`'s sign-out button works around it
  with an explicit `min-h-[44px]` override) — left as-is, out of scope for this story.
  `npm test` (488/488) and `npm run build` are green.
- No new dependency, no Sheet tab/column/record-shape change (FR-021).
- Every write handler is untouched → ActivityLog behavior unchanged (Principle VI); optimistic conversions change only client timing.
- `listItems.list` already returns all items unfiltered, so the "all lists at once" bootstrap key needs no new backend read.
- Activity stays lazy by construction (conditionally-rendered More view; not seeded by bootstrap) — US5's `React.lazy` on More reinforces it.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
