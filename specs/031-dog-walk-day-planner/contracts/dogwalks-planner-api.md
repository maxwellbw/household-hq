# Contracts: Dog-Walk Day Planner (031)

Extends the 011 surface (`contracts/dogwalks-api.md`) with one read action and three write
actions, plus the internal engine changes. Same project envelope as 001 (`okOut_` /
`errorOut_`, POST `{ action, token, payload }`, allowlist-gated).

`dogwalks.list` is unchanged, except that each row now also carries `decidedBy`.

---

## `dogwalks.day` (POST) — read the planner for one date

Read-only. Returns everything the planner renders, derived server-side from the engine's
own functions so it cannot drift from what the nightly run decides (FR-015).

**Request**
```json
{ "action": "dogwalks.day", "token": "<token>", "payload": { "date": "2026-07-20" } }
```

**Response (200)**
```json
{
  "ok": true,
  "data": {
    "date": "2026-07-20",
    "forecast": {
      "source": "cache",
      "fetchedAt": "2026-07-20T03:14:02-07:00",
      "ageMinutes": 512,
      "usableForBooking": true,
      "reliable": true
    },
    "calendarsReadable": true,
    "busyBlocks": [
      { "start": "2026-07-20T09:00:00-07:00", "end": "2026-07-20T10:30:00-07:00",
        "owner": "max", "title": "Sprint planning" },
      { "start": "2026-07-20T13:00:00-07:00", "end": "2026-07-20T13:30:00-07:00",
        "owner": "jaz", "title": null }
    ],
    "hours": [
      { "hour": "2026-07-20T08", "tempF": 66, "precipProbPct": 5, "wmoCode": 1,
        "passes": true,  "failedGates": [] },
      { "hour": "2026-07-20T13", "tempF": 88, "precipProbPct": 5, "wmoCode": 1,
        "passes": false, "failedGates": ["heat"] }
    ],
    "candidates": [
      { "start": "2026-07-20T10:30:00-07:00", "end": "2026-07-20T11:30:00-07:00",
        "durationMin": 60, "chosen": true,  "slot": "primary" },
      { "start": "2026-07-20T11:30:00-07:00", "end": "2026-07-20T12:00:00-07:00",
        "durationMin": 30, "chosen": false, "slot": "primary" }
    ],
    "walks": [
      { "id": "…uuid…", "slot": "primary", "status": "booked",
        "windowStart": "2026-07-20T10:30:00-07:00",
        "windowEnd": "2026-07-20T11:30:00-07:00",
        "durationMin": 60, "reason": null, "decidedBy": null }
    ],
    "primaryDurationsMin": [60, 45, 30],
    "secondDurationMin": 30
  }
}
```

**Semantics**

- `forecast.source` — `"live"`, `"cache"`, or `"none"`. On `"none"`, `hours` is empty and
  `busyBlocks` is still populated: the planner can show the day's shape even with no
  weather (FR-012).
- `forecast.usableForBooking` — false when the cache is older than 24h (FR-006). The
  planner still displays the hours, labelled stale.
- `forecast.reliable` — false when the date is beyond `reliableDays` (FR-013).
- `calendarsReadable` — false when any source calendar threw. `busyBlocks` is then **not**
  to be treated as complete, and the planner must say so rather than render a free day
  (FR-014).
- `busyBlocks.owner` — `max`, `jaz`, or `both` (Household calendar), for owner coloring.
  `title` is null when the event is private or the block came from a free/busy-only read.
- `hours` — one entry per hour in the walk-eligible band. `failedGates` values:
  `"heat"`, `"cold"`, `"precip"`, `"snowIce"` — named so the planner can say *which* gate
  failed (FR-010), plus `"noForecast"` for an hour missing from the forecast.
- `candidates` — every window `selectWindow_`/`secondWalkPlan_` considered eligible, with
  `chosen` marking the winner. Empty when nothing is eligible.
- Side effect: a successful live fetch here **writes the forecast cache** (FR-006a). This
  is the interactive warm path from research R3.
- Attempting a date outside `[today, today + outerDays]` → `BAD_REQUEST`.

---

## `dogwalks.book` (POST) — book a walk into a chosen window

**Request**
```json
{
  "action": "dogwalks.book", "token": "<token>",
  "payload": {
    "date": "2026-07-20", "slot": "primary",
    "windowStart": "2026-07-20T14:00:00-07:00",
    "windowEnd": "2026-07-20T14:30:00-07:00",
    "durationMin": 30,
    "confirmOverride": true
  }
}
```

**Response (200)** — the resulting walk row, same shape as `dogwalks.list` entries:
```json
{ "ok": true, "data": { "dogWalk": {
    "id": "…uuid…", "date": "2026-07-20", "slot": "primary", "status": "booked",
    "windowStart": "2026-07-20T14:00:00-07:00",
    "windowEnd": "2026-07-20T14:30:00-07:00",
    "durationMin": 30, "reason": null, "decidedBy": "max" } } }
```

**Response (409, override required)** — when the window fails a gate or overlaps a busy
block and `confirmOverride` was not `true`:
```json
{ "ok": false, "error": { "code": "OVERRIDE_REQUIRED", "message": "Window fails a check.",
    "details": { "failedGates": ["precip"],
                 "conflicts": [ { "owner": "max", "title": "1:1", 
                                  "start": "2026-07-20T14:00:00-07:00",
                                  "end": "2026-07-20T14:30:00-07:00" } ] } } }
```

**Semantics**

- Routes through the existing `bookOrReconcileWalk_` / `ensureInviteEvent_` path — the same
  one `resolveSlot_` uses — so invites and the ledger row are indistinguishable from an
  automatic booking (FR-018) and inherit its idempotency and `withLock_` wrapping
  (FR-019, FR-024).
- Sets `decidedBy` to the resolved actor, freezing the row against future automatic runs
  (FR-021).
- Re-booking the same (date, slot) **moves** the existing walk rather than creating a
  second one; the stored `gcalEventId`s are reused (FR-019).
- `OVERRIDE_REQUIRED` is a two-step affordance, not a refusal: the client shows the named
  failures and resubmits with `confirmOverride: true` (FR-021a, Q1 = Option A). Human
  judgment wins; the gates inform.
- Rejects a window that has already started (FR-023), a duration outside the configured
  set, or a window not on `date` in household tz → `BAD_REQUEST`.
- Appends to ActivityLog: action `dogwalk.book`, actor, target = walk id (FR-020).

---

## `dogwalks.unbook` (POST) — remove a booked walk

**Request**
```json
{ "action": "dogwalks.unbook", "token": "<token>",
  "payload": { "date": "2026-07-20", "slot": "primary" } }
```

**Response (200)**: `{ "ok": true, "data": { "dogWalk": { …, "status": "skipped", "decidedBy": "jaz" } } }`

**Semantics**

- Deletes the calendar invites for the walk and sets the row to `status = 'skipped'` with
  `decidedBy` — the day is not re-booked automatically (FR-017, FR-021).
- Idempotent: unbooking an already-skipped day is a no-op returning the same row.
- Appends to ActivityLog: `dogwalk.unbook`.

---

## `dogwalks.release` (POST) — hand a day back to the finder

**Request**
```json
{ "action": "dogwalks.release", "token": "<token>",
  "payload": { "date": "2026-07-20", "slot": "primary" } }
```

**Response (200)**: the row with `decidedBy: null`.

**Semantics**

- Clears `decidedBy` only. A `booked` walk stays booked but becomes movable again; a
  `skipped` row becomes eligible for automatic booking on the next run (FR-022).
- Equivalent to clearing the `decidedBy` cell by hand in the Sheet — the app affordance and
  the hand-edit are the same operation (Principle II).
- Appends to ActivityLog: `dogwalk.release`.

---

## Internal engine changes (backend/DogWalk.js)

Public entry points have **no trailing underscore** (CLAUDE.md trigger/editor gotcha).

| Function | Kind | Contract |
|---|---|---|
| `warmForecastCache()` | **new** trigger handler / editor-runnable | Fetches the forecast and writes the cache. Nothing else — no ledger reads, no booking. Installed at hour 21 as an independent draw against the 1am-band congestion (research R3). No args, no return. |
| `installDogWalkTrigger()` | changed | Now installs **two** triggers: the finder at `DOG_WALK_TRIGGER_HOUR` (moved 1 → 3) and `warmForecastCache` at `DOG_WALK_WARM_HOUR` (21). Still idempotent — deletes existing triggers for both handlers first. |
| `fetchForecast_(settings)` | changed | Gains failure classification (429 vs other), the escalating backoff schedule from research R4, non-200 body logging, and a cache write on success. Return shape unchanged. |
| `readForecastCache_()` | **new** helper | Decodes the script property → `{ map, fetchedAt, ageMinutes, usableForBooking }`, or `null`. Validates coordinates and freshness (data-model §2). |
| `writeForecastCache_(map, settings)` | **new** helper | Encodes and stores, trimming days/hours to stay under the size ceiling. |
| `getForecastWithFallback_(settings)` | **new** helper | The one entry point callers use: live fetch, else cache. Returns `{ map, source, fetchedAt, ageMinutes, usableForBooking }`. `runDogWalkFinder` and `dogwalks.day` both go through it so their provenance semantics are identical. |
| `isFrozen_(row)` | changed | Also freezes any row with a non-blank `decidedBy` (research R5). |
| `buildDayPlan_(ymd, settings)` | **new** helper | Assembles the `dogwalks.day` response by calling `computeAvailability_`, the per-hour gate checks, and `selectWindow_`. Composes existing engine functions — implements no gate or selection logic of its own, which is what keeps FR-015 true. |
| `bookWalkManually_(payload, actor, settings)` | **new** helper | Validates, checks for override conditions, then delegates to `bookOrReconcileWalk_`. |
| `listUpcomingDogWalks_()` | changed | Row mapping gains `decidedBy`. |

## Registration in `backend/Api.js`

```js
'dogwalks.list':    function () { return { dogWalks: listUpcomingDogWalks_() }; },   // unchanged
'dogwalks.day':     function (p) { return buildDayPlan_(p.date, readDogWalkSettings_()); },
'dogwalks.book':    function (p, actor) { return { dogWalk: bookWalkManually_(p, actor, readDogWalkSettings_()) }; },
'dogwalks.unbook':  function (p, actor) { return { dogWalk: unbookWalkManually_(p, actor) }; },
'dogwalks.release': function (p, actor) { return { dogWalk: releaseWalkDecision_(p, actor) }; },
```

`data.bootstrap` is **not** extended — the planner loads on demand (research R7), keeping
feature 030's cold-load work intact.

## Implementation deviations (written back per CLAUDE.md Definition of Done)

- **`readForecastCache_(settings)` takes `settings` explicitly**, not the no-arg signature
  shown above. Every sibling helper (`writeForecastCache_(map, settings)`,
  `getForecastWithFallback_(settings)`) already takes `settings` as a parameter; a no-arg
  `readForecastCache_()` would have to call `readDogWalkSettings_()` internally, making it
  silently depend on live Settings-sheet state and impossible to unit-test with a synthetic
  settings object (as `unitDogWalkFetchRetry_` already does for `fetchForecast_`). Behavior
  is unchanged — only the coordinate source moved from an internal read to the caller.
- **A fourth test seam, `dogWalkSleep_`**, wraps the `Utilities.sleep` call in
  `fetchForecast_`'s retry loop, alongside `dogWalkFetch_`/`dogWalkProps_`/`dogWalkNow_`.
  Without it, a self-test exercising the 429 backoff schedule (T019) would actually sleep
  ~3.5 real minutes per assertion. Swapped out in tests to record the schedule instead.
- **`dogwalks.day` gains `primaryDurationsMin`/`secondDurationMin`**, not shown in the
  response schema above. `enumerateCandidateWindows_` filters out any start that fails
  `weatherGate_` *before* a candidate is ever built, so `candidates` structurally never
  contains a gate-failing or busy window — meaning the client has no duration to book with
  for the exact case FR-021a exists for (naming a failed gate/conflict and letting the user
  override it). Exposing the configured durations lets the planner propose a booking at any
  displayed hour, not only at a pre-computed (necessarily gate-passing) candidate.
