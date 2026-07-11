# Contracts: UX Fix Batch 2

**No new API contracts.** This feature adds no backend actions. It wires the frontend into actions that already exist and are contracted elsewhere.

## Existing actions reused

| Action | Payload | Response | Contract source |
|--------|---------|----------|-----------------|
| `tasks.snooze` | `{ id, dueDate }` | `{ task }` | feature 012 |
| `tasks.delete` | `{ id }` | `{ id }` | feature 007 (`contracts/api-007.md` — mirror cleanup) |
| `events.delete` | `{ id }` | `{ id }` | feature 007 (`contracts/api-007.md` — mirror cleanup) |

All three are already registered in `backend/Api.js` `HANDLERS` and covered by `backend/SelfTest.js`. The frontend calls them through the generic `authedCall(action, payload)` in `useAuth`, so no frontend API registry change is needed either.

## Error handling contract (frontend)

Delete calls that target an already-removed row surface as an `ApiError`; the UI treats any delete failure as "already gone / transient": show a toast and invalidate the affected query so the list refreshes to truth (spec FR-012). No new error codes are introduced.
