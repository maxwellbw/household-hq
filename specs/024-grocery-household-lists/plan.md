# Implementation Plan: Grocery & Household Lists

**Branch**: `024-grocery-household-lists` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-grocery-household-lists/spec.md`

## Summary

Two new Sheet tabs — **Lists** (a named list) and **ListItems** (rows belonging to a
list) — plus a new bottom-nav **Lists** screen that replaces the current Feed tab (Feed
moves into More, alongside Recurring/Templates/Settings). Items persist forever and flip
between `need`/`stocked` in one tap via a dedicated `listItems.toggle` action; adding a
name that already exists on the same list reuses and flips the existing row instead of
duplicating it. A fixed six-value store-section vocabulary (produce/dairy/frozen/pantry/
household/other) groups the "needed" view into aisle order. The staple-nudge signal is
computed client-side, the same way Home's existing Smart Views/Load-Balance signals are
(`dashboard.ts`) — no new backend aggregation — against a new Settings key
(`groceryStapleNudgeThreshold`, default 3, added to `EDITABLE_SETTINGS`). Every
create/update/delete/toggle logs to ActivityLog via the existing generic Sheets.js helpers,
following the same pattern as Recurring (018) and Tasks.

## Technical Context

**Language/Version**: Google Apps Script (V8, ES2015+) backend; TypeScript + React + Vite
frontend (matches the rest of the repo).

**Primary Dependencies**: Backend — none (Apps Script built-ins only), reuses the generic
`listRecords_`/`createRecord_`/`updateRecordById_`/`deleteRecordById_`/`withLock_` helpers
in `Sheets.js`. Frontend — existing React/Tailwind/shadcn stack; no new packages.

**Storage**: The single Google Sheet. Two new tabs: **Lists** (`id`, `name`) and
**ListItems** (`id`, `listId`, `name`, `status`, `section`, `staple`, `note`). Provisioned
by `setupDatabase()` the same way the existing six tabs are (header row, plain-text
formatting, frozen row 1) — no changes to existing tabs.

**Testing**: Backend — `SelfTest.js` (`selfTest()`), run from the Apps Script editor.
Frontend — Vitest (`npm run build` + component tests), matching `tasks.test.ts` /
`dashboard.test.ts` style for the new `lists.ts` lib module.

**Target Platform**: Apps Script web-app backend + GitHub Pages PWA frontend.

**Project Type**: Web (backend + frontend) — full-stack feature (new tabs, new API
actions, new screen, nav change).

**Performance Goals**: Single-tap status flip must feel instant (SC-002, <1s) — the
frontend does an optimistic local update before the `listItems.toggle` round-trip
resolves, matching how `tasks.complete`/`snooze` already behave in the task UI.

**Constraints**: Constitution II (Sheet stays human-readable/hand-editable — `status`,
`section`, `staple` are plain enum/boolean strings, not encoded blobs), V (idempotent
writes — toggling an already-`need` item to `need` is a no-op, no duplicate log row,
mirroring `setTaskLifecycle_`'s already-done short-circuit), VI (every state change
logged). Apps Script 6-min limit is a non-issue for single-row list operations.

**Scale/Scope**: Two users; an open-ended number of lists and items (household grocery +
a handful of specialty lists), expected to stay in the tens-to-low-hundreds of items —
well within a single `getDataRange().getValues()` read. ~2 new backend data/logic
additions (Config.js enums/headers, ListItems.js handlers) + ~1 nav change +
~1 new frontend screen + ~1 new lib module (`lists.ts`, mirroring `tasks.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ No roles/tenancy; List/ListItem have no owner field at all
  (household-shared by construction, simpler than Tasks/Events which need `max`/`jaz`/
  `both`) — deliberately less machinery than the existing owner-bearing tabs, not more.
- **II. The Sheet Is Source of Truth / hand-editable** — ✅ Two new tabs, same
  header-row/UUID/plain-text-cell conventions as the existing six; `status` ∈
  need/stocked, `section` ∈ the fixed six-value vocabulary, `staple` ∈ TRUE/FALSE — all
  plain, hand-editable strings, no serialized blobs.
- **III. Free-Tier Only** — ✅ No new services; the nudge is computed from data already
  fetched, no new external call.
- **IV. Boring & Debuggable** — ✅ Reuses the exact generic CRUD helpers every other tab
  uses; the only new mechanism is the name-based reuse-and-flip on create, which is a
  single case-insensitive lookup, not a new abstraction.
- **V. Idempotent Generation** — ✅ `listItems.toggle` and the reuse-on-create path are
  both no-op-safe (re-toggling to the same status, or re-adding an already-`need` item,
  changes nothing and logs nothing new).
- **VI. Every State Change Logged** — ✅ create/update/delete/toggle on both tabs each
  append exactly one ActivityLog row via `createRecord_`/`updateRecordById_`/
  `deleteRecordById_`, same as every other entity.
- **VII. Spec-Driven Development** — ✅ This spec/plan; two clarifications recorded
  (store-section vocabulary, nudge threshold).

**Result: PASS.** No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/024-grocery-household-lists/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── api-024.md         # lists.* / listItems.* action contracts
├── checklists/
│   └── requirements.md   # From /speckit-specify + /speckit-clarify
└── tasks.md              # /speckit-tasks output (not created here)
```

### Source Code (repository root)

```text
backend/
├── Config.js       # TABS.LISTS/LIST_ITEMS, HEADERS, ID_TABS, new enums
                     # (LIST_ITEM_STATUSES, LIST_SECTIONS), FIELD_TYPES,
                     # REQUIRED_ON_CREATE, SETTINGS_SEED + EDITABLE_SETTINGS addition
                     # (groceryStapleNudgeThreshold)
├── Validation.js    # isValidType_: add 'listItemStatus', 'listSection', 'bool' cases;
                     # validateSettingValue_: add groceryStapleNudgeThreshold case
├── Lists.js         # NEW — createList_/deleteList_ (cascades ListItems),
                     # createListItem_ (reuse-and-flip-on-name-match), updateListItem_,
                     # toggleListItem_, deleteListItem_
├── Api.js           # HANDLERS: lists.list/create/delete,
                     # listItems.list/create/update/toggle/delete
├── Setup.js         # setupDatabase() order array: append TABS.LISTS, TABS.LIST_ITEMS
└── SelfTest.js       # extend with list/listItem CRUD + toggle + reuse-on-create asserts

frontend/src/
├── types/domain.ts                  # List, ListItem, ListItemStatus, ListSection types
├── lib/
│   ├── api.ts                        # lists./listItems. typed client methods
│   ├── lists.ts                      # NEW — grouping-by-section, staple-nudge-count logic
│   └── lists.test.ts                 # NEW
├── components/
│   ├── shell/navItems.ts             # NAV_ITEMS: 'feed' → 'lists' (icon change), keep 5 slots
│   ├── lists/
│   │   ├── ListsView.tsx             # NEW — list switcher + needed/all toggle + add-item bar
│   │   ├── ListItemRow.tsx           # NEW — one-tap status control, section/staple/note edit
│   │   └── ListsView.test.tsx        # NEW
│   ├── more/MoreView.tsx             # add a Feed subscreen entry (Feed moves here)
│   └── dashboard/                    # add the staple-nudge banner (reads Settings threshold
│                                      # + listItems, same pattern as other dashboard signals)
└── App.tsx                          # 'lists' NavSection → ListsView; 'feed' route removed
                                      # from the bottom nav, rendered via MoreView instead
```

**Structure Decision**: Existing web layout (`/backend` Apps Script, `/frontend` Vite). One
new backend file (`Lists.js`, mirroring how `Recurring.js`/`PrepTasks.js` are their own
files rather than living in `Api.js`); one new frontend feature directory
(`components/lists/`) plus a `lib/lists.ts` module, mirroring `lib/tasks.ts`. The Feed tab
becomes a More subscreen — a nav change, not a deletion (`FeedView.tsx` is unchanged, just
re-hosted).

## Complexity Tracking

> No Constitution violations — section intentionally empty.
