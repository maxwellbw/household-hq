# Data Model — 028 UX Fix Batch 3

This batch adds **no new tabs, no new columns, and no new record types**. Changes are
one new Settings key and two behavioral notes on existing entities.

## Settings (existing keyless tab)

| Key | Default | Added by | Meaning |
|---|---|---|---|
| `recurringEventsYearlyLookaheadDays` | `366` | `setupDatabase()` (this feature) | Generation window (days ahead) for **annual-class** RecurringEvents rules (`annually`, `thanksgiving-sat`). Blank/≤0 falls back to the Config default (366). |

Existing `recurringEventsLookaheadDays` (60) is unchanged and keeps governing every
non-annual cadence. Both stay hand-editable; neither is in `EDITABLE_SETTINGS` (not
exposed in the More → Settings screen — consistent with the existing lookahead key).

## RecurringEvents (existing tab — no schema change)

- `lastGenerated` semantics unchanged (high-water mark of generated occurrence dates).
  Note: for annual rules it may now legitimately sit up to ~a year in the future.
- Cadence classification is behavioral, not stored: annual-class = `annually` |
  `thanksgiving-sat`; everything else is short-window.

## Events (existing tab — no schema change)

- Yearly occurrence rows (`v` + hash ids) now exist up to 366 days ahead. Ids remain
  deterministic per (rule, date); hand-deletes/edits behave exactly as today.

## Tasks (existing tab — no schema change)

- **Client-supplied `id` on create**: the frontend now sends a `crypto.randomUUID()` id
  in `tasks.create` / `events.create` payloads. This exercises existing `createRecord_`
  behavior (accept + idempotent replay); no backend change. Constitution II (row position
  never an identifier, UUID ids) holds.
- Snoozed tasks: no data change — `dueDate` already holds the snoozed-until date; the
  dashboard week strip merely starts *reading* status `snoozed` alongside `open`.

## Frontend-only state (not persisted)

- `DashboardHome` gains `peekDateKey: string | null` (which day's inline panel is open).
  Per-render UI state only — deliberately not in localStorage.
