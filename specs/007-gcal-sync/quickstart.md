# Quickstart: Google Calendar Sync (gcal-sync)

Live validation that the app's Events and dated Tasks mirror to the shared **Household**
Google Calendar and fire notifications on both phones. Backend-only feature; validate via the
Apps Script editor (`runSelfTest`) plus a real end-to-end pass on the calendar and phones.

## Prerequisites

- 001–006 deployed; the web app runs as the **shared household account**
  (`household@example.com`), which **owns** the Household calendar.
- The shared account's **Household** calendar exists and both Max's and Jaz's phones
  **subscribe** to it (Google Calendar app → that calendar visible + syncing).
- You know the Household calendar's **Calendar ID** (Google Calendar → that calendar →
  Settings → *Integrate calendar* → *Calendar ID*, e.g. `...@group.calendar.google.com`).

## One-time setup (deploying shared account)

1. **Push + deploy** the backend:
   ```bash
   cd backend
   clasp push
   clasp deploy -i <existing deploymentId>   # refresh the web-app URL (or `clasp deploy` for a new one)
   ```
2. **Authorize the new scope.** The manifest now lists
   `https://www.googleapis.com/auth/calendar`. Open the editor (`clasp open-script`) and run
   **`checkCalendarAuth()`** once — it calls `CalendarApp` directly, so Apps Script prompts for
   the new scope immediately. (Running `selfTest()` alone will **not** trigger this prompt: with
   `householdCalendarId` still blank, every calendar code path no-ops before ever touching the
   Calendar service — FR-014 — so nothing forces the consent screen until you call
   `checkCalendarAuth()` or set the calendar id.) Complete the OAuth consent — **only the shared
   deploying account** re-authorizes (not Max's/Jaz's personal accounts). Expect the log to read
   `calendar OK — N owned calendar(s) visible to this account.`
3. **Migrate the Sheet + seed Settings.** Run **`setupDatabase()`** once from the editor. This
   appends the `gcalEventId` column to the **Tasks** tab and seeds `gcalEventReminderMin` (30)
   and `gcalTaskReminderTime` (09:00). Idempotent — safe to re-run.
4. **Set the calendar id.** In the Sheet's **Settings** tab, set `householdCalendarId` to the
   Household Calendar ID from Prerequisites. (Leave blank to keep sync disabled.)
5. **Install the nightly trigger.** Run **`installCalendarTrigger()`** once from the editor
   (idempotent; installs the `syncCalendar` handler at hour 5).

## Fast check — self test

Run **`selfTest()`** in the editor. Expect all assertions to pass, ending with `ALL PASS`,
including the new `CalendarSync` blocks. With `householdCalendarId` **set**, the live calendar
blocks run and clean up after themselves; with it **blank**, those blocks are **skipped**
(logged as skipped) and the pure-builder blocks still run.

> **What the automated blocks do / don't cover.** `CalendarApp` caches events within a single
> execution, so an entry deleted earlier in the same run still resolves by id (a stale handle).
> The live self-test blocks therefore assert only what's reliable in one execution — creation,
> in-place update, and Sheet-side pointer bookkeeping. Entry **removal**, **stale-pointer
> recreation** (FR-015), **reconcile self-healing**, and the **orphan sweep** only manifest
> across executions (fresh cache), so they're validated by **Scenarios E & F** below (hand-edit
> in Google Calendar, then run `syncCalendar()` as a separate execution). Production is
> unaffected — it never deletes-then-refetches the same event within one execution.

## End-to-end scenarios (real calendar + both phones)

Do these with `householdCalendarId` set. After each, check the Household calendar (web) and,
for notification checks, both phones.

### Scenario A — Event mirrors (US1, FR-001/003/004)
1. In the app, create an event **owner: Jaz**, e.g. "Vet appointment" tomorrow 4:00–4:30pm.
2. **Expect** within seconds: one calendar entry "**[Jaz] Vet appointment**" tomorrow
   4:00–4:30pm, in **Grape** color; the Sheet's Events row now has a `gcalEventId`.
3. Edit it to 5:00pm in the app → the **same** entry moves (no duplicate).
4. Delete it in the app → the calendar entry disappears.

### Scenario B — Dated task mirrors (US2, FR-005/006)
1. Create a task **owner: Both** with a due date ~3 days out, e.g. "Renew dog license".
2. **Expect**: one **all-day** entry "**[Both] Renew dog license**" on that date, **Tangerine**
   color; Tasks row has a `gcalEventId`.
3. Create a task with **no** due date → **no** calendar entry appears.
4. Change the dated task's due date → the same all-day entry **moves** (no duplicate).
5. Complete the task → its entry is **removed**. Reopen → it **reappears**.

### Scenario C — Idempotency / no duplicates (FR-009, SC-002)
1. With entries from A/B present, run **`syncCalendar()`** manually in the editor.
2. **Expect**: no new/changed/deleted entries (a true no-op); still exactly one entry per
   record; no new `gcal-sync` rows in ActivityLog for unchanged records.

### Scenario D — Notifications fire on both phones (FR-007a, SC-001)
1. Create an event ~40 min out and a dated task due **today**.
2. **Expect**: each phone shows a popup ~30 min before the event, and a morning-of popup for
   the task around 09:00 (household tz).
3. **If the all-day task popup does not fire reliably** on a subscribed calendar: apply the
   documented fallback in [research.md](research.md) D5 — render dated-task mirrors as a short
   **timed** entry at `gcalTaskReminderTime` instead of all-day — then re-validate.

### Scenario E — Self-healing reconcile (US3, FR-010/015)
1. In Google Calendar (web), **delete** one app-created entry by hand, and **rename** another.
2. Run **`syncCalendar()`**.
3. **Expect**: the deleted entry is **re-created**; the renamed entry is **corrected** back to
   `[Owner] title` (the app is authoritative).

### Scenario F — Orphan sweep for hand-deleted rows (FR-010, edge case)
1. In the **Sheet**, delete an Event row that currently has a `gcalEventId` (simulating a hand
   edit the write path never saw).
2. Run **`syncCalendar()`**.
3. **Expect**: the corresponding calendar entry is **deleted** by the orphan sweep; a
   `gcal-sync` delete row appears in ActivityLog.

### Scenario G — Disabled + untouched-entries safety (FR-013/014)
1. Add a birthday **directly** in the Household calendar (not via the app).
2. Run **`syncCalendar()`** → that manual entry is **left untouched** (no `hhqId` tag).
3. Blank out `householdCalendarId` in Settings, create an app event, run `syncCalendar()` →
   **no** calendar writes occur (safe no-op); restore the id afterward.

## Verify logging (Principle VI, FR-012)

In the app's activity feed (or the ActivityLog tab), each mirror create/update/delete above
shows a `gcal-sync` / `system` row targeting the record id. Unchanged re-syncs add nothing.

## Rollback

- Blank `householdCalendarId` → sync stops (no-op) without code changes.
- Delete the `syncCalendar` trigger in the editor to stop the nightly reconcile.
- Hand-clearing a row's `gcalEventId` forces a fresh mirror on the next run (repair lever).
