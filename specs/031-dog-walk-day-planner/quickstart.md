# Quickstart: Dog-Walk Day Planner (031)

Live validation after `clasp push && clasp deploy`. Run the phases in order — each is
independently verifiable, so a phase can be validated and shipped before the next is built.

## Prerequisites

- `cd backend && clasp push && clasp deploy -i <deploymentId>` (refresh the existing web-app
  URL rather than minting a new one)
- Run `setupDatabase` once after Phase 1 — it applies the additive `decidedBy` column via
  `migrateHeaders_`. Idempotent; safe to re-run.
- Run `installDogWalkTrigger` once after Phase 1 — it now installs **two** triggers (finder
  at hour 3, `warmForecastCache` at hour 21) and removes the old hour-1 finder trigger.
- Frontend: `cd frontend && npm run build` must pass with no type errors.
- For browser checks without OAuth: `clasp run mintDevSessionToken`, paste into
  `localStorage['hq.sessionToken']`.

---

## Phase 1 — Forecast resilience (US1)

### 1.1 Self-test

```bash
cd backend && clasp push && clasp run selfTest
```

Expect the new assertions to pass:

- `fetchForecast_` retries a 429 on the escalating schedule (not the flat 500ms), and the
  gaps between attempts increase.
- A 429 backs off longer than a generic transient failure.
- `writeForecastCache_` → `readForecastCache_` round-trips the map exactly.
- The encoded cache stays under the size ceiling for a full 14-day horizon.
- A cache with mismatched `lat`/`lon` is rejected.
- A cache older than 24h reports `usableForBooking: false`.
- `getForecastWithFallback_` returns the cached map with `source: 'cache'` when the live
  fetch fails, and `source: 'none'` when both fail.
- **`warmForecastCache` is exercised as a public entry point**, not just its inner helper —
  guards the feature-004 trailing-underscore trap.

### 1.2 The actual bug

```bash
clasp run warmForecastCache     # populate the cache
clasp run runDogWalkFinder      # should now book days even if its own fetch is limited
```

Then in the execution log confirm exactly one of these lines appears, and that it is
accurate for what happened:

- `forecast: live fetch succeeded`
- `forecast: live fetch failed (<reason>) — serving cache fetched <N> minutes ago`
- `forecast: live fetch and cache both unavailable — deferring all days`

**The regression this feature exists to prevent**: the third line must only appear when the
cache is genuinely empty or stale. On 2026-07-18 the run deferred every day; after this
change, the same 429 with a warm cache must book days instead.

### 1.3 Trigger verification (the real test — takes a night)

After the hour-3 and hour-21 triggers have each fired once, check the execution log:

- Did the hour-21 `warmForecastCache` run succeed? (If yes, the cache is warm for hour 3.)
- Did the hour-3 finder run succeed on its live fetch, or fall back to cache?
- If a 429 recurred, the log now includes the **response body** — Open-Meteo returns a
  human-readable `reason`. Record it in research R1; it either confirms or refutes the
  shared-IP hypothesis.

Either outcome is a pass for this phase: booking succeeded. The trigger-hour move is also
the R1 experiment — if hour 3 never sees a 429 while hour 1 did, that is strong support for
the top-of-hour congestion hypothesis.

---

## Phase 2 — Planner view (US2)

### 2.1 API

Against the deployed web app, POST `dogwalks.day` for a date with a known booked walk:

```json
{ "action": "dogwalks.day", "token": "<token>", "payload": { "date": "<a weekday>" } }
```

Verify:

- `busyBlocks` matches what the source calendars actually contain for that day, with the
  ignore-list applied (a `Focus time` block should **not** appear as busy).
- `hours` covers the walk-eligible band, and each failing hour names its gate
  (`heat`/`cold`/`precip`/`snowIce`).
- `candidates` includes the booked window with `chosen: true`.
- `forecast.source` is `live` or `cache` with a plausible `ageMinutes`.
- Calling it twice in a row: the second call may report `source: 'cache'` — confirming the
  interactive warm path writes the cache (FR-006a).

Then request a `needs-decision` day and confirm every eligible hour is attributable to
either a busy block or a named failed gate (spec US2 scenario 2).

### 2.2 UI

Open the app, navigate to a day with a walk, open the planner from the day peek:

- Busy blocks render with owner colors (Max/Jaz/Both) — identity, not decoration.
- The weather strip shows per-hour pass/fail with the failing gate legible.
- The chosen window is visibly distinguished from other candidates.
- Cached weather is labelled with its age; a day past `reliableDays` is labelled unreliable.
- Kill a source calendar's access and confirm the planner says the calendar is unreadable
  rather than rendering a fully free day (FR-014).
- `npm run build` clean; `/impeccable audit` passes before the PR.

---

## Phase 3 — Booking from the app (US3)

### 3.1 Book an override

From the planner, pick a free window the finder did **not** choose and book it.

- Both calendar invites are created; the DogWalks row shows the new window with
  `decidedBy` set to the acting person.
- Compare the row and the invites against an automatically booked walk — they must be the
  same shape (FR-018).
- ActivityLog has a `dogwalk.book` row with the actor and walk id.

### 3.2 Gate override (Q1 = Option A)

Pick a window that fails a weather gate:

- The first attempt returns `OVERRIDE_REQUIRED` naming the specific failed gate.
- The UI shows that named reason and asks for confirmation.
- Confirming books it. Human judgment wins; the gate informed rather than forbade.

### 3.3 Idempotency

- Book the same (date, slot) twice → one walk, one pair of invites, no duplicates (FR-019).
- Double-tap the book button → same result.
- Book from the app, then `clasp run runDogWalkFinder` → **the manual window must survive
  unchanged** (FR-021). This is the core of SC-004.

### 3.4 Unbook and release

- Unbook a walk → invites removed, row `status: 'skipped'` with `decidedBy`.
- `clasp run runDogWalkFinder` → the day is **not** re-booked (FR-021).
- Release the day (or clear `decidedBy` by hand in the Sheet — both must work, Principle II)
  → next run books it automatically again (FR-022).

### 3.5 Guards

- Booking a window that already started → rejected (FR-023).
- Booking a duration outside the configured set → rejected.
- Two concurrent bookings for the same (date, slot) → one wins, the other is told the state
  changed; never two walks (FR-024).

---

## Done when

- [ ] `clasp run selfTest` passes, including every new assertion above
- [ ] A rate-limited finder run books days from cache instead of deferring all of them
- [ ] The nightly trigger has completed a real run post-change, with its outcome recorded
      against research R1
- [ ] The planner's displayed reasoning matches the run's decision for the same day (SC-006)
- [ ] A user-booked walk survives a subsequent automatic run (SC-004)
- [ ] No duplicate walks or invites under any repeat/concurrent action (SC-005)
- [ ] `npm run build` clean, `/impeccable audit` passed on the planner UI
- [ ] `BACKLOG.md` updated with stage and PR link
