# Quickstart — Feature 019: Task & Event Details + Collaboration

Live validation of the four slices. Prerequisites: 007 (calendar sync) configured with a
`householdCalendarId`, and 009 (ntfy) topics set for at least one person, to exercise the
sync and ping paths. Run the frontend from `frontend/` (`npm run dev`) or the deployed PWA.

## Setup / migration (run once after deploy)

1. `cd backend && clasp push` (and `clasp deploy -i <deploymentId>` to refresh the web app).
2. In the Apps Script editor, run **`setupDatabase()`** once. Confirm the log says
   provisioning applied, then open the Sheet and verify:
   - **Tasks** tab now ends with `… gcalEventId, notes, ackBy, ackAt`.
   - **Events** tab now ends with `… prepGeneratedFor, location`.
   Existing rows show blank cells in the new columns (no data disturbed).
3. Run **`selfTest()`** — all cases green, including the new acknowledge + location cases.

> If `setupDatabase()` is skipped, the app fails closed with `SCHEMA_MISMATCH` on the first
> request that maps the new headers — that is the expected guard, not a bug. Run it.

## Scenario A — Task notes with a tappable link

1. Quick-add a task "Replace air filter", owner Max, and enter a note containing a full URL
   (e.g. `Buy: https://www.amazon.com/dp/XXXX`).
2. Open the task's detail sheet → the note shows, and the URL is a tappable link; the
   leading "Buy: " is plain text. Tap it → opens in a new tab.
3. Edit the note (append `— 20x25x1`), save, reopen → updated text persists; the ActivityLog
   feed shows an "edited" entry for the task.

**Pass**: note round-trips through create + edit; only the `http(s)://` portion is a link;
non-URL text (and any bare `www.foo` without a scheme) is plain.

## Scenario B — Acknowledge round-trip (both channels)

1. As **Jaz**, create/assign a task to **Max** (owner = Max), dated today.
2. As Jaz, view Tasks + Home → the task reads **"not yet committed"** (badge), no "I've got
   it" button for Jaz.
3. As **Max**, view the same task → it reads "not yet committed" **and** shows **I've got
   it** (on the card and in the detail sheet).
4. As Max, tap **I've got it**. Confirm:
   - The badge clears for both users.
   - **Max's phone** does not ping; **Jaz's phone** receives an instant ntfy ping
     "Max has it: …".
   - On **Jaz's** Home dashboard a dismissible notice "Max has it: …" appears.
5. Reload Jaz's dashboard → the notice is still there (persists). Dismiss it → gone; reload
   → stays gone.

**Pass**: uncommitted state visible to both; commit clears it; assigner gets ping + notice;
notice persists until dismissed.

## Scenario C — Idempotent acknowledge

1. As Max, tap **I've got it** again on an already-acknowledged task (or replay the API
   call).
2. Confirm no duplicate ActivityLog `acknowledge` row and no second ntfy ping (`changed:
   false`).

**Pass**: acknowledgement is idempotent.

## Scenario D — Reassignment resets commitment

1. Take an acknowledged task (owner Max, Max committed).
2. As Jaz, edit the task and reassign owner → **Jaz** (or Max→Jaz via the detail sheet).
3. View as either user → it reads "not yet committed" again; `ackBy`/`ackAt` are cleared in
   the Sheet.
4. As the new assignee, **I've got it** appears and works, pinging the other person.

**Pass**: acknowledgement is per current assignee.

## Scenario E — No acknowledgement on `both` / self / done

1. A `both`-owned task shows **no** badge and **no** "I've got it".
2. A task you own yourself shows no badge to you (self-assigned).
3. Complete an uncommitted assigned task → the "not yet committed" badge disappears (a done
   task never reads uncommitted).

**Pass**: acknowledgement only applies to open/snoozed tasks assigned to the other person.

## Scenario F — Event notes editing

1. Quick-add an event "Dinner reservation" with a note containing a URL.
2. Open its detail sheet → note shows with the URL tappable (same rendering as task notes).
3. Edit the note via `EventEditSheet`, save, reopen → persists; feed shows an edit.

**Pass**: event notes are now capturable on create + edit and render links.

## Scenario G — Event location + calendar mapping

1. Create/edit an event with a `location` (e.g. a clinic address). Confirm it shows in the
   event detail sheet.
2. Wait for the mirror (immediate on write) and open the entry in Google Calendar → its
   **location** field carries the same value; tapping it offers directions in Maps.
3. Edit the event to clear the location, save → re-sync; the calendar entry's location is
   now empty.

**Pass**: location displays in-app and maps onto the synced calendar event, including the
cleared case.

## Scenario H — Hand-editable Sheet regression

1. In the raw Sheet, hand-type a `notes` value and a `location` value on existing rows, and
   set an `ackBy`/`ackAt` by hand on a task owned by that person.
2. Reload the app → notes/location display; the hand-set task reads as committed. Nothing
   breaks; tasks/events without the new fields behave exactly as before.

**Pass**: the Sheet stays the hand-editable source of truth (Principle II); no regression
for records lacking the new fields.

## Frontend checks

- `cd frontend && npm run build` — no type errors.
- `npm run test` — green, including new `linkify.test.ts`, `tasks.ts` predicate tests, and
  updated component tests.
- `/impeccable audit` on the new/changed UI (notes fields, badges, "I've got it", ack
  notice) before PR — WCAG 2.1 AA, 44px touch targets, owner color as identity.
