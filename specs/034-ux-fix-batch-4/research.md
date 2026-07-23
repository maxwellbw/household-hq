# Research: UX Fix Batch 4

Phase 0 decisions. Each story is independent; findings are grounded in the current code.

## R1 — US1: Making the dog-walk override reachable

**Finding**: The backend already implements the full override. `bookWalkManually_` (backend/DogWalk.js:1288) only rejects a gate-failing or conflicting window with `OVERRIDE_REQUIRED` (carrying `failedGates` + named `conflicts`) **when `payload.confirmOverride !== true`**; passing `confirmOverride: true` books it. Truly-invalid windows (outside the date, already-started, wrong duration) return `BAD_REQUEST` and are *not* overridable. The frontend already handles `OVERRIDE_REQUIRED` (DogWalkPlanner.tsx `attemptBook` → `overrideInfo` → "Book anyway"), but never reaches it: the Book and Book-backup buttons are `disabled` whenever `validatePendingWindow` returns `!ok`, and that helper returns `!ok` for busy overlaps and gate failures too — not just out-of-band windows.

**Decision**: Split the client pre-check into two outcomes:
- **Blocking** (keep Book disabled): the window is outside the walk-eligible hours (the existing "Outside the walk-eligible hours" reason). This mirrors the backend's non-overridable `BAD_REQUEST`.
- **Overridable** (Book enabled, warning shown): busy conflict or weather-gate failure. Tapping Book submits without `confirmOverride`; the backend returns `OVERRIDE_REQUIRED`; the existing "Book anyway" panel appears and confirms with `confirmOverride: true`.

Implement by having `validatePendingWindow` (and the backup equivalent) return a `blocking: boolean` alongside `reason`, or return a discriminated reason category (`'out-of-band' | 'conflict' | 'gate'`). The Book button's `disabled` binds only to the blocking category (plus `bookWalk.isPending`). The warning text still renders for overridable cases so the user sees *why* before committing.

**Rationale**: Keeps the backend authoritative (no new override logic client-side), reuses the already-built confirmation UI, and preserves the one genuine guardrail (out-of-band). Matches FR-001..FR-006.

**Alternatives considered**:
- *Show the "Book anyway" panel immediately on client pre-check, skipping the first round-trip* — rejected: duplicates the backend's gate/conflict determination on the client (which is explicitly "best-effort, not authoritative"), risking a mismatch where the client warns but the backend would allow, or vice-versa. Let the backend decide.
- *Remove the client pre-check entirely* — rejected: the out-of-band guard is a useful, cheap, correct block; only the conflict/gate disabling is wrong.

## R2 — US2: The someday-scheduling flow (code walkthrough)

**Walkthrough of the current flow** (TasksView.tsx, TaskRow.tsx, ScheduleTaskDialog.tsx):

Open and Done task rows wire `onDetail` → open the **TaskDetailSheet** (view/edit), and pass `onSnooze`/`onEditDue` so the overflow menu works. The **Someday** section instead renders each `TaskRow` with **only** `onDetail={() => onScheduleSomeday(task.id)}` — no `onSnooze`, no `onEditDue`. Consequences:

1. **Tapping a someday task's title opens the Schedule dialog, not its details.** This is inconsistent with every other task row and means a someday task's detail/edit sheet is *unreachable* — you can't view or edit its title/notes/owner without first dealing with a scheduling modal.
2. **The overflow menu (⋮) is always rendered with "Snooze" and "Edit due", but both are dead no-ops for someday tasks** (`onSnooze?.()`/`onEditDue?.()` with undefined handlers). "Edit due" is exactly the action a someday task wants, yet it does nothing; scheduling is hidden behind the title tap instead.
3. **There is no visible, labeled "Schedule" affordance** — the primary action for a someday task is invisible and discovered only by tapping the title (which users expect to open details).
4. **The Schedule dialog forces re-picking an owner the task already has.** `ScheduleTaskDialog` starts `owner` at `null` with no pre-selection and `canConfirm` requires a non-null owner, so even a task already owned by (say) Max must have its owner re-chosen to schedule. Extra friction and a confusing "didn't I already set this?" moment.

**Decision** (concrete fixes; live visual confirmation happens at implementation-validation):
- **Make the someday row consistent**: `onDetail` opens the TaskDetailSheet like other rows. From the detail sheet the user can already edit the due date (TaskEditSheet notes "No date — this task will be in Someday."), which naturally schedules it.
- **Give the overflow menu a real "Schedule" item for someday tasks** (replacing the dead "Edit due" for undated tasks), wired to `onScheduleSomeday`. Remove/omit menu items whose handlers are undefined so there are no dead no-ops (a menu item only renders when its handler is provided).
- **Seed the Schedule dialog's owner from the task's current owner** (`initialOwner`), so scheduling a task that already has an owner is one tap (date) + confirm. The owner remains changeable.
- Keep the drag-to-calendar path (`initialDate`) unchanged.

**Rationale**: Restores a consistent mental model (title = details, menu = actions), eliminates dead controls, makes the primary action discoverable and labeled, and removes redundant owner re-entry — directly satisfying FR-007..FR-010 and SC-002.

**Alternatives considered**:
- *Keep title→schedule but add a separate details affordance* — rejected: doubles down on the inconsistency; every other row uses title→details.
- *Auto-schedule with the existing owner and only ask for a date* — deferred as a possible simplification but not required; keeping owner visible-and-prefilled is clearer than hiding it.

**Open for validation**: the exact menu wording ("Schedule" vs "Add a date") and whether the someday row should also show a subtle inline "Schedule" button will be confirmed in the browser during implementation validation and written back if changed.

## R3 — US3: Recording and showing last-stocked date

**Finding**: `HEADERS.ListItems` (backend/Config.js:79) is `['id','listId','name','status','section','staple','note','seedKey']`; columns are mapped by name and `setupDatabase()` (Setup.js) idempotently **appends any header present in `HEADERS` but missing from row 1** — so adding a column needs no manual sheet edit. Status changes flow through `setListItemStatus_` (backend/Lists.js:54), which already no-ops when unchanged and appends `list-item-stocked`/`list-item-need` to ActivityLog inside a `LockService` lock.

**Decision**:
- Add `'stockedAt'` to `HEADERS.ListItems`.
- In `setListItemStatus_`, when `targetStatus === 'stocked'` set `merged.stockedAt = <household-local ISO now>` on the same write. When toggling back to `need`, **leave `stockedAt` unchanged** (it means "last time stocked", independent of current status).
- Guard `stockedAt` against client writes: `createListItem_` and `updateListItem_` must not accept a client-supplied `stockedAt` (treat like `status` — server-managed). Since it becomes a known column, add it to the server-managed/read-only set rather than the mutable patch fields.
- Frontend: add `stockedAt?: string` to `ListItem`; render "stocked <short date>" (household tz, e.g. "stocked Jul 20") on the item row **only in the All view**; never-stocked items (empty `stockedAt`) show nothing.

**Rationale**: Reuses the single existing write path and its log + lock; plain ISO text keeps the sheet legible and hand-editable; server-managed field prevents drift. Satisfies FR-012..FR-016.

**Alternatives considered**:
- *Derive last-stocked from ActivityLog instead of a column* — rejected: the log is append-only and not indexed; scanning it per item per render is slow and fragile, and violates the "read a whole tab, operate in memory" simplicity. A materialized column is boring and direct.
- *Show the date in both Needed and All views* — rejected: the Needed view is the shop-this-now aisle list; a stocked-date badge there is noise. All view is the management view where freshness matters.

## R4 — US4: All-view arrangement

**Finding**: The All view currently renders `filteredItemsForList` in raw order (ListsView.tsx). Section order/labels already exist (`LIST_SECTIONS`, `LIST_SECTION_LABELS`, `groupNeededBySection`) and can be reused. Checkbox semantics: checked = `stocked`, unchecked = `need` (ListItemRow.tsx).

**Decision** (per clarifications 2026-07-22): Add a pure arrangement helper in `lib/lists.ts` taking `(items, { alphabetical, groupBySection })` and producing the All-view layout:
1. **Global split into two blocks**: all `stocked` (checked) items first, then all `need` (unchecked) items — unchecked always sinks below checked, regardless of toggles.
2. Within each block, **if `groupBySection`**: group by `LIST_SECTIONS` order (unsectioned → "Other"), emitting only non-empty sections; **else**: a single ungrouped run.
3. Within each group (or block), **if `alphabetical`**: sort by `name` (locale, case-insensitive); **else**: natural/insertion order.
The two toggles are independent (either/both/neither); default is neither → natural order, two blocks. Arrangement is deterministic and stable (stable sort; fixed section order).

ListsView holds two boolean toggle states (component state, not persisted); the All-view render consumes the helper's output. Toggles surface only in the All view (the Needed view keeps its existing section grouping).

**Rationale**: A pure helper is unit-testable and keeps the component thin; reusing the section constants avoids divergence with the Needed view. Satisfies FR-017..FR-020 and the two clarifications.

**Alternatives considered**:
- *Persist toggle state across sessions* — deferred; not requested. Local state is simpler and matches other view toggles (Needed/All itself isn't persisted).
- *Apply unchecked-at-bottom within each section rather than globally* — rejected by clarification Q2 (chose global two-block).

## R5 — US5: Staples count in the nudge

**Finding**: `groceryNeededStapleCount(items)` (lib/lists.ts) already returns the count that drives the nudge; `shouldShowGroceryNudge` gates on it. `GroceryNudge` currently renders static copy and receives only `show`/`onNavigate`.

**Decision**: Pass the count into `GroceryNudge` (new `count` prop, computed in DashboardHome from the same `groceryNeededStapleCount`) and render it in the text, e.g. "Running low on staples — {count} needed." Keep the copy calm and singular-aware ("1 needed" vs "5 needed").

**Rationale**: Zero new data; one prop and a string. Satisfies FR-021/FR-022 and the earlier user decision (staples-needed count, not all-needed).

**Alternatives considered**: *Show a separate all-needed total too* — rejected; user chose the staples-needed count specifically, and one number keeps the nudge calm.

## Cross-cutting

- **Dates** render in the household timezone via the existing `datetime` helpers (FR-023).
- **Independence** (FR-024): the five stories touch disjoint files (only `lib/lists.ts` is shared between US4 and US5, in separate functions), so each can ship and be reviewed alone.
- **Testing**: frontend changes covered by Vitest alongside each file; US3 backend covered in `SelfTest.js` (stockedAt set on → stocked, preserved on → need, not client-writable).
