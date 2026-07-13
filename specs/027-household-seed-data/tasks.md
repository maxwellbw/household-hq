---
description: "Task list for 027 — Household Seed Data + Engine Extensions"
---

# Tasks: Household Seed Data + Supporting Engine Extensions

**Input**: Design documents from `specs/027-household-seed-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Row-level dataset**: `docs/seed-data.md` is the authoritative source for every seeded
value — transcribe from it, do not invent rows.

**Tests**: This project tests backend via editor-run `SelfTest.js` and frontend via Vitest;
test tasks are included to match that convention.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- Same-file tasks are intentionally **not** marked [P] (they serialize on the file)

## Path Conventions

Web app: `backend/*.js` (Apps Script), `frontend/src/**`.

---

## Phase 1: Setup (shared)

**Purpose**: The one cross-cutting enum both stories' engine work builds on.

- [X] T001 Extend the cadence enum with `semiannually` and `thanksgiving-sat`: add to `CADENCES` in `backend/Config.js` and to the `Cadence` union in `frontend/src/types/domain.ts` (keep the two lists identical, per contracts/engine-extensions.md §1).

---

## Phase 2: Foundational (blocking groundwork)

**Purpose**: Schema migration, engine primitives, and frontend cadence sync that the seed
packs and per-story verification depend on. **No user story is verifiable until this phase
is done** (US1 needs the schema; US2 needs the ordinal token; US3 needs the new cadences).

**Schema & Settings** (all `backend/Config.js` / `backend/Setup.js` — serialize):

- [X] T002 Add `seedKey` (optional, append last) to the SCHEMA column arrays and type maps for `Lists`, `ListItems`, `TaskTemplates`, `RecurringEvents` in `backend/Config.js`; do NOT add it to any required-on-create list (data-model.md §1).
- [X] T003 Migrate the four tabs to add the `seedKey` column in `backend/Setup.js` `setupDatabase()` (idempotent column-add, mirroring the existing migrations). *(No code change needed — `migrateHeaders_` already appends any `HEADERS[tab]` entry missing from row 1, generically, for every tab in `setupDatabase()`'s order list; T002's HEADERS update is sufficient.)*
- [X] T004 Add blank `listSeedApplied`, `templateSeedApplied`, `eventSeedApplied` to the Settings defaults in `backend/Config.js`; do NOT add them to `EDITABLE_SETTINGS` (data-model.md §2).

**Engine primitives**:

- [X] T005 In `backend/Recurring.js` `CADENCE_STEP_`, add `case 'semiannually'` → `addMonthsClamped_(ymd, 6)` and `case 'thanksgiving-sat'` → `addMonthsClamped_(ymd, 12)` (non-throwing fallback).
- [X] T006 In `backend/Recurring.js`, add pure helpers `fourthThursdayOfNovember_(year)` and `thanksgivingSaturday_(year)`, and a `thanksgiving-sat` special branch in `occurrencesInWindow_` that emits one Saturday-before-Thanksgiving per year in the window (contracts/engine-extensions.md §1).
- [X] T007 [P] In `backend/RecurringEvents.js`, add pure `ordinal_(n)` and `renderOccurrenceTitle_(ruleTitle, anchorDate, occurrenceDate)`, and route the occurrence `title` through it in `generateForEventRule_` (contracts/engine-extensions.md §2).
- [X] T008 [P] In `backend/Seed.js` `computeSeedAnchor_`, add regex-parsed anchorRules `today+Nmo` and `monthday-MM-DD` (reusing `addMonthsClamped_` / `nextMonthDayOnOrAfter_`), keeping the existing default `fail_` (data-model.md §6).

**Frontend cadence sync**:

- [X] T009 [P] Add labels `semiannually → "Every 6 months"` and `thanksgiving-sat → "Weekend before Thanksgiving"` and append both to the cadence dropdown arrays in `frontend/src/components/more/RecurringManager.tsx`, `frontend/src/components/more/RecurringEventsManager.tsx`, and `frontend/src/components/quickadd/QuickAddSheet.tsx` (plus `frontend/src/types/domain.ts`'s `Cadence` union).

**Engine unit tests**:

- [X] T010 [P] Extend `backend/SelfTest.js` with pure-helper asserts: `ordinal_` (1st/2nd/3rd/4th/11th/21st), `thanksgivingSaturday_`/`fourthThursdayOfNovember_` (2026→2026-11-21, 2027→2027-11-20, 2028→2028-11-18), `renderOccurrenceTitle_` (token replace + verbatim when no token), and `semiannually` stepping +6 months.

**Checkpoint**: schema migrated, cadences/token/anchors live, frontend compiles — stories can proceed.

---

## Phase 3: User Story 1 — Shopping lists appear stocked (Priority: P1) 🎯 MVP

**Goal**: Two real lists with correct sections, staples, and need/stocked status, seeded
idempotently.

**Independent test**: Run `seedLists()` on empty tabs → both lists + all §1 items appear
correct; re-run no-ops; a hand-deleted item stays gone (quickstart §C, §B).

- [X] T011 [US1] Add `LIST_SEED_PACK` to `backend/Config.js`: the two lists (`list-groceries`, `list-notgrocery`) and ~38 items, each with `seedKey`, `listSeedKey`, `name`, `section`, `staple`, `status`, transcribed from `docs/seed-data.md §1`.
- [X] T012 [US1] Implement `seedLists()` in `backend/Seed.js`: create the lists (resolve `listSeedKey → listId` by seedKey, capturing ids created this run), then write each item via `createRecord_(TABS.LIST_ITEMS, …)` with explicit `status`; idempotent via the `listSeedApplied` ledger + seedKey; per-item try/catch isolation; no-op writes nothing (contracts/seed-functions.md).
- [X] T013 [US1] Add a `liveSeedLists_()` assert to `backend/SelfTest.js` (wired into `selfTest()`): an isolated list pack seeds once, a second run adds/writes nothing, a hand-rename is preserved, and a hand-deleted seeded item is not resurrected.

---

## Phase 4: User Story 2 — Birthdays, anniversaries & prep (Priority: P1)

**Goal**: 8 birthdays + 5 anniversaries as yearly rules; anniversaries show ordinal titles;
each birthday auto-generates its prep task with the right owner and lead time.

**Independent test**: Run `seedEvents()` + `seedTemplates()` then `generateRecurringEvents()`
→ milestones appear, anniversary occurrences render "Nth …", birthday prep tasks generate
correctly (quickstart §D, §E).

- [X] T014 [US2] Add `EVENT_SEED_PACK` to `backend/Config.js`: 8 birthdays (`cadence:'annually'`, `anchorRule:'monthday-MM-DD'`, `defaultOwner:'both'`, `templateId:'bday-*'`, title `"<Name>'s birthday"`) and 5 anniversaries (`cadence:'annually'`, literal historical `anchorDate`, `{nth}` title, no templateId), from `docs/seed-data.md §2–§3`.
- [X] T015 [US2] Add the 8 per-birthday prep rows to `TEMPLATE_SEED_PACK` in `backend/Config.js` (each `eventType:'bday-*'`, that person's `taskTitle`, `offsetDays` ∈ {−7,−14,−21,0}, gift-buyer `defaultOwner`), from §2.
- [X] T016 [US2] Implement `seedEvents()` in `backend/Seed.js` (writes `RecurringEvents`; supports literal `anchorDate` OR `anchorRule`; idempotent via `eventSeedApplied` + seedKey).
- [X] T017 [US2] Implement `seedTemplates()` in `backend/Seed.js` (writes all `TEMPLATE_SEED_PACK` rows to `TaskTemplates`; idempotent via `templateSeedApplied` + seedKey).
- [X] T018 [US2] Extend `backend/SelfTest.js` (`liveSeedEventsAndTemplates_()`, wired into `selfTest()`): a seeded birthday rule → occurrence → prep task via the existing `syncPrepForEvent_` with correct owner + due-offset; a seeded anniversary occurrence's baked title equals the expected ordinal string; events + templates seeding is idempotent and deletion-permanent. *(Found and flagged, out of scope, a pre-existing anchor-date bug in feature 025's `liveRecurringEventGeneration_` — see spawned task `task_eed14e44`.)*

---

## Phase 5: User Story 3 — Recurring maintenance / yard / holiday / vet (Priority: P2)

**Goal**: The 13 recurring tasks scheduled with correct cadence/anchor/season/owner; the six
six-month cleans in six distinct months; Christmas lights on the computed weekend.

**Independent test**: Run `seedRecurringPack()` then `generateRecurringTasks()` → all §4–§7
rules present and correct; six cleans span six months; lights = Saturday before Thanksgiving;
leaf-cleanup off-season suppressed (quickstart §F).

- [X] T019 [US3] Append the 13 recurring-task rows to `SEED_PACK` in `backend/Config.js`: six `semiannually` cleans staggered `today+2mo…today+7mo` (dishwasher=max, washing-machine=jaz, rest both), leaf-cleanup (`biweekly`, `monthday-10-25`, season 10–12), rake-dirt-fence (`monthly`), tree-trim-winter (`annually`, `monthday-12-01`), tree-trim-spring (`annually`, `monthday-04-01`), holiday-shopping (`annually`, `fall-nov1`), christmas-lights (`thanksgiving-sat`), vet-annual (`annually`, `monthday-10-01`, owner max) — from `docs/seed-data.md §4–§7`.
- [X] T020 [US3] Extend `unitSeedPack_()` in `backend/SelfTest.js` (covers both `selfTest()` and the fast `selfTestSeedPack()` runner) for the widened pack: the six `semiannually` cleans resolve to six distinct calendar months with correct owners; leaf-cleanup is out-of-season in July and in-season in November; christmas-lights uses `thanksgiving-sat`; vet-annual is October 1 owned by Max; plus direct `computeSeedAnchor_` coverage for `today+Nmo`/`monthday-MM-DD`. *(The `thanksgiving-sat` "correct Saturday across ≥3 years" check lives in `unitThanksgivingAndOrdinals_` (T010), which exercises the same underlying `occurrencesInWindow_` mechanism this pack's `christmas-lights` entry uses — not duplicated here.)*

---

## Phase 6: User Story 4 — Prep templates for one-off events (Priority: P2)

**Goal**: "Guests arrive" and "Leaving for a trip" templates ready to attach to one-off
events, generating the right checklist.

**Independent test**: After `seedTemplates()`, create a one-off event of each type → prep
tasks generate at the right offsets and owners (quickstart §G).

- [X] T021 [US4] Append the `guests-arriving` (4 rows) and `leaving-trip` (5 rows) blocks to `TEMPLATE_SEED_PACK` in `backend/Config.js` from `docs/seed-data.md §8` (`seedTemplates()` from US2 seeds them unchanged).
- [X] T022 [US4] Extend `backend/SelfTest.js` (`liveSeedTripTemplateOnEvent_()`, wired into `selfTest()`): a real one-off event tagged with an isolated copy of the `leaving-trip` checklist generates all five prep tasks via the existing `events.create → syncPrepForEvent_` path with the specified offsets and owners (e.g. "Key under mat for dog sitter" day-of, `both`).

---

## Phase 7: User Story 5 — List search (Priority: P3)

**Goal**: Filter a list's items by name to find and flip one quickly. Frontend-only, fully
independent of the backend work.

**Independent test**: On a populated list, typing narrows to matching items in real time,
toggling still works, no-match shows an empty state, clearing restores (quickstart §H).

- [X] T023 [P] [US5] Add pure `filterItemsByName(items, query)` to `frontend/src/lib/lists.ts` (case-insensitive, trimmed substring on name) with unit tests in `frontend/src/lib/lists.test.ts`.
- [X] T024 [US5] Add a controlled search `<input>` to `frontend/src/components/lists/ListsView.tsx`, applying `filterItemsByName` to `itemsForList` before grouping in both Needed and All views; show an empty-result state on non-empty no-match; clearing restores the full list; `ListItemRow` toggle continues to work on filtered results. *(`npx tsc --noEmit` clean, 343/343 Vitest passing; a live browser click-through was blocked by the app's real Google sign-in wall, which the sandbox cannot complete — same documented constraint as features 016–022. A manual click-through is still recommended before/at merge.)*

---

## Phase 8: Polish & cross-cutting

- [X] T025 Add the `seedHousehold()` wrapper to `backend/Seed.js` calling `seedLists()` → `seedTemplates()` → `seedEvents()` → `seedRecurringPack()` (contracts/seed-functions.md).
- [X] T026 [P] Write back into `docs/seed-data.md` and `spec.md` any transcription deviations discovered while building the packs (DoD: deviations go into the spec, never silently shipped). *(No row-level deviations; added `docs/seed-data.md §11` documenting two implementation specifics not previously pinned down — birthday title phrasing, and that the `{nth}` token superseded the `countYears`-column sketch from §9.)*
- [X] T027 [P] `cd frontend && npm run build` clean + Vitest green; run `/impeccable audit` on the changed `ListsView` (WCAG AA) and fix findings. *(Build clean, 343/343 Vitest passing. Audit found + fixed two real issues: a 36px clear-button touch target below the project's 44px standard, and `text-ink-faint` icons at 3.06:1 — both bumped to the compliant tokens already used elsewhere in the file. 20/20 audit score after fixes.)*
- [X] T028 Update `BACKLOG.md` (add the 027 row + stage `implemented, pending PR`) and record the required post-merge editor steps: `setupDatabase()` → `selfTest()`/`selfTestSeedPack()` → `seedHousehold()` → `generateRecurringEvents()`/`generateRecurringTasks()` (quickstart §A–§B). *(Also: `clasp push` + `clasp deploy -i <existing deploymentId>` done — code live at @21, same web-app URL.)*

---

## Dependencies & completion order

- **Phase 1 (T001)** → all cadence-dependent work.
- **Phase 2 (T002–T010)** → blocks all stories. Within it: T002→T003 (schema then migrate); T005/T006 serialize on `Recurring.js`; T007/T008/T009/T010 are cross-file parallelizable.
- **US1 (P1)**: needs T002–T004. Independent of US2–US5.
- **US2 (P1)**: needs T002–T004, T007 (ordinal), T008 (`monthday-*`). Builds `seedTemplates()` (T017) that **US4 reuses**.
- **US3 (P2)**: needs T001, T005, T006, T008. Independent of US1/US2.
- **US4 (P2)**: needs **US2's T017** (`seedTemplates`) + T002/T003 (TaskTemplates seedKey).
- **US5 (P3)**: no backend dependency — can be done any time after Phase 1.
- **Polish (T025–T028)**: after the stories it summarizes (`seedHousehold` after all siblings exist).

## Parallel opportunities

- Within Phase 2: T007, T008, T009, T010 in parallel (distinct files).
- Across stories: **US1, US3, US5 can proceed in parallel** once Phase 2 is done (US5 even earlier). US4 waits on US2's `seedTemplates()`.
- Config.js is a single file touched by T002/T004/T011/T014/T015/T019/T021 — those **serialize** (not parallel), even though they belong to different stories.

## Implementation strategy

- **MVP = Phase 1 + Phase 2 + US1**: the lists are the highest-frequency surface; shipping
  them seeded is a demoable increment on its own.
- Then **US2** (the other P1) for milestones + prep, **US3/US4** (P2) for chores + templates,
  **US5** (P3 usability) any time. Each story is independently runnable/verifiable via its own
  seed function and quickstart section.
- **Post-merge (manual, editor):** `setupDatabase()` → `selfTest()`/`selfTestSeedPack()` →
  `seedHousehold()` — the sandbox can't execute Apps Script (tracked in T028/BACKLOG).
