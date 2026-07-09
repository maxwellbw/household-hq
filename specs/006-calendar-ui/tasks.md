---
description: "Task list for feature 006 — Calendar UI (home screen)"
---

# Tasks: Calendar UI (Home Screen)

**Input**: Design documents from `/specs/006-calendar-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-client.md, quickstart.md

**Tests**: Unit tests are included **only** for the pure logic modules research R9 calls out
(owner mapping, tether derivation, relative-due formatting, quick-add payload builders, API
envelope parsing). No component/E2E test tasks — validation is via quickstart.md against the
live backend.

**Organization**: Grouped by user story. Story order respects dependencies: US3 (auth) is the
entry gate all data flows through, so it precedes the other P1 stories. Calendar library:
**Schedule-X** (confirmed at plan review).

## Path Conventions

New `/frontend` Vite app (first frontend feature). All paths below are under `frontend/`
unless noted (the deploy workflow lives at repo-root `.github/workflows/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the entire frontend app and its toolchain.

- [X] T001 Scaffold a Vite + React + TypeScript app in `frontend/` (`npm create vite@latest frontend -- --template react-ts`); confirm `npm run dev` and `npm run build` run clean.
- [X] T002 Install runtime deps in `frontend/`: `@tanstack/react-query`, `@schedule-x/react` + required `@schedule-x/*` calendar packages, `tailwindcss postcss autoprefixer`, and shadcn/ui prerequisites (`class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate`).
- [X] T003 [P] Configure Tailwind (`frontend/tailwind.config.ts`, `frontend/postcss.config.js`) with the DESIGN.md palette wired as theme tokens (bg/surface/ink/accent + owner-max/jaz/both and their `-soft` variants, radii, shadow-card).
- [X] T004 [P] Author `frontend/src/index.css`: Tailwind layers + `:root` CSS variables for the full DESIGN.md palette, and load fonts (Fraunces display, Inter body) self-hosted or via a local `@font-face` (no external CDN blocking).
- [X] T005 [P] Initialize shadcn/ui in `frontend/` (`components.json`, `src/components/ui/`, `src/lib/utils.ts`) targeting the token theme from T003.
- [X] T006 [P] Configure GitHub Pages build in `frontend/vite.config.ts` (correct `base` for the project path) and add `frontend/.env.example` with `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`.
- [X] T007 [P] Add a PWA-capable shell: `frontend/public/manifest.webmanifest` + icons + `<link rel="manifest">` in `frontend/index.html` (no service worker — that's feature 010).
- [X] T008 [P] Configure Vitest + React Testing Library in `frontend/` (`vitest.config.ts`, `src/test/setup.ts`) and add `test` script to `package.json`.

**Checkpoint**: `npm run dev` serves a themed blank app; `npm run build` and `npm run test` succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The plumbing every user story needs — types, API client, auth mechanism, server-state, app shell. **No story can begin until this is done.**

**⚠️ CRITICAL**: Blocks all user stories.

- [X] T009 Create shared domain types in `frontend/src/types/domain.ts`: `Owner`, `TaskStatus`, `Cadence`, `Event`, `Task`, `WhoAmI`, `Session`, `Settings` per data-model.md (field names mirror backend `HEADERS`).
- [X] T010 [P] Implement owner identity mapping in `frontend/src/lib/owners.ts` (`Owner → { color, softColor, label, initial }` from tokens; "both" → "MJ").
- [X] T011 [P] Unit test `frontend/src/lib/owners.test.ts` — every owner maps to correct token/label/initial; color is always paired with a non-color signal.
- [X] T012 [P] Implement `frontend/src/lib/datetime.ts`: household-timezone formatting via `Intl.DateTimeFormat` (pinned `timeZone`), all-day detection, day-bucketing, and relative-due labels ("Today", "Tomorrow", "In N days", "N days overdue", "T−N days").
- [X] T013 [P] Unit test `frontend/src/lib/datetime.test.ts` — boundaries (today/tomorrow/overdue/T−N) and that a non-local device tz still yields household-tz output.
- [X] T014 Implement the typed API client in `frontend/src/lib/api.ts`: `text/plain` POST envelope `{action, token, payload}`, `ok` discriminator, `ApiError(code,message,field)` mapping per contracts/api-client.md; token + optional `actingPerson` injection.
- [X] T015 [P] Unit test `frontend/src/lib/api.test.ts` — parses `{ok:true}`/`{ok:false}` envelopes, throws typed `ApiError` on error codes and on network/parse failure.
- [X] T016 Implement `frontend/src/lib/auth.ts`: GIS sign-in (ID token, `aud`=`VITE_GOOGLE_CLIENT_ID`), in-memory token, `auth.whoami` call, and expiry detection hook points (per R3).
- [X] T017 Set up TanStack Query in `frontend/src/main.tsx` (`QueryClientProvider`, sane defaults: retry policy, `staleTime`) and mount `App`.
- [X] T018 Implement `frontend/src/hooks/useAuth.tsx` — session state (token, `WhoAmI`, `actingPerson`), sign-in/out, and "return to gate on UNAUTHENTICATED/INVALID_CREDENTIAL" behavior. (`.tsx` not `.ts` — the provider renders JSX.)
- [X] T019 Implement `frontend/src/hooks/useSettings.ts` — `settings.list` query exposing the household `timezone` (default `America/Los_Angeles`).
- [X] T020 Build the app shell `frontend/src/components/shell/AppShell.tsx` (header with signed-in identity slot + bottom tab bar: Calendar active; Tasks/Feed/More stubbed) and `frontend/src/App.tsx` routing signed-out → gate, signed-in → shell.

**Checkpoint**: A signed-in session can be established and the themed shell renders; hooks/util libs are unit-tested.

---

## Phase 3: User Story 3 — Sign in and be recognized (Priority: P1) 🎯 entry gate

**Goal**: Only signed-in, allowlisted users see data; identity (Max/Jaz) is shown; refusals and expiry are handled calmly.

**Independent Test**: Signed out → gate only; allowlisted sign-in → admitted + identified; non-allowlisted → calm refusal; expired session → back to gate.

- [X] T021 [P] [US3] Build `frontend/src/components/auth/SignInGate.tsx` — signed-out state with the GIS sign-in button and calm copy; no household data rendered behind it.
- [X] T022 [US3] Render signed-in identity (Max/Jaz via `whoami`) in the `AppShell` header slot (owner-consistent avatar/initial).
- [X] T023 [US3] Add the refusal screen for `FORBIDDEN` / `ALLOWLIST_MISCONFIGURED` in `SignInGate.tsx` — plain, calm message, no data.
- [X] T024 [US3] Add the shared-account acting-person prompt (`needsActingPerson`) — choose Max or Jaz, stored in session for writes (`frontend/src/components/auth/ActingPersonPrompt.tsx`).
- [X] T025 [US3] Wire expiry handling: any `UNAUTHENTICATED`/`INVALID_CREDENTIAL` from a query/mutation returns the user to the gate (via `useAuth` + query error boundary), no stale-forever errors.

**Checkpoint**: Scenario A of quickstart.md passes end-to-end.

---

## Phase 4: User Story 1 — See what's coming up on the calendar (Priority: P1) 🎯 MVP core

**Goal**: Land on the calendar; events for the period render with owner identity; navigate periods; warm empty state.

**Independent Test**: Signed-in user lands on the calendar showing real events on correct dates with owner color+initial; prev/next/today work; empty period shows the designed empty state.

- [X] T026 [US1] Implement `frontend/src/hooks/useEvents.ts` — `events.list` query returning typed `Event[]`.
- [X] T027 [US1] Build `frontend/src/components/calendar/CalendarHome.tsx` — Schedule-X wrapper; month-scale view on desktop, agenda/list-scale on mobile (responsive), landing on today; make it the default view in `AppShell`.
- [X] T028 [US1] Theme Schedule-X to the DESIGN.md tokens via its CSS variables in `frontend/src/components/calendar/calendar-theme.css` (warm surfaces, hairline borders, out-of-month `surface-alt`); no vendor default chrome.
- [X] T029 [US1] Build `frontend/src/components/calendar/EventContent.tsx` — custom event render: 3px owner-colored left edge + soft owner tint, title, time/all-day, owner initial (color never the only signal).
- [X] T030 [US1] Wire period navigation (prev / next / today) in `CalendarHome.tsx` and ensure each period's events load. (Schedule-X's built-in header provides prev/next/today; `onRangeUpdate` tracks the visible period for the empty state.)
- [X] T031 [P] [US1] Build `frontend/src/components/calendar/EmptyState.tsx` — warm serif line + one affordance; shown when the visible period has no items.
- [X] T032 [US1] Apply household-timezone formatting (from `useSettings`) to all event date/time rendering; verify day-bucketing is tz-correct. (Rewrote `lib/datetime.ts` on `temporal-polyfill` — a plain `new Date(naiveString)` would have parsed backend datetimes in the *device's* zone, violating FR-017; caught by the added device-tz-independence tests.)
- [X] T032a *(added, not in original plan)* Regression test `frontend/src/components/calendar/CalendarHome.test.tsx` — mounts the real Schedule-X integration with fixture events; caught 3 real bugs (missing global `Temporal` polyfill, missing jsdom `matchMedia`, wrong `selectedDate` type) that type-checking and pure-logic tests couldn't catch. Kept permanently as regression insurance for this fragile integration boundary, a deliberate deviation from research R9's "pure logic only" test scope.

**Checkpoint**: Scenario B of quickstart.md passes; app opens to a themed calendar of real events.

---

## Phase 5: User Story 2 — Prep tasks tethered to their event (Priority: P1)

**Goal**: Tasks belonging to an event render attached to it; opening an event shows the prep checklist with owner + T−N; standalone tasks stand alone.

**Independent Test**: A seeded event with prep tasks shows a prep indicator and, when opened, its full checklist (owner color+initial, status, relative due/T−N); a standalone task appears on its own date with no dangling tether.

- [X] T033 [US2] Implement `frontend/src/hooks/useTasks.ts` — `tasks.list` (household slice) returning typed `Task[]` incl. `eventId`.
- [X] T034 [P] [US2] Implement `frontend/src/lib/tether.ts` — group tasks by `eventId` into `EventWithTasks` + `standaloneTasks`; dangling `eventId` degrades to standalone (per data-model.md).
- [X] T035 [P] [US2] Unit test `frontend/src/lib/tether.test.ts` — correct grouping, sort by dueDate, `openTaskCount`, and dangling-eventId → standalone (no crash).
- [X] T036 [US2] Extend `EventContent.tsx` with the prep indicator — owner-colored task chips and/or a prep-count badge when the event has tethered tasks.
- [X] T037 [US2] Build `frontend/src/components/task/TaskRow.tsx` — checkbox · title · owner chip (color+initial) · relative-due label (read-only state here; check-off added in US6).
- [X] T038 [US2] Build `frontend/src/components/event/EventDetailSheet.tsx` — open on event tap; show event details + tethered prep checklist (`TaskRow`s) with T−N labels; standalone tasks render on their own date in the calendar. (Standalone tasks render as all-day pseudo-events on the calendar via `_kind: 'task'` in `EventContent`; verified in `CalendarHome.test.tsx`.)

**Checkpoint**: Scenario C of quickstart.md passes; the signature event→task tether is visible.

---

## Phase 6: User Story 5 — Add something in seconds (quick-add) (Priority: P1)

**Goal**: One always-reachable "+" creates an event, a recurring chore, or a one-time task from minimal fields, appearing immediately.

**Independent Test**: From the calendar, create one of each type with only title/when/owner; each saves to the backend and appears in the right place with the correct owner color; a failed save shows a plain error and keeps input.

- [X] T039 [P] [US5] Implement quick-add payload builders in `frontend/src/lib/quickAdd.ts` — `NewEventInput`/`NewRecurringInput`/`NewOneTimeTaskInput` → `events.create`/`recurring.create`/`tasks.create` payloads with defaults (event `end`→start+1h, task `dueDate`→today, owner→acting person) per R6.
- [X] T040 [P] [US5] Unit test `frontend/src/lib/quickAdd.test.ts` — each type produces the required fields (`REQUIRED_ON_CREATE`), applies defaults, and validates cadence/owner enums.
- [X] T041 [US5] Implement create mutations in `frontend/src/hooks/useMutations.ts` (`events.create`, `recurring.create`, `tasks.create`) — attach `actingPerson` for shared sessions; invalidate the relevant `events`/`tasks` queries on success. (Also holds `tasks.complete`/`tasks.reopen` optimistic mutations for US6 — same file, shared query-invalidation plumbing.)
- [X] T042 [US5] Build `frontend/src/components/quickadd/QuickAddSheet.tsx` — type switch (Event · Recurring chore · One-time task), minimal fast-path fields per type, owner selector using consistent owner chips, sensible defaults so it's a few taps.
- [X] T043 [US5] Add the floating "+" entry point (thumb-reachable on mobile) in `AppShell`/`CalendarHome` opening `QuickAddSheet`.
- [X] T044 [US5] Handle create errors: inline `VALIDATION` field errors without losing input; plain toast on other errors; new item appears immediately on success (optimistic or invalidate-refetch).

**Checkpoint**: Scenario F of quickstart.md passes; adding an item feels effortless.

---

## Phase 7: User Story 6 — Mark a task done (Priority: P2)

**Goal**: Check off / reopen a task from the calendar/event view with quiet, instant feedback that persists.

**Independent Test**: Check off a task → quiet animation, done state without reload, persists across reload / to the other user; reopen works; a failed write reverts and shows a plain error.

- [X] T045 [US6] Add optimistic `tasks.complete` / `tasks.reopen` mutations to `frontend/src/hooks/useMutations.ts` — flip status immediately, roll back + plain error on failure, then invalidate.
- [X] T046 [US6] Wire check-off into `TaskRow.tsx` — checkbox toggles complete/reopen; subtle check micro-animation (~300ms) + strikethrough fade; warm success toast. (Added `frontend/src/hooks/useToast.tsx`, not in original plan — DESIGN.md explicitly calls for a warm toast on completion and no such mechanism existed yet.)
- [X] T047 [US6] Respect `prefers-reduced-motion` in the check-off (and all) transitions — crossfade/instant alternative, no load-bearing animation. (`motion-safe:` variants on the check animation + the global `@media (prefers-reduced-motion: reduce)` rule in `index.css` as a blanket fallback.)

**Checkpoint**: Scenario E of quickstart.md passes.

---

## Phase 8: User Story 4 — Filter the calendar by owner (Priority: P2)

**Goal**: Independent, combinable Max/Jaz/Both toggle chips; visible set = union of enabled owners; all on by default.

**Independent Test**: Toggle chips in combination; the visible set is exactly the union of enabled owners; each chip shows its owner color + label + on/off state.

- [X] T048 [P] [US4] Build `frontend/src/components/calendar/OwnerFilterChips.tsx` — three independent toggle chips (Max/Jaz/Both) using consistent owner colors + labels + clear on/off state; all on by default.
- [X] T049 [US4] Apply the owner filter to the calendar model in `CalendarHome.tsx` — event/task visible iff its `owner` ∈ enabled set (union); tasks inherit visibility from their own owner (don't orphan on event filter). (Built ahead of schedule during US1/US2 — `CalendarHome` already took `visibleOwners` as a prop; this phase wired it to real chip state via `useOwnerFilter` instead of the hardcoded all-owners default in `App.tsx`.)
- [X] T050 [P] [US4] Persist chip state to `localStorage` (non-authoritative UI state) so the filter survives reloads. (`frontend/src/hooks/useOwnerFilter.ts`.)

**Checkpoint**: Scenario D of quickstart.md passes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Resilience, deploy, and the quality gates that span all stories.

- [X] T051 Implement resilience per FR-016 in the query layer/UI: loading states, retry affordance on failure, and prefer last-known cached data with a "last synced" note (`dataUpdatedAt`) over indefinite spinners.
- [X] T052 Sweep `prefers-reduced-motion` and focus rings across all interactive components (44px touch targets, visible accent focus at 2px offset) for WCAG 2.1 AA. (Found and fixed missing `focus-visible` rings in QuickAddSheet, OwnerFilterChips, EventDetailSheet, AppShell's sign-out button, and CalendarHome's retry button; fixed OwnerFilterChips' 36px chips to the 44px minimum.)
- [X] T053 [P] Add the deploy workflow `.github/workflows/deploy-frontend.yml` — build `frontend/` and publish to GitHub Pages on merge to `main`.
- [X] T054 [P] Write `frontend/README.md` — dev/build/test commands, env vars (`VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`), and the one-time Pages + OAuth-origin setup notes.
- [X] T055 Run `/impeccable audit` on the calendar, event detail, quick-add, and filter surfaces; resolve findings (owner-soft tint contrast ≥4.5:1, tokens only, no ad-hoc hex). (Scored 17/20 "Good", anti-patterns PASS, zero ad-hoc hex. Resolved: P1 `--ink-faint` `#9b937f→#756c59` (2.84→4.82:1 on bg) and P2 `--ink-muted` `#6e6656→#655e4f` (now ≥4.9:1 on every owner-soft tint, clearing the ≥4.5 gate); P2 added `useDialogA11y` focus-trap/restore to EventDetailSheet + QuickAddSheet. Fonts Inter/Fraunces flagged by the hook are the DESIGN.md-mandated stack — left as intentional. P3 items (accent glyph 4.05:1 on tiny aria-hidden initial; Schedule-X bundle not code-split) noted, not blocking.)
- [X] T056 Ensure `npm run build` passes with zero type errors and `npm run test` (Vitest) is green. (Build clean — only a non-blocking 513 kB chunk-size advisory; 44/44 Vitest tests pass across 7 files.)
- [ ] T057 Execute quickstart.md Scenarios A–G against the live deployed backend and record results.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no deps — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks all stories**.
- **US3 auth (Phase 3)**: first story — data access depends on it; needs Foundational.
- **US1 calendar (Phase 4)**: needs Foundational + a working session (US3 in practice).
- **US2 tether (Phase 5)**: needs US1 (renders inside the calendar/event views).
- **US5 quick-add (Phase 6)**: needs Foundational; integrates with US1 (items appear on calendar).
- **US6 check-off (Phase 7)**: needs US2 (`TaskRow`).
- **US4 filter (Phase 8)**: needs US1 (filters the calendar model).
- **Polish (Phase 9)**: after the desired stories are in.

### Within a story

- Utils/hooks/builders before the components that consume them.
- Unit tests [P] alongside their pure module.
- `EventContent` (US1) is extended by US2 (prep indicator); `TaskRow` (US2) is extended by US6 (check-off) — sequential on those files.

### Parallel Opportunities

- Setup: T003–T008 all [P].
- Foundational: T010/T011, T012/T013, T015 and the two util modules are [P]; T014/T016/T017/T018/T020 touch shared wiring — sequence as noted.
- Pure-logic tests (T011, T013, T015, T035, T040) run [P] with their modules.
- Across stories once Foundational is done, US5's builders/mutations (T039–T041) can progress in parallel with US1/US2 UI since they're different files.

---

## Implementation Strategy

### MVP scope

Setup → Foundational → **US3 (auth)** → **US1 (calendar)**. That yields a signed-in, themed
calendar of real events with owner identity — the core product landing. Validate (quickstart
Scenarios A–B), then layer US2 (tether), US5 (quick-add), US6 (check-off), US4 (filter).

### Incremental delivery

1. Setup + Foundational → shell + session established.
2. + US3 + US1 → calendar MVP (demo-able).
3. + US2 → the signature event→task tether.
4. + US5 → things can be added effortlessly.
5. + US6 → completions close the loop.
6. + US4 → per-owner views.
7. Polish → resilience, deploy, audits, quickstart.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Every write path (US5 create, US6 complete/reopen) goes through existing backend actions that
  append to ActivityLog server-side — no client-side logging, no silent mutation (constitution VI).
- Owner coding uses only DESIGN.md tokens; consistent across every view (constitution/design gate).
- No `*.update`/`*.delete`, no new backend endpoints, no `appsscript.json` scope changes (spec FR-025).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
