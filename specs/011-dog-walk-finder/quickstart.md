# Quickstart / Validation: Weather-Aware Dog-Walk Window Finder (011)

End-to-end validation. Backend runs in Apps Script (the sandbox can't do real Google OAuth or `clasp run`), so the self-test and live steps are run manually from the Apps Script editor, as with 007–010.

## A. One-time setup (human — browser)

1. **Share work calendars → the household account** (`maxandjazmine@gmail.com`), **"See all event details"**:
   - Max: work calendar → share to the household account.
   - Jaz: work (Google) calendar → share to the household account. **If your employer blocks external detail-sharing**, instead grab the calendar's **private ICS URL** (Google Calendar → Settings for that calendar → "Secret address in iCal format") and put it in `jazWorkIcsUrl`. (Free/busy-only; the ignore-list won't apply to it.)
2. **Configure your work accounts to accept/auto-add invitations** (so booked walks land as accepted, not just pending). Household HQ only *sends* the invite.
3. In the **Settings** tab of the Sheet (hand-edit), fill:
   - `householdLat` / `householdLon` (your home coordinates).
   - `maxWorkCalId` / `jazWorkCalId` (the shared calendar ids), `maxWorkEmail` / `jazWorkEmail` (the guest emails to invite).
   - Confirm `householdCalendarId` is set (from 007).
   - Optionally tune `weatherHeatF` (80), `weatherColdFloorF` (20), `weatherPrecipPct` (50), the search window, band, and horizon — all have working defaults.
   - Leave `dogWalkAutoBook` = `TRUE` for auto-book, or set `FALSE` to start in suggest-only mode.

## B. Deploy backend

```bash
cd backend && clasp push && clasp deploy -i <existing deploymentId>   # refresh the web-app URL
```
No new OAuth scope is added (calendar + scriptapp already authorized from 007), so **no re-consent** is required.

## C. Migrate the Sheet + install the trigger (Apps Script editor)

1. Run **`setupDatabase()`** → creates the `DogWalks` tab and seeds the new Settings keys (existing hand-set values preserved; `weatherPrecipPct`/`weatherColdFloorF` new defaults apply only if not already set).
2. Run **`installDogWalkTrigger()`** → installs the daily finder trigger. Confirm it appears under Triggers.

## D. Self-test (Apps Script editor)

Run **`selfTestDogWalk()`**. Expect `DOG WALK: ALL PASS`. Covers (no real calendar writes):
- availability intersection across 3 sources; ignore-list titles counted as free.
- weather gate: heat / cold / precip% / snow-ice codes each exclude the right hours.
- window selection: longest-fits (60→45→30); band-preference + closest-to-midday tie-break.
- second-walk rule fires only when the primary starts before `dogWalkSecondTriggerBefore`.
- idempotency: re-running the plan for a day with an existing row makes no duplicate.
- never-cancel: a booked window turned bad with no alternative → `needs-decision`, not cancelled.

Also confirm the split-suite runners from 028 still pass: `selfTest1Core()` … `selfTest4CalendarAndComms()`.

## E. Live real run (Apps Script editor + phones)

1. Ensure both work calendars have some real busy blocks in the next 1–2 weeks and at least one clear-weather weekday.
2. Run **`runDogWalkFinder()`** once manually.
3. **Verify booking**:
   - Each work calendar received **its own single-guest invitation** (`Booked`) in a mutual-free, good-weather window, ideally 9 AM–12 PM, on each in-range weekday — and **neither invite lists the other person** as a guest.
   - The two invite events sit on the household account's **own** calendar, **not** the shared Household calendar (so the shared calendar shows no duplicate blocks).
   - The `DogWalks` tab has **one** `booked` row per day with both `maxGcalEventId` + `jazGcalEventId`, window, and duration.
   - `dogwalks.list` (from the app) returns **one** walk per day; it shows once on the app calendar + 7-day strip.
   - No app push was sent for the initial booking (the invite email is the notification).
4. **Verify move**: hand-edit a work-calendar event to overlap a booked walk (or drop the day's temperature/precip in a test by tightening `weatherHeatF`), re-run `runDogWalkFinder()` → the walk **moves** to another good window that day (**both** invite events move together, each guest intact); both phones get a "walk moved" push; the single `DogWalks` row is updated.
5. **Verify needs-decision**: make a day have no eligible window (fully book both calendars, or set weather gates so nothing qualifies), re-run → the day becomes `needs-decision` with the right `reason`, **no walk is cancelled**, both phones get one "needs a decision" push, and the dashboard notice lists that day. Re-run again → **no duplicate push** (guarded by `notifiedAt`).
6. **Verify suggest-only**: set `dogWalkAutoBook=FALSE`, clear a test day's row, re-run → `DogWalks` shows `suggested` with a window, **no invitation sent**; flip back to `TRUE`, re-run → the same window is now `booked` with invites.
7. **Verify weekend skip**: confirm no rows/events are created for Saturday/Sunday.

## F. Frontend

- `npm run build` clean, no type errors.
- Vitest suites for `useDogWalks`, `lib/dogwalks` selectors, and `DogWalkNotice` green.
- `/impeccable audit` on the dashboard notice + calendar walk styling before the PR (owner `both` color; WCAG AA).

## G. Rollback / off switch

- Set `dogWalkAutoBook=FALSE` to stop all booking while keeping suggestions.
- Delete the `runDogWalkFinder` trigger to stop the daily run entirely.
- Any `DogWalks` row or `Booked` calendar event can be hand-deleted; the engine treats a user-deleted walk as intentional and won't recreate it for that day.
