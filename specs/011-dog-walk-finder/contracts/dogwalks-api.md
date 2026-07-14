# Contracts: Weather-Aware Dog-Walk Window Finder (011)

Two surfaces: one new JSON API action (frontend read) and the internal engine functions (trigger + testable helpers). The API follows the project envelope from 001 (`okOut_`/`errorOut_`, POST with `{ action, token, payload }`, auth-gated except `ping`).

## API action: `dogwalks.list` (POST)

Read-only. Returns upcoming dog-walk rows for the frontend calendar/dashboard.

**Request**
```json
{ "action": "dogwalks.list", "token": "<GIS session/ID token>", "payload": {} }
```

**Response (200, okOut_)**
```json
{
  "ok": true,
  "data": {
    "dogWalks": [
      {
        "id": "…uuid…",
        "date": "2026-07-14",
        "slot": "primary",
        "status": "booked",
        "windowStart": "2026-07-14T11:00:00-07:00",
        "windowEnd": "2026-07-14T12:00:00-07:00",
        "durationMin": 60,
        "reason": null
      },
      {
        "id": "…uuid…",
        "date": "2026-07-15",
        "slot": "primary",
        "status": "needs-decision",
        "windowStart": null,
        "windowEnd": null,
        "durationMin": null,
        "reason": "no-good-weather"
      }
    ]
  }
}
```

**Semantics**
- Returns rows with `date >= today` (household tz). Past days are omitted (they're frozen history).
- No write actions in this feature. Manual resolution of a `needs-decision` day reuses existing `events.create`.
- Auth: same allowlist gate as every non-`ping` action (002). Actor is not used (read-only).
- Registered in `Api.js` `HANDLERS` as `'dogwalks.list': function () { return { dogWalks: listUpcomingDogWalks_() }; }`.

## Internal engine (backend/DogWalk.js)

Public entry points have **no trailing underscore** (CLAUDE.md trigger/editor gotcha); helpers do.

| Function | Kind | Contract |
|----------|------|----------|
| `runDogWalkFinder()` | trigger handler / editor-runnable | Entry point. Reads Settings, source calendars (whole horizon), Open-Meteo (one fetch), and the DogWalks tab; plans each in-range weekday; books/moves/flags idempotently under `withLock_`; sends pushes on change; logs every mutation. Safe to re-run (idempotent). No args, no return. |
| `installDogWalkTrigger()` | editor-runnable | Deletes any existing `runDogWalkFinder` trigger, installs one daily time-driven trigger (early morning, household tz). Requires `script.scriptapp` (already granted). Mirrors `installCalendarTrigger()`. |
| `planDayWindows_(ymd, availability, forecast, settings)` | pure helper | Returns the planned action(s) for one day: `{ primary: {status, windowStart, windowEnd, durationMin, reason}, second?: {…} }`. No I/O — the core unit-tested brain. |
| `computeAvailability_(sourceEventsByCal, ymd, settings)` | pure helper | Intersects free time across work + household sources for `ymd` within [earliest,latest], subtracting ignore-list titles and own `hhqKind='dogwalk'` events. Returns free intervals. |
| `weatherGate_(hourly, windowStart, windowEnd, settings)` | pure helper | True iff every overlapped hour passes heat/cold/precip/snow-ice gates. |
| `selectWindow_(freeIntervals, hourly, durationsMin, settings)` | pure helper | Applies R9: longest-fitting duration, then band-preference + closest-to-midday. Returns the chosen window or null. |
| `secondWalkPlan_(primary, availability, forecast, settings)` | pure helper | If `primary.start < dogWalkSecondTriggerBefore`, find a 30-min window after `dogWalkSecondAfter`; else null. |
| `bookOrReconcileWalk_(row, plan, settings)` | writer | Creates/updates the **two single-guest** invite events (one per configured work email) on the household account's own calendar with tag + guest; stores both ids; upserts the DogWalks row; logs. Move = `setTime` on both stored ids. `LockService`-wrapped. |
| `parseIgnoreList_(str)` / `parseWmoSnowIce_()` | pure helper | Config parsing; snow/ice code set per research R5. |
| `listUpcomingDogWalks_()` | reader | Backs `dogwalks.list`; today-forward rows shaped to the response type. |
| `selfTestDogWalk()` | editor-runnable | Live self-test: seeds a temp scenario in memory / a scratch calendar range, asserts book → move → needs-decision → suggest-only paths, prints `DOG WALK: ALL PASS`. |

## Booking shape

- Each walk = **two single-guest events** (one inviting `maxWorkEmail`, one inviting `jazWorkEmail`) on the household account's own calendar, so neither guest sees the other. Both ids stored on the one DogWalks row; the app shows one walk. If only one work email is configured, only that one invite is created.

## Notifications (reuse Push.js)

- On **move**: `sendPushToPerson_` to both Max and Jaz — "Dog walk moved to <time> on <day> (weather)".
- On **needs-decision**: to both — "<day> needs a dog-walk decision (<reason>)". Sent once per row change (guarded by `notifiedAt`).
- On **first booking**: **no** app push (the Google Calendar invite already notifies) — per clarify Q4.

## Non-goals (contract boundaries)

- No write API for walks (no `dogwalks.create/update/delete`); the engine owns writes, the frontend only reads.
- No new OAuth scope; `calendar` + `script.scriptapp` already present.
- Weekends: `runDogWalkFinder` skips Sat/Sun entirely.
