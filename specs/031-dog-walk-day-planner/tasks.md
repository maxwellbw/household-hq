---
description: "Task list for 031 — Dog-Walk Day Planner"
---

# Tasks: Dog-Walk Day Planner

**Input**: Design documents from `/specs/031-dog-walk-day-planner/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/dogwalks-planner-api.md](./contracts/dogwalks-planner-api.md)

**Tests**: Backend self-test tasks are included — `backend/SelfTest.js` assertions are this
project's definition of done for backend work (CLAUDE.md), and `quickstart.md` names the
specific assertions each phase must add. Frontend tests follow the existing Vitest pattern
alongside each component.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 — maps to the spec's user stories

---

## Phase 1: Setup (Shared Configuration)

**Purpose**: Constants every later phase reads. No behavior change on its own.

- [X] T001 Add forecast-cache and backoff constants to `backend/Config.js`: `DOG_WALK_FORECAST_CACHE_KEY = 'hq.dogwalk.forecastCache'`, `DOG_WALK_CACHE_MAX_AGE_MIN = 1440` (24h, FR-006), `DOG_WALK_CACHE_MAX_BYTES` safety ceiling (~8000, under the ~9KB property limit), and `DOG_WALK_CACHE_VERSION = 'v1'`.
- [X] T002 Replace the flat `DOG_WALK_FETCH_RETRY_SLEEP_MS_` in `backend/DogWalk.js:293` with two schedules in `backend/Config.js`: `DOG_WALK_BACKOFF_RATELIMIT_MS = [45000, 150000]` and `DOG_WALK_BACKOFF_TRANSIENT_MS = [2000, 8000]` (research R4). Keep `DOG_WALK_FETCH_MAX_ATTEMPTS_ = 3`.
- [X] T003 In `backend/Config.js`, change `DOG_WALK_TRIGGER_HOUR` from `1` to `3` and add `DOG_WALK_WARM_HOUR = 21`, each with a comment pointing at research R1/R3 so the reason for the odd hours survives.

---

## Phase 2: Foundational (Test Seams)

**Purpose**: Make the new storage and clock testable before writing logic against them.
Mirrors the existing `dogWalkFetch_` seam (`backend/DogWalk.js:298`).

**⚠️ Blocking**: US1's self-tests cannot be written without these.

- [X] T004 Add a `dogWalkProps_` seam in `backend/DogWalk.js` returning `PropertiesService.getScriptProperties()`, so self-tests can swap in an in-memory store without touching real script properties. Follow the `dogWalkFetch_` comment convention ("Never reassigned outside tests").
- [X] T005 Add a `dogWalkNow_` seam in `backend/DogWalk.js` returning `new Date()`, so cache-age and freshness assertions can be tested deterministically instead of with real elapsed time.

**Checkpoint**: Storage and clock are injectable — US1 can begin.

---

## Phase 3: User Story 1 — Nightly run survives a rate-limited forecast (Priority: P1) 🎯 MVP

**Goal**: A rate-limited Open-Meteo fetch no longer zeroes out a night's booking. Backend
only — no UI, independently shippable.

**Independent test**: Force the fetch seam to return HTTP 429 with a populated cache and
confirm days are still evaluated; repeat with an empty cache and confirm a distinguishable
deferral. Entirely within `clasp run selfTest`.

### Cache layer

- [X] T006 [US1] Implement `writeForecastCache_(map, settings)` in `backend/DogWalk.js`: encode per data-model §2 (`v1|fetchedAt|lat|lon` header, then `YYYY-MM-DDTHH,temp,precipProb,code` rows), trimmed to `settings.reliableDays` days and the walk-eligible hour band (`earliestStart` → `latestStart` + longest duration).
- [X] T007 [US1] In `writeForecastCache_`, enforce `DOG_WALK_CACHE_MAX_BYTES`: if the encoded value exceeds it, drop the furthest-out days first and `Logger.log` that it shed days. Near-term days are the ones that matter.
- [X] T008 [US1] Implement `readForecastCache_()` in `backend/DogWalk.js`: decode into the same `{"YYYY-MM-DDTHH": {temp, precipProb, code}}` shape `fetchForecast_` builds, returning `{map, fetchedAt, ageMinutes, usableForBooking}` or `null`. Reject a version mismatch or malformed payload by returning `null` rather than throwing — a corrupt cache must degrade to "no cache", never break a run.
- [X] T009 [US1] In `readForecastCache_`, discard the cache outright when its stored `lat`/`lon` differ from current Settings (data-model §2 validity rule 2), and set `usableForBooking: false` when `ageMinutes > DOG_WALK_CACHE_MAX_AGE_MIN` (FR-006).

### Fetch resilience

- [X] T010 [US1] Rework the retry loop in `fetchForecast_` (`backend/DogWalk.js:311`) to classify each failure as rate-limit (HTTP 429) or transient, and sleep from the matching schedule (T002) rather than a flat 500ms (FR-003, FR-004, FR-006b).
- [X] T011 [US1] In `fetchForecast_`, log the truncated response body on any non-200 — Open-Meteo returns a human-readable `reason` on 429, which is the evidence research R1 needs on the next occurrence.
- [X] T012 [US1] Call `writeForecastCache_` from `fetchForecast_` on every successful fetch, so all three writers (finder, warm trigger, planner) populate the cache through one path (FR-006a).
- [X] T013 [US1] Implement `getForecastWithFallback_(settings)` in `backend/DogWalk.js`: try `fetchForecast_`, fall back to `readForecastCache_`, and return `{map, source: 'live'|'cache'|'none', fetchedAt, ageMinutes, usableForBooking}`. This is the single entry point both `runDogWalkFinder` and `dogwalks.day` use, so their provenance semantics cannot diverge.

### Run loop + triggers

- [X] T014 [US1] Rewrite `runDogWalkFinder`'s forecast step (`backend/DogWalk.js:713`) to use `getForecastWithFallback_`, defer all days only when `source === 'none'` or `usableForBooking` is false, and log exactly one of the three provenance lines from quickstart §1.2 (FR-005).
- [X] T015 [US1] Add `warmForecastCache()` to `backend/DogWalk.js` — **no trailing underscore** (CLAUDE.md trigger gotcha; feature 004's silent failure). Fetches and caches only: no ledger read, no booking. Add it to the file's header function index.
- [X] T016 [US1] Extend `installDogWalkTrigger()` (`backend/DogWalk.js:745`) to install both triggers — the finder at `DOG_WALK_TRIGGER_HOUR` (now 3) and `warmForecastCache` at `DOG_WALK_WARM_HOUR` (21) — deleting existing triggers for **both** handlers first so it stays idempotent.

### Self-tests

- [X] T017 [P] [US1] In `backend/SelfTest.js`, assert `writeForecastCache_` → `readForecastCache_` round-trips a forecast map exactly, and that a full 14-day horizon encodes under `DOG_WALK_CACHE_MAX_BYTES`.
- [X] T018 [P] [US1] In `backend/SelfTest.js`, assert cache rejection paths: mismatched coordinates discard, age beyond 24h sets `usableForBooking: false`, and a corrupt/version-mismatched payload returns `null` without throwing.
- [X] T019 [P] [US1] In `backend/SelfTest.js`, assert the backoff: a 429 uses the rate-limit schedule and a generic failure the transient one, with the gaps increasing between attempts. Use the `dogWalkFetch_` seam and record sleep durations rather than actually sleeping.
- [X] T020 [US1] In `backend/SelfTest.js`, assert `getForecastWithFallback_` returns `source: 'cache'` when the live fetch fails with a warm cache and `source: 'none'` when both fail — **and exercise `warmForecastCache()` as a public entry point**, not just its inner helper (the feature-004 trap named in plan.md).

**Checkpoint**: US1 is shippable. `clasp push && clasp deploy`, run `installDogWalkTrigger`, validate per quickstart §1.

---

## Phase 4: User Story 2 — See why a day got the slot it did (Priority: P2)

**Goal**: A read-only planner panel showing busy blocks, per-hour gate results, and
candidate windows. No writes.

**Independent test**: Open the planner for a day with known calendar and forecast data;
its busy blocks, gate results, and chosen window must match what the nightly run decided.

**Depends on**: US1 (`getForecastWithFallback_` supplies the forecast and its provenance).

### Backend — per-hour gate detail

- [X] T021 [US2] Extract a `gateHour_(forecast, hourKey, settings)` helper in `backend/DogWalk.js` returning `{passes, failedGates: []}` with gate names `heat`/`cold`/`precip`/`snowIce`/`noForecast`, then **refactor `weatherGate_` (`backend/DogWalk.js:364`) to call it**. One implementation of the gate rules, not two — this is what makes FR-015 structural rather than a promise.
- [X] T022 [US2] Verify via existing self-tests that the `weatherGate_` refactor is behavior-preserving before building anything on top of it; the nightly run's decisions must not shift.

### Backend — day plan assembly

- [X] T023 [US2] Implement `buildDayPlan_(ymd, settings)` in `backend/DogWalk.js`, composing `fetchAllSourceEvents_`, `computeAvailability_`, `gateHour_`, and `selectWindow_` into the `dogwalks.day` response from contracts §1. It must implement **no** gate or selection logic of its own.
- [X] T024 [US2] In `buildDayPlan_`, populate `busyBlocks` with `owner` (`max`/`jaz`/`both`) and `title` (null when unavailable), so the frontend can color by identity (PRODUCT.md).
- [X] T025 [US2] In `buildDayPlan_`, set `calendarsReadable: false` when any source calendar read throws, so the planner can refuse to render a day as free (FR-014) — mirroring the existing `avail === null` fail-safe in `resolveSlot_`.
- [X] T026 [US2] In `buildDayPlan_`, populate the `forecast` block (`source`, `fetchedAt`, `ageMinutes`, `usableForBooking`, `reliable`) from `getForecastWithFallback_`, with `reliable: false` beyond `settings.reliableDays` (FR-013).
- [X] T027 [US2] Return **all** eligible candidate windows from `buildDayPlan_`, not just the winner, with `chosen` marking `selectWindow_`'s pick (FR-011).
- [X] T028 [US2] Register `'dogwalks.day'` in `backend/Api.js` HANDLERS per contracts, rejecting a date outside `[today, today + outerDays]` with `BAD_REQUEST`.

### Frontend

- [X] T029 [P] [US2] Add day-plan types (`DogWalkDayPlan`, `BusyBlock`, `HourGate`, `CandidateWindow`, `ForecastProvenance`) to `frontend/src/types/domain.ts`, matching the contract exactly.
- [X] T030 [US2] Add a `fetchDogWalkDay(date)` call to `frontend/src/hooks/useDogWalks.ts`, loaded on demand when the planner opens — **not** added to `data.bootstrap` (research R7 keeps feature 030's cold-load work intact).
- [X] T031 [US2] Create `frontend/src/components/dashboard/DogWalkPlanner.tsx`: a vertical day timeline with busy blocks as filled bands (owner-colored), a per-hour weather strip, and candidate windows as distinct regions with the chosen one marked.
- [X] T032 [US2] In `DogWalkPlanner.tsx`, surface forecast provenance: label cached weather with its age, mark a day beyond the reliable horizon, and render the unreadable-calendar state as an explicit warning rather than an empty day (FR-012, FR-013, FR-014).
- [X] T033 [US2] Wire the planner open action into `frontend/src/components/dashboard/DayPeekPanel.tsx` from the existing walk entry — no new top-level navigation.
- [X] T034 [P] [US2] Add `frontend/src/components/dashboard/DogWalkPlanner.test.tsx` covering: gate-failure reasons render per hour, chosen candidate is distinguished, cached-forecast age appears, unreadable-calendar state renders.
- [X] T035 [US2] Run `/impeccable critique` on the planner and address findings (DESIGN.md; WCAG 2.1 AA — gate pass/fail must not be conveyed by color alone).

**Checkpoint**: US2 is shippable read-only. Validate per quickstart §2.

---

## Phase 5: User Story 3 — Book or unbook a walk myself (Priority: P3)

**Goal**: Book into any window (with named-failure override), unbook, and release — all
respected by the nightly run.

**Independent test**: Book a walk into a non-chosen window, confirm invites and ledger row
match an automatic booking, then run the finder and confirm the choice survives.

**Depends on**: US2 (the planner is where these actions live).

### Backend — schema and freeze

- [X] T036 [US3] Add `decidedBy` as the final column of `HEADERS.DogWalks` in `backend/Config.js` (data-model §1). `migrateHeaders_` handles the additive migration — no bespoke migration code.
- [X] T037 [US3] Extend `isFrozen_` (`backend/DogWalk.js:614`) to freeze any row with a non-blank `decidedBy`, regardless of window time (research R5, FR-021). Normalize unexpected values to blank rather than trusting the cell (Principle II — tolerate hand-edits).
- [X] T038 [US3] Add `decidedBy` to the row mapping in `listUpcomingDogWalks_` (`backend/DogWalk.js:808`) so existing consumers see it.

### Backend — write actions

- [X] T039 [US3] Implement `bookWalkManually_(payload, actor, settings)` in `backend/DogWalk.js`: validate date/slot/window/duration, then delegate to the existing `bookOrReconcileWalk_` — the same path `resolveSlot_` uses, inheriting its idempotency and `withLock_` (FR-018, FR-019, FR-024).
- [X] T040 [US3] In `bookWalkManually_`, detect override conditions (failed gates via `gateHour_`, busy overlap via `computeAvailability_`) and return `OVERRIDE_REQUIRED` with named `failedGates` and `conflicts` unless `confirmOverride === true` (FR-021a, Q1 = Option A).
- [X] T041 [US3] In `bookWalkManually_`, reject a window that has already started (FR-023), a duration outside the configured set, and a window not falling on `date` in household tz.
- [X] T042 [US3] Set `decidedBy` to the resolved actor on every manual booking, and append a `dogwalk.book` ActivityLog row with actor and walk id (FR-020, Principle VI).
- [X] T043 [US3] Implement `unbookWalkManually_(payload, actor)` in `backend/DogWalk.js`: delete the calendar invites, set `status: 'skipped'` with `decidedBy`, append `dogwalk.unbook` to ActivityLog. Idempotent — unbooking an already-skipped day is a no-op.
- [X] T044 [US3] Implement `releaseWalkDecision_(payload, actor)` in `backend/DogWalk.js`: clear `decidedBy` only, leaving status intact, and append `dogwalk.release` (FR-022).
- [X] T045 [US3] Register `'dogwalks.book'`, `'dogwalks.unbook'`, and `'dogwalks.release'` in `backend/Api.js` HANDLERS per contracts.

### Frontend

- [X] T046 [US3] Add `bookWalk`, `unbookWalk`, and `releaseWalk` to `frontend/src/hooks/useDogWalks.ts`, handling the `OVERRIDE_REQUIRED` response as a confirmation step rather than an error.
- [X] T047 [US3] Add booking affordances to `DogWalkPlanner.tsx`: select a free window and book, unbook an existing walk, and release a user-decided day back to automatic handling.
- [X] T048 [US3] Implement the override confirmation in `DogWalkPlanner.tsx` — name the specific failed gate or conflicting block, then let the user proceed. The gates inform; they do not forbid (FR-021a).
- [X] T049 [US3] Show `decidedBy` state in the planner and in `DayPeekPanel.tsx` — a user-decided day must be visibly distinct from an automatically booked one, with the release action discoverable from it.
- [X] T050 [P] [US3] Extend `DogWalkPlanner.test.tsx` for: override confirmation flow, unbook, release, and user-decided badge rendering.

### Self-tests

- [X] T051 [P] [US3] In `backend/SelfTest.js`, assert `isFrozen_` returns true for a non-blank `decidedBy` row with a future window, and that `processDogWalkDay_` leaves such a row untouched (FR-021, SC-004).
- [X] T052 [P] [US3] In `backend/SelfTest.js`, assert booking twice for the same (date, slot) yields one row and reuses the stored gcal event ids (FR-019, SC-005).
- [X] T053 [US3] In `backend/SelfTest.js`, assert the validation guards: started-window rejection, bad duration rejection, and `OVERRIDE_REQUIRED` raised then satisfied by `confirmOverride`.

**Checkpoint**: US3 shippable. Validate per quickstart §3.

---

## Phase 6: Polish & Cross-Cutting

- [X] T054 Update the function index in `backend/DogWalk.js`'s header comment with every new function (cache helpers, `getForecastWithFallback_`, `warmForecastCache`, `gateHour_`, `buildDayPlan_`, the three manual-action helpers).
- [X] T055 Update `backend/README.md` with the new triggers (finder moved to hour 3, warm cache at hour 21), the forecast-cache script property, and how to clear it when debugging.
- [X] T056 [P] Run `/impeccable polish` on the planner UI before the PR (CLAUDE.md definition of done).
- [X] T057 [P] Confirm `cd frontend && npm run build` passes with no type errors.
- [ ] T058 Record the outcome of the first real post-change nightly trigger run against research R1 in `specs/031-dog-walk-day-planner/research.md` — whether hour 3 saw a 429, and any Open-Meteo `reason` body captured by T011. This closes the investigation the user asked for.
- [X] T059 Update `BACKLOG.md` — stage and PR link for 031.

---

## Dependencies

```
Phase 1 (Setup) ──▶ Phase 2 (Seams) ──▶ Phase 3 (US1) ──▶ Phase 4 (US2) ──▶ Phase 5 (US3) ──▶ Phase 6
                                            │                  │
                                       shippable           shippable
                                        alone               alone
```

- **US1 depends on** Phases 1–2 only. It is the MVP and ships without any frontend work.
- **US2 depends on US1** for `getForecastWithFallback_` (provenance) — the planner needs to
  say whether weather is live or cached.
- **US3 depends on US2** for the surface the actions live on, and on `gateHour_` (T021) for
  override detection.
- T021's refactor of `weatherGate_` is the one change touching existing decision logic;
  T022 gates it behind a behavior-preserving check before anything builds on it.

## Parallel opportunities

- **Phase 3**: T017, T018, T019 are independent self-tests in different areas of
  `SelfTest.js` — write together, then T020 last (it depends on T013 and T015).
- **Phase 4**: T029 (types) runs parallel to backend T023–T027. T034 (component test)
  parallels T035 (audit).
- **Phase 5**: T051, T052 parallel to each other; T050 parallel to the backend self-tests.
- **Phase 6**: T056 and T057 in parallel.
- Backend and frontend tasks within US2 and US3 can proceed in parallel once the contract
  is fixed — it already is, in `contracts/dogwalks-planner-api.md`.

## Implementation strategy

**Ship US1 first, on its own.** It is the live bug, it is backend-only, and it is validated
entirely by `clasp run selfTest` plus one real trigger night. Do not wait for the planner UI
to fix the thing that stopped booking walks.

US2 then delivers the read-only value, and US3 adds writes last — keeping the riskiest
change (touching the booking path that creates real calendar invites) isolated behind two
already-validated phases.

**MVP scope: Phases 1–3 (T001–T020).**

## Format validation

All 59 tasks carry a checkbox, sequential ID, `[P]` where parallelizable, `[US#]` on every
user-story task (and on none of the Setup/Foundational/Polish tasks), and an explicit file
path.
