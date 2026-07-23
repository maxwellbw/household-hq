# Contracts: UX Fix Batch 4

This feature exposes no new API endpoints. It changes UI/behavior contracts and adds one
server-managed field on an existing endpoint. Contracts below are what tasks and tests
verify against.

## C1 — Dog-walk Book action reachability (US1)

**Component**: `DogWalkPlanner`

- The pending-booking pre-check classifies a window as one of: `out-of-band` (start/end outside the walk-eligible range), `conflict` (overlaps a busy block), `gate` (an overlapped hour fails a weather gate), or `ok`.
- **Book** / **Book backup** are `disabled` **only** when the window is `out-of-band` (or a request is in flight). For `conflict` and `gate` they are **enabled**, with the warning reason still shown.
- Tapping Book on a `conflict`/`gate` window submits **without** `confirmOverride`; the backend responds `OVERRIDE_REQUIRED` (named `failedGates`/`conflicts`); the "Book anyway" panel appears and, on confirm, resubmits with `confirmOverride: true`.
- On success the walk shows as booked and the pending/warning UI clears.

**Backend (unchanged, authoritative)**: `bookWalkManually_` — `OVERRIDE_REQUIRED` unless `confirmOverride === true`; `BAD_REQUEST` for structurally invalid windows.

## C2 — Someday task row parity (US2)

**Components**: `TasksView`, `TaskRow`, `ScheduleTaskDialog`

- A Someday-section `TaskRow` tap on the **title** opens the **TaskDetailSheet** (same as Open/Done rows) — not the schedule dialog.
- The row's overflow menu renders **only items with a provided handler** (no dead no-ops). For a someday task it offers **Schedule** (opens `ScheduleTaskDialog` for that task). Snooze/Edit-due items do not appear for someday tasks unless wired.
- `ScheduleTaskDialog` accepts an `initialOwner` and pre-selects it from the task's current owner; the owner is still changeable, and the date remains required to confirm (`canConfirm` unchanged in spirit — a date is still required).
- Cancelling/dismissing the dialog leaves the task unchanged (undated, same owner).

## C3 — List item last-stocked date (US3)

**Endpoint**: `listItems.list` response items gain `stockedAt` (see [data-model.md](../data-model.md)).

- `listItems.toggle` to `stocked` sets `stockedAt` server-side; toggling back to `need` preserves it.
- `listItems.create` / `listItems.update` MUST NOT set `stockedAt` from client input.
- **Component `ListItemRow`**: in the **All** view, an item with a non-empty `stockedAt` shows "stocked <short date>" (household tz); empty shows nothing. The Needed view is unchanged.

## C4 — All-view arrangement (US4)

**Component**: `ListsView` (All view) + pure helper in `lib/lists.ts`

- Two independent toggles: **Sort A–Z** (alphabetical by name) and **Group by section**. Either, both, or neither may be active; default = neither.
- Arrangement (deterministic, stable):
  1. Two global blocks — **stocked (checked) items above all needed (unchecked) items**.
  2. If Group-by-section: each block is grouped under `LIST_SECTIONS` headings (unsectioned → "Other"), empty sections omitted.
  3. If Sort A–Z: items within each group/block are name-sorted; else natural/insertion order.
- Toggles appear only in the All view; the Needed view is unchanged.

**Helper contract**:
```
arrangeAllView(items: ListItem[], opts: { alphabetical: boolean; groupBySection: boolean })
  → when groupBySection: Array<{ block: 'stocked'|'need'; section: ListSection; items: ListItem[] }>
  → when !groupBySection: Array<{ block: 'stocked'|'need'; items: ListItem[] }>
```
(Exact return shape may be refined in tasks; the invariants above are the contract.)

## C5 — Staples nudge count (US5)

**Component**: `GroceryNudge`

- Receives the staple-needed count (from `groceryNeededStapleCount`) and renders it in the banner text, e.g. "Running low on staples — 5 needed" (grammatically correct for 1).
- Appearance rule (`shouldShowGroceryNudge`) is unchanged.
