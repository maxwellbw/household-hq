# Contract — Notification triggers (backend/Notify.js)

No new API actions. This contract covers the two time-driven trigger handlers and
their installer. All three are **public names (no trailing underscore)** — they must
appear in the editor Run dropdown and be valid trigger handlers (CLAUDE.md gotcha).

## `sendMorningOverduePush()`

- **Fires**: daily trigger at `morningOverduePushHour` (default 8), household tz.
- **Reads**: Settings, Tasks (whole-tab read), ActivityLog (dedupe lookup).
- **Overdue set**: `status === 'open'` && dueDate non-empty && `dueDate < today`
  (household tz) — mirrors `frontend/src/lib/dashboard.ts` `smartViews().overdue`.
- **Empty behavior**: zero overdue → return without sending or logging.
- **Dedupe**: under `LockService`, skip if ActivityLog already has
  `action='notify-overdue', targetId=<today>`; otherwise append that row and send.
  (Check-log-send order identical to `Digests.sendOne_`.)
- **Send**: `sendPushToPerson_` to BOTH `'max'` and `'jaz'` with:
  - title: `Household HQ`
  - body: `"<N> overdue: <t1>, <t2>, <t3> +<K> more"` — first 3 titles (existing
    `truncateTitle_`-style truncation per title), `+K more` omitted when N ≤ 3.
  - url: `?overdue=1`
  - tag: `overdue-<today>`
- **Never throws** past `sendPushToPerson_`'s own guarantee; a failed fan-out still
  counts as sent (the dedupe row exists) — same posture as digests.

## `sendEveningWalkPush()`

- **Fires**: daily trigger at `eveningWalkPushHour` (default 20), household tz.
- **Reads**: Settings, DogWalks (whole-tab), ActivityLog.
- **Subject**: tomorrow (`today + 1d`, household tz). Rows for tomorrow:
  - ≥1 `booked`/`suggested` row with windows → body `"Dog walk tomorrow ·
    8:00–8:45 AM"`; two walks → both windows joined (" and ").
  - any `needs-decision` row (and nothing booked) → body `"Tomorrow's walk needs a
    decision"`.
  - no rows at all → return without sending or logging (weekend skip).
- **Dedupe**: `action='notify-walk', targetId=<tomorrow>` — same locked pattern.
- **Send**: both people; url `?walk=<tomorrow>`; tag `walk-<tomorrow>`.

## `installNotifyTriggers()`

- Idempotent: deletes any existing triggers for both handlers, then creates one
  daily trigger each at the configured hours. Logged via `Logger.log`.
- Re-run automatically by `settings.update` when `morningOverduePushHour` or
  `eveningWalkPushHour` changes (extends the existing `digestHour` reinstall hook in
  `Api.js`).

## Existing contract change

`sendDogWalkPush_` (needs-decision/move pushes from the finder) switches its `url`
from the current task-style value to `?walk=<ymd>` so all walk pushes deep-link to
the planner (F-33). Message text unchanged.

## Self-test obligations (`selfTestNotify()` suites)

- Gate: no send & no log row when overdue set is empty / no walk rows tomorrow.
- Dedupe: second invocation same day sends nothing (seam-counted).
- Content: body truncation at 3 titles + "+K more"; both-windows join; needs-decision
  body; url params exact.
- Public-name check: both handlers exercised via their public entry points, not just
  inner helpers (feature 004 lesson).
- Sends stubbed via a seam (no real pushes from self-test), mirroring digest tests.
