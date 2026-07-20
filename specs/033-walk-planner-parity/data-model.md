# Data Model — Feature 033

No new Sheet tabs. Changes are two Settings keys, two ActivityLog action vocabularies,
and derived frontend state.

## Settings (existing keyless tab) — new keys

| Key | Default | Meaning | Editable |
|---|---|---|---|
| `morningOverduePushHour` | `8` | Hour (0–23, household tz) the morning overdue push trigger fires | Sheet + Settings screen (`EDITABLE_SETTINGS`); change reinstalls the trigger via `settings.update` (digestHour precedent) |
| `eveningWalkPushHour` | `20` | Hour the night-before walk push trigger fires | same |

Both are plain integers, blank/invalid-safe (fall back to default), hand-editable
without breaking the app (constitution II).

## ActivityLog (existing tab) — new action values

| action | targetId | detail | Role |
|---|---|---|---|
| `notify-overdue` | `YYYY-MM-DD` (household date of the run) | summary of what was sent (count + truncated body) | Send record AND idempotency key — `alreadySent_`-style lookup under `LockService` blocks a second send for the same date |
| `notify-walk` | `YYYY-MM-DD` (tomorrow's date, the walk day) | booked window(s) or needs-decision, as pushed | same |

Existing `push-notify` rows (one per recipient fan-out, from `sendPushToPerson_`)
continue to be appended and are NOT the dedupe key (they record device-level outcomes).

## DogWalks (existing tab) — no schema change

Booked/needs-decision rows are newly *surfaced* (all calendar views, today card,
evening push) and newly *bookable* with arbitrary 15-min-aligned windows and
durations — all already supported by `bookWalkManually_` and the `dogwalks.day`
payload (031 contract). No column changes. "Backup slot" (FR-016) is UI copy for
the existing `slot: 'second'` wire value — `bookWalkManually_` only ever accepts
`'primary'` or `'second'` (`backend/DogWalk.js:1296`); there is no literal
`'backup'` slot on the wire.

## Frontend derived/UI state (not persisted)

| State | Home | Shape | Notes |
|---|---|---|---|
| `walkPlannerDate` | `App` (lifted from `DashboardHome`) | `string \| null` (dateKey) | Set by dashboard walk rows, walk notices, calendar walk chips, `?walk=` deep link; renders the planner sheet app-level |
| `calendarFocusDate` | `App` | `string \| null` | Now consumed via `onConsumedFocusDate` callback from `CalendarHome`'s mount effect (replaces the racy clear-on-tab-switch effect) |
| Deep-link param | URL (consumed once) | `?task=<id>` \| `?walk=<YYYY-MM-DD>` \| `?overdue=1` | Parsed + stripped by `lib/deeplink.ts`; see contracts/deeplink-urls.md |
| Needed counts | derived | `Map<listId, number>` | `neededCountByList(items)` selector over the cached ListItems |
| Notice tiers | derived | urgent (today/tomorrow) vs quiet; ≥2 quiet collapse | `dogWalkNotices` selector extension |
| Planner pending booking | `DogWalkPlanner` | `{slot, windowStart, windowEnd, durationMin}` | Start adjustable ±15 min, duration from day plan's `primaryDurationsMin`/`secondDurationMin`; client pre-validates against busy blocks + hourly gates |
| Sheet history entry | `history.state` | `{hqSheet: 'planner'}` | `useSheetHistory` hook; Back closes the sheet (FR-013) |

## Validation rules

- Notification sends: skip entirely (no log row) when the payload is empty — zero
  overdue tasks (morning) or no walk row for tomorrow (evening).
- Overdue definition (backend mirrors `lib/dashboard.ts`): `status === 'open'` AND
  dueDate non-empty AND `dueDate < today` (household tz). Snoozed tasks excluded.
- Adjusted booking windows: must lie inside the hour band, contain no busy overlap,
  and pass every hourly weather gate for the covered hours — client pre-check for UX,
  backend `bookWalkManually_` remains authoritative.
- Pill counts: `status === 'needed'` items only, per listId, filter-independent.
