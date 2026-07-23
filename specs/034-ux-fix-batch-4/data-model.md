# Data Model: UX Fix Batch 4

Only US3 changes stored data. The other four stories are presentation/behavior only.

## ListItem (ListItems tab)

Existing columns (unchanged): `id`, `listId`, `name`, `status` (`need`|`stocked`), `section`, `staple` (`TRUE`|`FALSE`), `note`, `seedKey`.

### New column: `stockedAt`

| Attribute | Value |
|---|---|
| Column name | `stockedAt` (appended to `HEADERS.ListItems`) |
| Type | Plain-text ISO-8601 datetime with offset, household timezone (e.g. `2026-07-20T14:32:11-07:00`); empty string when never stocked |
| Written by | `setListItemStatus_` only, on the transition **to** `stocked` |
| Client-writable | **No** — server-managed; `createListItem_` and `updateListItem_` reject/ignore a client-supplied value (same treatment as `status`) |
| Read by | `listItems.list` → frontend `ListItem.stockedAt` |

**Lifecycle / state transitions**:

- `need → stocked`: set `stockedAt = now` (household-local ISO). This is the only writer.
- `stocked → need`: `stockedAt` is **preserved** (represents the last time stocked, not current status).
- `stocked → stocked` (no-op toggle): no write at all (`setListItemStatus_` already returns `changed: false` when status is unchanged) — `stockedAt` is not refreshed.
- New item created (`createListItem_`): `stockedAt` empty (items always start `need`).
- Item hand-edited in the sheet: tolerated; a blank or malformed value is treated as "no date" by the frontend.

**Idempotency & logging**: The write rides the existing `LockService`-wrapped `setListItemStatus_` and its `list-item-stocked` ActivityLog append — no new log action, no new lock, no new mutation path. Re-running the same toggle is a no-op.

**Migration**: `setupDatabase()` (Setup.js) appends the `stockedAt` header to row 1 of the ListItems tab if missing, without disturbing existing columns/data. Run once after `clasp push`. Existing items have an empty `stockedAt` until next stocked.

## Frontend type

```ts
// frontend/src/types/domain.ts
export interface ListItem {
  id: string
  listId: string
  name: string
  status: ListItemStatus       // 'need' | 'stocked'
  section: ListSection
  staple: 'TRUE' | 'FALSE'
  note?: string
  stockedAt?: string           // NEW — ISO datetime, household tz; absent/empty if never stocked
}
```

## Not persisted (transient UI state)

- **US4 All-view toggles** (`alphabetical`, `groupBySection`): React component state in `ListsView`, not stored in the Sheet or across sessions.
- **US1 pending-booking override**: uses the existing booking payload with `confirmOverride: true`; no schema change.
- **US2 schedule dialog owner seed**: uses the task's existing `owner`; no schema change.
