# Data Model: Grocery & Household Lists

Two new Sheet tabs, added to the existing six (`Events`, `Tasks`, `TaskTemplates`,
`Recurring`, `ActivityLog`, `Settings`). Columns are provisioned/migrated by
`setupDatabase()` exactly like the existing tabs — hand-added extra columns are ignored
and preserved (Constitution II).

## Lists

| Column | Type | Required on create | Notes |
|---|---|---|---|
| `id` | UUID (text) | generated | `Utilities.getUuid()`, never client-supplied |
| `name` | text | ✅ | e.g. "Groceries", "Costco", "Hardware", "Pharmacy"; free text, no uniqueness enforced by the API (a hand-duplicated name is a household's own problem, same as e.g. two Events with the same title) |

No `owner`, no status, no timestamps beyond what `ActivityLog` already captures (research
R2). Deleting a `List` row cascades to delete every `ListItem` row with a matching
`listId` (mirrors `deleteEvent_`'s cascade to its prep Tasks).

## ListItems

| Column | Type | Required on create | Notes |
|---|---|---|---|
| `id` | UUID (text) | generated | |
| `listId` | text (foreign id) | ✅ | Must reference an existing `Lists` row (`NOT_FOUND` if not) |
| `name` | text | ✅ | The item name, e.g. "Milk" |
| `status` | `listItemStatus` enum | defaults `need` | ∈ `need` \| `stocked`. Never settable to anything else; a client-supplied `status` on create is rejected the same way Tasks rejects a non-`open` create status — new items always start `need` (FR-004), and `listItems.toggle` is the only way to flip it (research R4) |
| `section` | `listSection` enum | optional, defaults `''` (unsectioned) | ∈ `produce` \| `dairy` \| `frozen` \| `pantry` \| `household` \| `other` (clarified 2026-07-12). Blank is a distinct, legal "unsectioned" state, grouped with `other` in the needed view (FR-011, Edge Cases) |
| `staple` | `bool` enum | optional, defaults `FALSE` | ∈ `TRUE` \| `FALSE`, same convention as the existing Settings boolean keys (e.g. `ntfyEnabled`) |
| `note` | text | optional, defaults `''` | Free text, e.g. "2 bags", "the good brand" (FR-009) |

### State transitions

```
(create) ──► need ──toggle──► stocked ──toggle──► need ──toggle──► ...
```

- A `ListItem` is never deleted as part of the need⇄stocked cycle (FR-006) — only
  `listItems.delete` (explicit removal, e.g. "we don't buy that brand anymore") or a
  cascading `lists.delete` removes a row.
- Toggling to the item's current status is a no-op: no Sheet write, no ActivityLog row
  (idempotent, Constitution V — mirrors `setTaskLifecycle_`'s already-done short-circuit).
- Creating an item whose `name` (trimmed, case-insensitive) already exists on the same
  `listId` does not create a new row — it flips the existing row to `need` (a no-op if it
  was already `need`) and returns that row (FR-007, research R3). Other fields
  (`section`/`staple`/`note`) on the existing row are left untouched by a reuse-create;
  edit them afterward via `listItems.update`.

## New enumerations (Config.js)

```js
var LIST_ITEM_STATUSES = ['need', 'stocked'];
var LIST_SECTIONS = ['produce', 'dairy', 'frozen', 'pantry', 'household', 'other'];
// LIST_SECTIONS order is also the needed-view grouping/display order (FR-011).
```

## Settings addition

| Key | Default | Notes |
|---|---|---|
| `groceryStapleNudgeThreshold` | `3` | Editable via `settings.update` (added to `EDITABLE_SETTINGS`); count of staple items marked `need`, across all Lists combined, that triggers the Home dashboard nudge (FR-013, clarified 2026-07-12) |

## Relationship to existing entities

None. `ListItems` deliberately does **not** reuse or replace Tasks' existing `listItems`
column (a delimited string on a Task row, from an earlier feature) — that column is
untouched; this feature's `ListItems` tab is a wholly separate, standalone concept per the
spec's own framing ("not task-attached listItems").
