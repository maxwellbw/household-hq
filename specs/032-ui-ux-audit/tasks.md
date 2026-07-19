# Tasks: Theming & Systemic UI Hygiene

**Input**: Design documents from `/specs/032-ui-ux-audit/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md, contracts/ui-states.md (C1–C7), quickstart.md

**Tests**: This repo's convention is colocated `*.test.tsx` per touched component (Constitution/CLAUDE.md definition of done) — test tasks are folded into implementation tasks rather than TDD-ordered, matching features 012–031.

**Organization**: Phases 3–8 map 1:1 to spec user stories US1–US6, priority order.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Confirm green baseline on branch `032-ui-ux-audit-theming`: `cd frontend && npm run build && npm test` — record any pre-existing failures before touching code
- [x] T002 [P] Add token contrast-check script in frontend/scripts/contrast-check.mjs: reads the C1 token-pair list from both theme blocks in src/index.css, prints WCAG ratios, exits non-zero under 4.5:1 (3:1 large-text pairs flagged); add `npm run check:contrast`

## Phase 2: Foundational — theme engine (blocks all visual work; every later task's DoD includes "verified in both themes")

- [x] T003 Add `[data-theme="dark"]` token block to frontend/src/index.css with R2 starting values (deep warm umber bg family, warm off-white ink, lifted owner hues, `color-scheme: dark`); keep light `:root` untouched; every color/shadow token gets a dark value (contract C1)
- [x] T004 Create frontend/src/hooks/useTheme.ts + useTheme.test.ts: `hq.theme` localStorage read/write (`system|light|dark`, invalid→system), matchMedia subscription, resolved-theme derivation, `<html data-theme>` stamping, `theme-color` meta update (data-model ThemePreference)
- [x] T005 Add pre-paint inline script + dual `theme-color` metas to frontend/index.html (stamp `data-theme` from localStorage/OS before first paint — no flash, quickstart §1 case 2)
- [x] T006 Mount useTheme once in frontend/src/App.tsx; verify live OS-switch re-themes open views without reload (SC-002)

**Checkpoint**: app renders fully dark/light by OS preference; no in-app control yet.

## Phase 3: User Story 1 — The app respects the room's light (P1)

**Goal**: complete dark theme on every surface + System/Light/Dark control + chrome/icon handling.
**Independent test**: quickstart §1 matrix + §2 full-surface sweep + §8 icons.

- [x] T007 [US1] Add Appearance section to frontend/src/components/more/MoreView.tsx (+ MoreView.test.tsx): System/Light/Dark segmented control per contract C6 — instant apply, no Save round-trip, current resolved theme evident
- [x] T008 [P] [US1] Dark values for the Schedule-X bridge in frontend/src/components/calendar/calendar-theme.css: `--sx-*` under `[data-theme="dark"]`, replace/override the hardcoded `#B8B5B8` chevron data-URIs, sweep vendor chrome for unthemed remnants (R4, F-17)
- [x] T009 [P] [US1] Dark-scheme favicon: internal `@media (prefers-color-scheme: dark)` styles in frontend/public/icon.svg; review installed-app icon on a dark home screen, adjust contained background if needed; document the manifest-icon platform limit in DESIGN.md + frontend/README (R3, FR-004)
- [x] T010 [US1] Full-surface dark sweep per quickstart §2: auth gates (SignInGate/RestoringGate/BootErrorGate), dialogs (quick-add, schedule), sheets (planner renders themed — no interaction changes), toasts, skeletons, error/empty states, owner-soft tints — fix stragglers (hardcoded rgba shadows, any component-level color leaks) at token level only (contract C1)
- [x] T011 [US1] Run `npm run check:contrast`, tune dark token values until both themes pass all pairs; commit final values (FR-005, SC-001)
- [x] T012 [US1] Update DESIGN.md in the same story: dark token table with final values, shipped ink-token drift documented, current nav structure, delete the "Dark mode: deferred — don't scaffold" line (FR-006, F-24)

**Checkpoint**: US1 shippable alone — dark mode complete, MVP increment.

## Phase 4: User Story 2 — Dashboard reads in priority order (P1)

**Goal**: overdue-first merged dashboard, Lately strip, tappable nudge, load-balance copy.
**Independent test**: quickstart §3 four data states.

- [x] T013 [US2] Merge day-card contents in frontend/src/components/dashboard/SevenDayStrip.tsx + DayPeekPanel.tsx (+ tests): today pre-selected on mount; today's card shows events + walk status line (existing dashboard data only — planner interactions stay 033) + tasks due today (union of old strip card and Today section)
- [x] T014 [US2] Reorder frontend/src/components/dashboard/DashboardHome.tsx (+ DashboardHome.test.tsx) per contract C7: Overdue section first when non-empty (urgent styling, cap 5 + "view all in Tasks"), remove standalone Today section, single warm line when overdue+today both empty (FR-007/008)
- [x] T015 [P] [US2] Create frontend/src/components/dashboard/LatelyStrip.tsx (+ test): head of existing useActivity data (cap ~4), plain-sentence entries, "See all" → More→Feed, renders nothing on error/empty (R7, FR-009); mount between today card and This weekend
- [x] T016 [P] [US2] Make frontend/src/components/dashboard/GroceryNudge.tsx tappable → Lists tab, Groceries list, Needed segment (navigation prop through DashboardHome→App), honest empty state on stale nudge (FR-010)
- [x] T017 [P] [US2] frontend/src/components/dashboard/LoadBalance.tsx (+ test): replace "MORE" chip with plain leader sentence, collapse all-zero period to one quiet line, reconcile "You" vs name with owner-chip convention (FR-011)

**Checkpoint**: quickstart §3 passes in both themes.

## Phase 5: User Story 3 — Every dead end gets a next step (P2)

**Goal**: shared ErrorState/SyncedAt/Undo patterns adopted app-wide.
**Independent test**: quickstart §4.

- [x] T018 [US3] Create frontend/src/components/shell/ErrorState.tsx (+ test) per contract C2 (title/copy/Retry/busy)
- [x] T019 [US3] Adopt ErrorState in frontend/src/components/feed/FeedView.tsx, frontend/src/components/lists/ListsView.tsx, and every `isError` branch found by sweep (`grep -rn "isError" frontend/src/components`) wired to the owning query's refetch (FR-012); also investigate why Feed failed while bootstrapped views worked (audit F-09 note) and fix if a seeding gap
- [x] T020 [P] [US3] Create frontend/src/components/shell/SyncedAt.tsx (+ test) per contract C4 (React Query `dataUpdatedAt`, coarse relative, 60s tick); replace all bespoke "Last synced HH:MM:SS" strings (CalendarHome and sweep) (FR-014, R8)
- [x] T021 [US3] Create frontend/src/hooks/useUndoableMutation.ts (+ test) per contract C3: immediate forward commit, ~6s single-slot Undo toast (extend frontend/src/hooks/useToast.tsx with action support), inverse invocation
- [x] T022 [US3] Adopt Undo: task complete ↔ useReopenTask in the completion flows (dashboard rows, TasksView, day cards) — remove any blocking confirms for it; keep event-delete confirm (external calendar sync) (FR-013)
- [x] T023 [US3] Adopt Undo: list-item delete ↔ re-add via existing useListMutations in frontend/src/components/lists/ListsView.tsx
- [x] T024 [P] [US3] Empty-region sweep per contract C5: replace bare "—" in frontend/src/components/calendar/DayColumn.tsx and dashboard/SevenDayStrip.tsx with quiet designed empties (FR-015, F-25)

**Checkpoint**: quickstart §4 passes; ActivityLog shows complete+reopen pairs after Undo (Sheet check).

## Phase 6: User Story 4 — Desktop behaves like desktop (P2)

**Goal**: no occlusion, bounded columns.
**Independent test**: quickstart §6.

- [x] T025 [US4] frontend/src/components/shell/AppShell.tsx: desktop `<main>` bottom clearance or quick-add relocation so the affordance can never occlude interactive content at any scroll position (FR-016, F-08)
- [x] T026 [US4] Bounded content column at desktop widths for leaf/form views (Settings + More leaves via frontend/src/components/more/MoreView.tsx wrapper; audit F-13) — forms ~640px, content ~1100px per DESIGN.md

## Phase 7: User Story 5 — Tasks and Lists without the noise (P2)

**Goal**: horizon grouping, single Someday home, shared persistent filter, one add per context.
**Independent test**: quickstart §7.

- [x] T027 [US5] Horizon grouping helper in frontend/src/lib/tasks.ts (+ tasks.test.ts): This week / Next week / Later using household-timezone week boundaries; render groups with headings + counts in frontend/src/components/task/TasksView.tsx (FR-017)
- [x] T028 [US5] Quieter commitment affordance + consistent row alignment in TasksView rows (visually subordinate to titles, still one tap) (FR-018)
- [x] T029 [P] [US5] Someday single home: remove SomedayList from the calendar branch of frontend/src/App.tsx (Tasks keeps it); at most a link from Calendar (FR-019, F-29)
- [x] T030 [US5] Shared owner filter: single context-provided useOwnerFilter instance in frontend/src/App.tsx consumed by Calendar and Tasks, persisted at `hq.ownerFilter`, all-deselected normalizes to all (+ update useOwnerFilter.test.ts) (FR-020, data-model OwnerFilterState)
- [x] T031 [US5] frontend/src/components/lists/ListsView.tsx affordance cleanup: one primary add per screen context (reconcile FAB/add-field/new-list-chip), staple-star meaning discoverable in-product (FR-021, F-15)

## Phase 8: User Story 6 — Account actions can't be mis-tapped (P3)

- [x] T032 [US6] Avatar menu in frontend/src/components/shell/AppShell.tsx (+ test): single tap opens identity menu (name + Sign out), never signs out directly; More→Account stays canonical (FR-022, F-28)

## Phase 9: Polish & cross-cutting

- [x] T033 A11y sweep (FR-023): axe run on Dashboard/Tasks/Calendar/Settings in both themes; verify real accessible names on calendar item buttons + More rows (resolve audit F-20 anomaly); restyle Settings toggle + disabled primary button to be visibly stateful in both themes
- [x] T034 Full quickstart.md validation (§1–§9) against the deployed build with a dev session token; fix findings; record contrast run + theme matrix results for the PR
- [x] T035 `/impeccable audit` on the finished surface; resolve or explicitly waive findings (definition of done)
- [x] T036 Write back any implementation deviations into spec.md/audit.md; update BACKLOG.md (032 → implement/deployed)

## Dependencies

- Phase 2 blocks everything (theme engine first — all later DoD includes both-theme verification)
- US1 (Phase 3) blocks nothing structurally but is P1 and validates the engine — do first
- US2–US6 are mutually independent; recommended order = priority order
- Within US3: T018→T019, T021→T022/T023; T020, T024 free
- Polish (Phase 9) last

## Parallel opportunities

- Phase 1: T002 ∥ T001
- US1: T008 ∥ T009 ∥ (T007 after T006)
- US2: T015 ∥ T016 ∥ T017 after T013/T014
- US3: T020 ∥ T024 ∥ the T018/T021 chains
- US5: T029 ∥ T027/T028

## Implementation strategy

**MVP = Phase 1+2+3 (US1)**: dark mode end-to-end is independently shippable and the headline ask. Then US2 (dashboard) as the second increment; US3–US6 in order; single PR per the feature convention, but each checkpoint is a coherent review/validation point. Total: **36 tasks** (US1: 6, US2: 5, US3: 7, US4: 2, US5: 5, US6: 1, setup/foundation/polish: 10).
