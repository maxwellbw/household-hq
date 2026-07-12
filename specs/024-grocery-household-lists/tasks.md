---

description: "Task list for Grocery & Household Lists (024)"
---

# Tasks: Grocery & Household Lists

**Input**: Design documents from `/specs/024-grocery-household-lists/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-024.md](./contracts/api-024.md), [quickstart.md](./quickstart.md)

**Tests**: No dedicated TDD phase — this repo's convention (see 023) is to extend
`SelfTest.js` and add `.test.ts` files alongside the implementation task that needs them,
not as a separate red-then-green phase.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) so each story
is independently implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md's US1–US5
- File paths are exact

---

## Phase 1: Setup (Schema)

**Purpose**: Provision the two new Sheet tabs and their typed columns — nothing else can
be built until the Sheet has somewhere to write.

- [X] T001 Add `TABS.LISTS`/`TABS.LIST_ITEMS`, `HEADERS.Lists`/`HEADERS.ListItems`, and
      append both to `ID_TABS` in `backend/Config.js`
- [X] T002 Add `LIST_ITEM_STATUSES` and `LIST_SECTIONS` enums, `FIELD_TYPES.ListItems`
      (`status: 'listItemStatus'`, `section: 'listSection'`, `staple: 'bool'`), and
      `REQUIRED_ON_CREATE.Lists`/`REQUIRED_ON_CREATE.ListItems` in `backend/Config.js`
- [X] T003 [P] Add `isValidType_` cases for `listItemStatus`, `listSection`, and `bool` in
      `backend/Validation.js`
- [X] T004 Add `groceryStapleNudgeThreshold` to `SETTINGS_SEED` (default `'3'`) in
      `backend/Config.js`
- [X] T005 Append `TABS.LISTS`, `TABS.LIST_ITEMS` to the `order` array in
      `setupDatabase()` in `backend/Setup.js`

**Checkpoint**: Running `setupDatabase()` from the Apps Script editor provisions the
`Lists`/`ListItems` tabs with headers, frozen row 1, and plain-text formatting.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The read path and screen shell every user story renders into. No user story
below can be demoed without this phase, but it deliberately excludes all *write* actions
(those are each story's own value-add).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create `backend/Lists.js` with `listLists_()`/`listListItems_(listId)` thin
      wrappers over `listRecords_` (`listItems_` optionally filters by `listId`)
- [X] T007 Register `lists.list` and `listItems.list` in the `HANDLERS` map in
      `backend/Api.js`
- [X] T008 [P] Add `List`, `ListItem`, `ListItemStatus` (`'need' | 'stocked'`), and
      `ListSection` (`'produce' | 'dairy' | 'frozen' | 'pantry' | 'household' | 'other' | ''`)
      types in `frontend/src/types/domain.ts`
- [X] T009 [P] Add `listsApi`/`listItemsApi` read methods (`list`, `listItems`) to
      `frontend/src/lib/api.ts`, following the existing `tasksApi`/`eventsApi` shape
- [X] T010 Swap `NAV_ITEMS`' `feed` entry for `lists` (new icon, e.g. `ShoppingCart`) in
      `frontend/src/components/shell/navItems.ts`
- [X] T011 Move `FeedView` into a `MoreView` subscreen (mirroring the existing
      Recurring/Templates/Settings subscreen pattern) in `frontend/src/components/more/MoreView.tsx`
- [X] T012 Wire the `'lists'` `NavSection` to a new (initially empty-state-only)
      `ListsView` in `frontend/src/App.tsx`, and remove the `'feed'` route from the bottom
      nav
- [X] T013 Create `frontend/src/components/lists/ListsView.tsx`: fetches lists + items on
      mount, renders a list switcher and a "create your first list" empty state when zero
      lists exist (no add/toggle/delete yet — those land in later stories)

**Checkpoint**: The Lists tab is reachable in the bottom nav, shows an empty state or the
existing (still-uncreatable) lists, and Feed still works from More. Nothing is writable
yet — that's every subsequent phase.

---

## Phase 3: User Story 1 - Flip an item between need and stocked (Priority: P1) 🎯 MVP

**Goal**: A one-tap, persistent, optimistic status flip on an existing item.

**Independent Test**: Seed one item by hand in the Sheet's `ListItems` tab, open the
Lists screen, tap its status control, confirm it flips and survives a reload.

### Implementation for User Story 1

- [X] T014 [US1] Implement `toggleListItem_(id, actor)` in `backend/Lists.js`: flips
      `status` need⇄stocked, no-op-safe re-read-before-write (mirrors
      `setTaskLifecycle_`'s already-done short-circuit), logs `list-item-need` or
      `list-item-stocked`
- [X] T015 [US1] Add `ACTION_VERBS['list-item-need']` = `'marked needed'` and
      `ACTION_VERBS['list-item-stocked']` = `'marked stocked'` in `backend/Config.js`
- [X] T016 [US1] Register `listItems.toggle` → `toggleListItem_` in the `HANDLERS` map in
      `backend/Api.js`
- [X] T017 [US1] Extend `SelfTest.js` with a toggle round-trip assertion (flip, flip back,
      re-toggle-to-same-status is a no-op with no new ActivityLog row)
- [X] T018 [US1] [P] Add `listItemsApi.toggle` method to `frontend/src/lib/api.ts`
- [X] T019 [US1] Create `frontend/src/components/lists/ListItemRow.tsx`: renders one item
      with a tappable status control that optimistically flips local state before the
      `listItemsApi.toggle` call resolves, rolling back on error
- [X] T020 [US1] Wire `ListItemRow` into `ListsView.tsx` for whatever items already exist
      (still no add-item UI — that's US2)

**Checkpoint**: Flipping a hand-seeded item's status works end-to-end and persists across
reload — User Story 1 is independently demoable.

---

## Phase 4: User Story 2 - Add a new item quickly (Priority: P1)

**Goal**: Type a name, hit enter, item appears `need`; optional section/staple/note;
re-adding an existing name flips it instead of duplicating.

**Independent Test**: From `ListsView`, add an item by name only; confirm it appears
`need` with no other fields set; add the same name again and confirm no duplicate row is
created.

### Implementation for User Story 2

- [X] T021 [US2] Implement `createListItem_(payload, actor)` in `backend/Lists.js`:
      validates `listId` exists (`NOT_FOUND` if not), case-insensitive/trimmed name match
      against existing items on that `listId` → flip-to-need (no-op if already `need`,
      leaving other fields untouched) or create a new row defaulting `status='need'`,
      `section=''`, `staple='FALSE'`, `note=''` (contracts/api-024.md reuse-and-flip)
- [X] T022 [US2] Implement `updateListItem_(payload, actor)` in `backend/Lists.js`:
      patches `name`/`section`/`staple`/`note`; rejects a `status` key with
      `BAD_REQUEST` (use `listItems.toggle`)
- [X] T023 [US2] Register `listItems.create` and `listItems.update` in the `HANDLERS` map
      in `backend/Api.js`
- [X] T024 [US2] Extend `SelfTest.js`: reuse-and-flip create (duplicate name → same row,
      flipped, not a new row), reject non-`need` create status, reject `status` on update
- [X] T025 [US2] [P] Add `listItemsApi.create`/`update` methods to `frontend/src/lib/api.ts`
- [X] T026 [US2] Add a low-friction "add item" input (name only, Enter-to-submit) to
      `ListsView.tsx`, calling `listItemsApi.create` and inserting the result optimistically
- [X] T027 [US2] Add an item-edit affordance (tap to expand) in `ListItemRow.tsx` for
      section/staple/note, calling `listItemsApi.update`

**Checkpoint**: Items can be added in under 5 seconds by name alone (SC-001), edited for
section/staple/note, and re-adding a name never duplicates (SC-006).

---

## Phase 5: User Story 3 - View the needed list in aisle order (Priority: P2)

**Goal**: A needed-only view grouped by the fixed section order, with unsectioned items
under Other; a separate all-items view for management.

**Independent Test**: Populate items across 3+ sections plus one unsectioned item; open
the needed view; confirm grouping/order matches `LIST_SECTIONS` with unsectioned under
Other, and stocked items are absent.

### Implementation for User Story 3

- [X] T028 [US3] [P] Create `frontend/src/lib/lists.ts`: `groupNeededBySection(items)` —
      filters `status === 'need'`, groups by `section` (blank → `'other'`), returns groups
      in the fixed `produce, dairy, frozen, pantry, household, other` order, omitting empty
      groups
- [X] T029 [US3] [P] Create `frontend/src/lib/lists.test.ts` covering: fixed order,
      unsectioned-under-other, empty groups omitted, stocked items excluded
- [X] T030 [US3] Add a Needed/All view toggle to `ListsView.tsx`; Needed renders via
      `groupNeededBySection` with section headings, All renders every item ungrouped
      (management view, including stocked)
- [X] T031 [US3] Add a "nothing needed" empty state to the Needed view and a "no items
      yet" empty state to the All view (Edge Cases)

**Checkpoint**: The needed view reads in aisle order and the all-items view supports full
management — User Story 3 is independently demoable on top of US1+US2.

---

## Phase 6: User Story 4 - Manage multiple lists (Priority: P2)

**Goal**: Create/switch/delete lists; each list's items and statuses are independent.

**Independent Test**: Create a second list, add distinct items, switch between lists,
confirm isolation; delete a list and confirm its items are gone too.

### Implementation for User Story 4

- [X] T032 [US4] Implement `createList_(payload, actor)` and `deleteList_(id, actor)` in
      `backend/Lists.js` — delete cascades to every `ListItems` row with matching
      `listId` before deleting the `Lists` row itself
- [X] T033 [US4] Register `lists.create` and `lists.delete` in the `HANDLERS` map in
      `backend/Api.js`
- [X] T034 [US4] Extend `SelfTest.js`: list create, cascade-delete removes all its items
      (and only its items), deleting a non-existent list is `NOT_FOUND`
- [X] T035 [US4] [P] Add `listsApi.create`/`delete` methods to `frontend/src/lib/api.ts`
- [X] T036 [US4] Add a list switcher (tabs or dropdown) + "new list" + "delete list"
      controls to `ListsView.tsx`, scoping the items query/render to the selected `listId`
- [X] T037 [US4] Handle the zero-lists state gracefully in `ListsView.tsx` (create-first-list
      prompt, not an error) — extends the empty state from T013

**Checkpoint**: Groceries, Costco, Hardware, Pharmacy can coexist with fully independent
item sets — User Story 4 is independently demoable.

---

## Phase 7: User Story 5 - Get nudged when it's time to shop (Priority: P3)

**Goal**: A Home dashboard nudge when enough staple items are `need`, using a
Settings-editable threshold (default 3).

**Independent Test**: Flag 3+ items staple + need across any lists; confirm the Home
dashboard nudge appears; drop below threshold; confirm it disappears.

### Implementation for User Story 5

- [X] T038 [US5] Add `'groceryStapleNudgeThreshold'` to `EDITABLE_SETTINGS` and a `posint`
      case in `validateSettingValue_` in `backend/Api.js` / `backend/Config.js`
- [X] T039 [US5] [P] Add `groceryNeededStapleCount(items)` and
      `shouldShowGroceryNudge(items, thresholdSetting)` helpers to
      `frontend/src/lib/lists.ts`
- [X] T040 [US5] [P] Extend `frontend/src/lib/lists.test.ts` with nudge threshold
      boundary cases (exactly at threshold shows, one below does not)
- [X] T041 [US5] Fetch `listItemsApi.listItems()` + the settings value on the Home
      dashboard and render a nudge banner using the new helpers in
      `frontend/src/components/dashboard/` (existing dashboard component location)

**Checkpoint**: The nudge appears/disappears correctly and its threshold is editable from
Settings without a code change — User Story 5 is independently demoable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Completeness items not tied to a single spec'd user story.

- [X] T042 [P] Implement `deleteListItem_(id, actor)` in `backend/Lists.js` and register
      `listItems.delete` in `backend/Api.js` (outright item removal, e.g. "we don't buy
      that brand anymore" — distinct from toggling to stocked)
- [X] T043 [P] Add a delete affordance to `ListItemRow.tsx`'s edit view, calling the new
      `listItemsApi.delete`
- [X] T044 Run `/impeccable audit` on `ListsView.tsx`/`ListItemRow.tsx` before merging
      (CLAUDE.md Definition of Done)
- [ ] T045 Run the full `quickstart.md` validation end-to-end (A–G) against the deployed
      backend + built frontend

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only. MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; independent of US1 (different
  actions), but naturally follows it since `ListItemRow` (T019) is reused.
- **User Story 3 (Phase 5)**: Depends on Foundational + at least US2 existing (needs items
  to group); purely additive rendering logic.
- **User Story 4 (Phase 6)**: Depends on Foundational only — could be built before US2/US3
  if desired, since list CRUD is independent of item CRUD.
- **User Story 5 (Phase 7)**: Depends on Foundational + US2 (needs the `staple` field to
  be settable) + US4 (nudge counts "across all lists").
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- T003 (Validation.js) can run alongside T001/T002 (Config.js) — different files.
- T008/T009 (frontend types/api client) can run in parallel with T006/T007 (backend
  read handlers) — no shared files.
- Within each story, the `[P]`-marked lib/type/api-client tasks can run in parallel with
  each other; backend handler tasks and their `Api.js` registration are sequential
  (registration depends on the handler existing).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational).
2. Complete Phase 3 (US1 — flip status on a hand-seeded item).
3. **STOP and VALIDATE**: quickstart.md §C against a manually-seeded `ListItems` row.
4. Deploy/demo if ready — proves the core mechanic before building add/manage/nudge.

### Incremental Delivery

1. Setup + Foundational → nav + empty Lists screen live.
2. US1 → flip works (MVP).
3. US2 → add-item works (now genuinely usable end-to-end for one list).
4. US3 → aisle-order needed view (the "payoff" moment).
5. US4 → multiple lists.
6. US5 → dashboard nudge.
7. Polish → item delete, `/impeccable audit`, full quickstart pass.

Each step is independently demoable per spec.md's own story priorities (P1 → P3).

---

## Implementation Notes (deviations from the plan above)

- **T009/T018/T025/T035** ("`listsApi`/`listItemsApi` ... in `frontend/src/lib/api.ts`"):
  the actual codebase convention (discovered mid-implementation) is react-query hooks
  calling `authedCall` directly (`useTasks.ts`, `useMutations.ts`), not a typed
  `lib/api.ts` client. Built `frontend/src/hooks/useLists.ts` (reads) and
  `frontend/src/hooks/useListMutations.ts` (writes) instead — same behavior, matches
  existing patterns.
- **T041**: the nudge banner lives in a new `frontend/src/components/dashboard/GroceryNudge.tsx`
  (mirrors `AckNotices.tsx`'s banner styling) rather than being inlined into an existing file.
- **T044 audit** found and fixed one real issue: the list switcher and Needed/All toggle
  used `role="tablist"`/`role="tab"` without keyboard arrow-nav or `tabpanel` roles (an
  incomplete ARIA widget pattern). Replaced with plain `aria-pressed` toggle buttons,
  matching `OwnerFilterChips`'s existing convention. Also fixed a sub-44px touch target
  and added a missing `aria-label` on the list-name input.
- **T045 remains open**: full live validation needs `setupDatabase()` and `selfTest()` run
  from the Apps Script editor first (no API-executable deployment configured for
  `clasp run`, so this can't be done non-interactively) — see quickstart.md. Backend was
  pushed and redeployed to the existing web-app URL (deployment `AKfycbzQAE3gbDHzJnbKN-
  VoHt5VAU-Wx_TCROWtmQjS4iurjRR8-aaRlUykpDfPhnH3jTstQw @19`). Browser preview of the
  frontend was blocked by a port conflict with another concurrent session's dev server;
  `tsc --noEmit`, the full Vitest suite (332 tests), and `npm run build` all pass clean.
