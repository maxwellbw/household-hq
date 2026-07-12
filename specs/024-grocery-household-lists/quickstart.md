# Quickstart: Grocery & Household Lists

Validates the core need⇄stocked flip, low-friction add with reuse-and-flip, aisle-order
grouping, multiple lists, and the staple nudge.

## Prerequisites

- Backend pushed + deployed: `cd backend && clasp push && clasp deploy -i <deploymentId>`.
- `setupDatabase()` re-run from the Apps Script editor (`cd backend && clasp open-script`)
  to provision the new `Lists`/`ListItems` tabs.
- Frontend builds clean: `cd frontend && npm run build`.

## A. Backend self-test (fast, isolated)

1. In the Apps Script editor, run **`selfTest()`**.
2. **Expected**: log includes new `LISTS: ALL PASS` / `LIST ITEMS: ALL PASS` sections
   covering: create/update/delete round-trip on both tabs, cascade-delete of items when
   their list is deleted, the reuse-and-flip create path (adding a duplicate name flips
   the existing row rather than creating a second, and is a true no-op — no new
   ActivityLog row — when that row is already `need`), and `listItems.toggle` flipping
   `need`⇄`stocked` on each call.

## B. Create a list and add items (US1/US2)

1. Open the app → **Lists** tab (bottom nav, where Feed used to be).
2. Create a list named "Groceries" (if one doesn't already exist from seeding).
3. Add three items by name only: "Milk", "Eggs", "Paper towels".
4. **Expected**: all three appear immediately, marked "need", with no section/staple/note.
5. Open the Sheet → **ListItems** tab → confirm three new rows with blank `section`/
   `staple`(`FALSE`)/`note`, `status = need`.

## C. Flip status in one tap (US1, SC-002)

1. Tap "Milk"'s status control.
2. **Expected**: it visually flips to "stocked" instantly (before any network round-trip
   completes — optimistic update), and the needed view re-renders without Milk.
3. Reload the page. **Expected**: Milk is still "stocked" (persisted).
4. Tap it again → back to "need".

## D. Aisle-order grouping (US3)

1. Edit "Milk" to set section = Dairy, "Eggs" section = Dairy, "Paper towels" section =
   Household. Add a fourth item "Apples" with no section set, needed.
2. Open the needed view. **Expected**: items grouped as Produce (empty) → Dairy (Milk,
   Eggs) → Frozen (empty) → Pantry (empty) → Household (Paper towels) → Other (Apples) —
   only non-empty sections render, in that fixed order, with unsectioned items under
   Other.

## E. Multiple lists (US4)

1. Create a second list, "Hardware".
2. Add "Wood screws" to it, needed.
3. Switch between Groceries and Hardware. **Expected**: each shows only its own items;
   toggling an item on one list never affects the other.
4. Delete the Hardware list. **Expected**: it disappears from the list switcher, and its
   ActivityLog entries + the cascaded item-delete are visible in the (now More-hosted)
   Feed.

## F. Staple nudge (US5)

1. In Settings, confirm `groceryStapleNudgeThreshold` = 3 (default).
2. Flag "Milk", "Eggs", and "Paper towels" as staples (via item edit).
3. Mark all three "need" (if not already).
4. Go to the Home dashboard. **Expected**: a nudge banner appears indicating it's time to
   shop.
5. Flip one staple item ("Milk") to "stocked". **Expected**: nudge disappears (2 < 3).
6. Lower `groceryStapleNudgeThreshold` to 2 in Settings, reload Home. **Expected**: nudge
   reappears without any item changes (2 staples still needed, now ≥ threshold).

## G. Empty states (Edge Cases)

1. Create a brand-new list with no items yet. Open its needed view. **Expected**: a
   positive "nothing needed" empty state, not a blank screen or error.
2. Delete every list. **Expected**: the Lists screen still renders (a "create your first
   list" state), not a crash.
