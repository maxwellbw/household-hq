# Quickstart — Bug-fix batch 4 validation

Per-story validation. Frontend stories are verified live in the browser preview using the dev-session token (paste a token from `clasp run mintDevSessionToken` into `localStorage['hq.sessionToken']`, no Google OAuth). Backend (US6) is exercised via `clasp run` + the next nightly trigger's execution log.

## Prerequisites

```bash
cd frontend && npm install && npm test        # unit tests green (incl. new cases)
npm run build                                   # type-clean
# Backend (US6):
cd ../backend && clasp push && clasp run selfTestDogWalk   # DOG WALK: ALL PASS
```

Local preview: `cd frontend && npm run dev`, then set `localStorage['hq.sessionToken']` to a dev token and reload.

## US1 — Walks in the Day Peek + times (P1)

1. On the dashboard, tap a weekday in the 7-day strip that has a booked/suggested walk.
2. **Expect**: the Day Peek panel lists a 🐾 walk row showing the walk's `start–end` time window, alongside events/tasks.
3. Tap a day with a needs-decision walk → **expect** the walk row conveys its needs-decision state.
4. Tap a day with no walk → **expect** no walk row; panel behaves as before.
5. Confirm timed events still show their time; all-day items show no spurious time.

## US2 — Done strikethrough everywhere (P1)

1. Mark a task done.
2. **Expect** strikethrough + de-emphasis in: Tasks tab (`TaskRow`), Day Peek, its calendar chip (month grid + day/week list), and its detail sheet title.
3. An open or snoozed task → **expect** no strikethrough.
4. Toggle the task back to open → **expect** strikethrough removed.

## US3 — Dismissed notices stay dismissed on refetch (P2)

1. With a dog-walk needs-decision notice and an acknowledge notice showing, dismiss each (✕).
2. Trigger an in-session refetch: switch to another tab and back (window-focus refetch), or wait past `staleTime` (30s) and refocus — **without** changing the underlying item.
3. **Expect**: neither notice reappears.
4. Full-reload the app (no underlying change) → **expect**: still hidden.
5. Cause a genuinely new item (assign+acknowledge a new task; or a new needs-decision walk) → **expect**: a notice appears for the new item only.

## US4 — Scroll always restored after sheets/dialogs (P2)

On a phone-width viewport (`resize_window` mobile / real phone):

1. Open and close each sheet/dialog: QuickAdd, Task detail, Task edit, Event detail, Event edit, Snooze, Confirm-delete, Force-rank, Schedule-task.
2. After each close → **expect**: the page scrolls normally (no reload needed).
3. Open a dialog from within a sheet (e.g. Snooze/Confirm from Task detail), close both → **expect**: scroll restored (nested lock released).
4. Rapidly open/close a sheet several times → **expect**: scroll restored.
5. While any sheet is open → **expect**: the background does **not** scroll.

## US5 — Prep-template picker on event create/edit (P2)

1. Open QuickAdd → Event. **Expect** a prep-template picker listing the TaskTemplate event-types (+ "None").
2. Create an event with a template selected → open the event → **expect** its prep tasks are attached (matching the template's steps/offsets).
3. Edit an existing event and apply a template → **expect** its tasks attach; re-save with the same template → **expect** no duplicate prep tasks.
4. Switch an event's template to a different one → **expect** the not-yet-started prep swaps to the new set (existing `syncPrepForEvent_` behavior).

## US6 — Dog-walk finder runs dependably on the trigger (P3)

1. `clasp push && clasp run selfTestDogWalk` → **expect** `DOG WALK: ALL PASS`, including the new retry case (forecast fails first attempt, succeeds on retry, run still books).
2. `clasp run runDogWalkFinder` (manual) → **expect** eligible weekdays get walk rows.
3. Watch the next nightly trigger's execution log (Apps Script editor → Executions): **expect** it books/suggests walks, or logs a **specific** reason (coordinates unset / non-200 code / exception) — not the old ambiguous "fetch failed or coordinates unset" catch-all.
4. Re-run after a deferred day → **expect** the day fills with no duplicate (idempotency preserved). Installer run twice → exactly one `runDogWalkFinder` trigger.

## US7 — Calendar doesn't flash on refetch (P3)

1. Open the calendar (month view). Switch to another browser tab and back to trigger a window-focus refetch with unchanged data.
2. **Expect**: the calendar does **not** visibly flash / fully re-render; chips stay put. (Reproduce the original flash first on `main` to confirm the fix.)
3. Make a real change elsewhere (create/edit an event) → **expect**: only the affected chip updates; navigation/interactions unchanged.

## Definition of done (batch)

- `npm test` green; `npm run build` type-clean; `selfTestDogWalk` → ALL PASS.
- New/changed UI passes `/impeccable audit` before the PR.
- Live validation of each story above recorded in the PR / BACKLOG note.
- Backend pushed and web-app deployment refreshed (`clasp deploy -i <deploymentId>`).
