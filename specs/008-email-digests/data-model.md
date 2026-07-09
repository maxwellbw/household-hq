# Data Model: Email Digests (008)

This feature adds **no new tab** and **no new stored record type**. It reads existing tabs,
adds five Settings keys, and appends to ActivityLog (which also serves as the dedupe ledger).

---

## New Settings keys (Settings tab; key–value–notes)

Seeded by `seedSettings_` on the next `setupDatabase()` run; all are hand-editable. The
placeholder `digestSchedule` key is removed from the seed (see research D5).

| key | default value | notes |
|-----|---------------|-------|
| `digestWeeklyEnabled` | `TRUE` | feature 008; `FALSE` turns off the weekly "week ahead" email |
| `digestWeeklyDay` | `Sunday` | feature 008; weekday for the weekly digest — name (`Sunday`) or 0–6 (Sun=0) |
| `digestMonthlyEnabled` | `TRUE` | feature 008; `FALSE` turns off the monthly "next month" email |
| `digestMonthlyDay` | `last` | feature 008; day-of-month the monthly sends — `last` or 1–28 |
| `digestHour` | `7` | feature 008; hour (household tz) the daily gate fires; re-run installDigestTrigger() after changing |

**Validation / fallbacks** (all blank-or-invalid → default):
- `digest*Enabled`: truthy = `TRUE`/`true`/`1`/`yes` (case-insensitive); anything else = off.
  Blank → default `TRUE`.
- `digestWeeklyDay`: case-insensitive weekday name or integer 0–6. Invalid → `Sunday` (0).
- `digestMonthlyDay`: `last` (case-insensitive) or integer 1–28. Invalid/`29–31`/blank →
  `last`.
- `digestHour`: integer 0–23. Invalid/blank → `7`.

**Existing Settings read (unchanged):** `maxEmail`, `jazEmail` (recipients — feature 002),
`timezone` (window math — resolved via `getTimezone_()`).

---

## Digest (derived — not stored)

A per-recipient, per-period composed value produced at send time; never persisted.

`buildDigest_(person, kind, window, events, tasks)` → object:

| field | type | meaning |
|-------|------|---------|
| `person` | `'max' \| 'jaz'` | recipient identity |
| `kind` | `'weekly' \| 'monthly'` | digest type |
| `window` | `{ start: Date, end: Date }` | inclusive date window (household tz) |
| `items` | `Item[]` | selected + sorted events and tasks (see below) |
| `count` | int | `items.length` (0 → empty-state rendering) |
| `subject` | string | e.g. `Your week ahead — Jul 13–19` / `August at a glance` |
| `html` | string | `htmlBody` with inline owner-color styles |
| `text` | string | plain-text fallback body |

### Item (selection rules — research D7)

An `Item` is derived from an Events row or a Tasks row:

| field | source | notes |
|-------|--------|-------|
| `date` | Event `start` / Task `dueDate` | as calendar date in household tz; sort key |
| `time` | Event `start` time / `null` for tasks | tasks are date-only |
| `title` | `title` | |
| `owner` | `owner` | one of `max`/`jaz`/`both`; drives the color chip |
| `source` | `'event' \| 'task'` | for optional labeling/icon |

**Inclusion predicate** for recipient `p`, window `[start, end]` inclusive:

- **Event**: `owner ∈ {p, both}` AND `dateOf(start)` within `[start, end]`.
- **Task**: `owner ∈ {p, both}` AND `dueDate` non-blank AND within `[start, end]` AND
  `status ∈ {open, snoozed}` (excludes completed/deleted — FR-014).

Sorted ascending by `date` (then `time`), grouped by day in rendering (FR-006).

---

## Windows (household tz — research D7, FR-013)

| kind | window (inclusive) |
|------|--------------------|
| weekly | `[today, today + 6 days]` — 7 days beginning the send day |
| monthly | `[first day of next month, last day of next month]` |

All boundaries computed with `getTimezone_()` + `Utilities.formatDate`, never the server tz.

---

## ActivityLog usage (existing tab — send record **and** dedupe ledger)

Each successful send appends one row via `appendLog_(actor, action, targetId, detail)`:

| column | value |
|--------|-------|
| `timestamp` | send time (ISO, household tz) |
| `actor` | `system` (trigger-driven) |
| `action` | `digest-weekly` or `digest-monthly` |
| `targetId` | **period key** — `weekly/<yyyy-MM-dd>/<person>` or `monthly/<yyyy-MM>/<person>` |
| `detail` | human summary, e.g. `emailed the week ahead to jaz (3 items)` |

**Dedupe (`alreadySent_(action, targetId)`):** true iff an ActivityLog row already has that
`action` + `targetId`. The `targetId` is the deterministic per-period, per-person key, so a
re-run/double-fire finds the prior row and skips (FR-011, SC-004).

New `ACTION_VERBS` entries: `'digest-weekly': 'emailed the week ahead'`,
`'digest-monthly': 'emailed the month ahead'`.

---

## Config constants (Config.js)

| constant | value | purpose |
|----------|-------|---------|
| `DIGEST_TRIGGER_HOUR` | `6` | default daily-gate hour (offset from 3/4/5); overridden by `digestHour` at install |
| `OWNER_EMAIL_HUE` | `{ max:'#3E6E68', jaz:'#7E4A5E', both:'#C6613F' }` | DESIGN owner hues for inline HTML styling |
| digest schedule defaults | `Sunday` / `last` / `7` / `TRUE` | fallbacks when a Settings value is blank/invalid |

No changes to `HEADERS` (no new columns), `ID_TABS`, or any tab schema.
