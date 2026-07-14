---
description: "Task list for feature 011 — Weather-Aware Dog-Walk Window Finder"
---

# Tasks: Weather-Aware Dog-Walk Window Finder

**Input**: Design documents from `specs/011-dog-walk-finder/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dogwalks-api.md, quickstart.md

**Tests**: Included — this project's convention is backend `SelfTest.js` suites (pure helpers exercised directly) + frontend Vitest. Test tasks precede the implementation they cover within each story.

**Organization**: By user story (spec priorities). Backend is Apps Script in `backend/`; frontend is Vite/React in `frontend/`. All Sheet-writing helpers are idempotent and `withLock_`-wrapped; every mutation appends to ActivityLog (constitution V/VI).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files / independent, no dependency on an incomplete task)
- **[Story]**: US1–US5 for user-story phases; Setup/Foundational/Polish carry no story label

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, config, and file scaffolding every story builds on.

- [ ] T001 Create `backend/DogWalk.js` scaffold — file header comment (feature 011, owns the finder engine + daily trigger), section banners for Settings/parse helpers, availability, weather, selection, booking, run-loop, trigger, reader; no logic yet.
- [ ] T002 [P] In `backend/Config.js`: add `DogWalks` to `TABS`, add its column headers to `SHEET_HEADERS` (`id, date, slot, status, windowStart, windowEnd, durationMin, maxGcalEventId, jazGcalEventId, reason, notifiedAt, updatedAt` per data-model.md), add `DogWalks` to `ID_TABS`, and add the four ActivityLog verbs (`dogwalk-book`, `dogwalk-move`, `dogwalk-suggest`, `dogwalk-needs-decision`) to the human-readable action map.
- [ ] T003 [P] In `backend/Config.js` `SETTINGS_SEED`: reconcile 011 keys — change `weatherPrecipPct` default `40→50` and `weatherColdFloorF` `25→20`, remove `weatherMorningCutoff`, and add the new keys with defaults per data-model.md (`dogWalkAutoBook=TRUE`, `maxWorkCalId`, `jazWorkCalId`, `jazWorkIcsUrl`, `maxWorkEmail`, `jazWorkEmail`, `dogWalkIgnoreList=Focus time; Block; Busy; Hold`, `dogWalkTitle=Booked`, `dogWalkEarliestStart=08:00`, `dogWalkLatestStart=16:00`, `dogWalkDurationsMin=60,45,30`, `dogWalkMiddayBandStart=09:00`, `dogWalkMiddayBandEnd=12:00`, `dogWalkSecondTriggerBefore=09:00`, `dogWalkSecondAfter=13:00`, `dogWalkSecondDurationMin=30`, `dogWalkReliableDays=14`, `dogWalkOuterDays=21`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration + shared Settings/ledger helpers used by every story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [ ] T004 In `backend/Setup.js`: extend `setupDatabase()` to create the `DogWalks` tab (with headers from T002) if absent and ensure the new Settings from T003 are seeded — idempotent, preserves hand-set values, never overwrites existing cells.
- [ ] T005 [P] In `backend/DogWalk.js`: Settings + parse helpers — `readDogWalkSettings_()` (returns a typed config object from the Settings map), `parseIgnoreList_(str)` (`;`-split, trim, lowercase), `parseDurations_(str)`, `parseWmoSnowIce_()` (the code set 56,57,66,67,71,73,75,77,85,86 per research R5), and HH:MM + household-timezone date/interval helpers (build a Date at a given ymd+HH:MM in the Settings tz; DST-safe per research R11).
- [ ] T006 [P] In `backend/DogWalk.js`: `DogWalks` ledger read/upsert — `readDogWalkRows_()` (whole tab once → objects), `findRow_(rows, ymd, slot)`, and `upsertDogWalkRow_(fields)` writing by (date, slot) natural key under `withLock_`, stamping `updatedAt`; never relies on row position (UUID `id`).

**Checkpoint**: Schema live, config + ledger plumbing ready — user stories can begin.

---

## Phase 3: User Story 1 - Daily walk booked in a mutual-free window (Priority: P1) 🎯 MVP

**Goal**: Each in-range weekday, find the time both work calendars + the household calendar are simultaneously free and book the longest walk (60/45/30) closest to midday, as two single-guest invites plus one ledger row — idempotently, weekends skipped. (Weather filtering arrives in US2.)

**Independent Test**: With the three calendars sharing some busy blocks, run the finder for a weekday → exactly one `booked` ledger row and two single-guest invite events (neither guest on the other's) in a mutual-free window; re-run → no duplicate; a Saturday → nothing.

### Tests for User Story 1

- [ ] T007 [P] [US1] In `backend/SelfTest.js`: suite for `computeAvailability_` — intersects free time across 3 sources, subtracts ignore-list titles (case-insensitive), and treats a re-planned day's own ledger window as free.
- [ ] T008 [P] [US1] In `backend/SelfTest.js`: suite for `selectWindow_` — longest-fits duration (60→45→30) and band/closest-to-midday tie-break (research R9), over weather-agnostic free intervals.
- [ ] T009 [P] [US1] In `backend/SelfTest.js`: suite for idempotency + weekend skip — re-planning a day with an existing booked row makes no duplicate row/events; Sat/Sun produce nothing.

### Implementation for User Story 1

- [ ] T010 [US1] In `backend/DogWalk.js`: `computeAvailability_(sourceEventsByCal, ymd, settings, ownWindow)` — read each source's events for the day (from the whole-range fetch), mark busy unless ignore-listed, union back `ownWindow` (the day's existing ledger walk) as free, return free intervals within [`dogWalkEarliestStart`, `dogWalkLatestStart`] in the household tz.
- [ ] T011 [US1] In `backend/DogWalk.js`: `selectWindow_(freeIntervals, durationsMin, settings)` — pick the longest duration that fits any interval, then rank candidates by band-preference (`dogWalkMiddayBandStart`–`End`) then closeness to noon, then earliest; return `{windowStart, windowEnd, durationMin}` or null. (Weather param added in US2.)
- [ ] T012 [US1] In `backend/DogWalk.js` (extend `CalendarSync.tagEntry_` to accept a `person` tag, or add a local `tagWalkEvent_`): `bookOrReconcileWalk_(row, plan, settings)` — for each configured work email, create a single-guest event on `CalendarApp.getDefaultCalendar()` (`{guests: <email>, sendInvites:true}`), set title `dogWalkTitle`, tag `hhqKind='dogwalk'`/`hhqId`/`hhqPerson`; store `maxGcalEventId`/`jazGcalEventId`; upsert the ledger row `status='booked'`; append `dogwalk-book` to ActivityLog. `withLock_`-wrapped; reconciles (no duplicate) when ids already present.
- [ ] T013 [US1] In `backend/DogWalk.js`: `runDogWalkFinder()` (public, no trailing underscore) — read Settings + `DogWalks` rows once; fetch each source calendar's events for the whole reliable-horizon range once; loop weekdays today…`today+dogWalkReliableDays` (skip Sat/Sun); for a day with no existing booked row, compute availability + select a window and `bookOrReconcileWalk_`, else write a `needs-decision` row with `reason='no-mutual-free'` when no free window (push/surface deferred to US5). Fail-safe: if a work calendar is unreadable, write `needs-decision` `reason='calendar-unreadable'` for its in-range days (FR-022).
- [ ] T014 [US1] In `backend/DogWalk.js`: `installDogWalkTrigger()` (public) — delete any existing `runDogWalkFinder` trigger, install one daily time-driven trigger (early morning, household tz), mirroring `CalendarSync.installCalendarTrigger()`.

**Checkpoint**: Mutual-free walks book as two single-guest invites + one ledger row, idempotent, weekends skipped. MVP deployable.

---

## Phase 4: User Story 2 - Only book weather-appropriate windows (Priority: P2)

**Goal**: Filter candidate windows by the Open-Meteo forecast so no walk is booked in heat, cold, high precip, or snow/ice.

**Independent Test**: A day with a rainy morning + clear afternoon books only in the clear window; an all-too-hot / all-icy day books nothing and records `needs-decision` `reason='no-good-weather'`.

### Tests for User Story 2

- [ ] T015 [P] [US2] In `backend/SelfTest.js`: suite for `weatherGate_` — heat (>`weatherHeatF`), cold (<`weatherColdFloorF`), precip (≥`weatherPrecipPct`), and each snow/ice WMO code independently disqualify the right hours; a window passes only if every overlapped hour passes.
- [ ] T016 [P] [US2] In `backend/SelfTest.js`: suite proving selection picks only weather-good windows, and a free-but-all-weather-bad day yields `needs-decision` `reason='no-good-weather'`.

### Implementation for User Story 2

- [ ] T017 [US2] In `backend/DogWalk.js`: `fetchForecast_(settings)` — one `UrlFetchApp` GET to Open-Meteo (`hourly=temperature_2m,precipitation_probability,weathercode`, `temperature_unit=fahrenheit`, `timezone=<household tz>`, `forecast_days=16`); return an hour→metrics map keyed by household-tz hour. Tolerate fetch failure (return null → treat affected days as deferred).
- [ ] T018 [US2] In `backend/DogWalk.js`: `weatherGate_(forecast, windowStart, windowEnd, settings)` — true iff every overlapped hour passes all four gates (research R5).
- [ ] T019 [US2] In `backend/DogWalk.js`: thread weather through the pipeline — `selectWindow_` (from T011) filters candidate windows by `weatherGate_`; `runDogWalkFinder` fetches the forecast once and passes it in; when free intervals exist but none pass weather, write `needs-decision` `reason='no-good-weather'`; days without forecast coverage are deferred.

**Checkpoint**: Only good-weather windows are ever booked; bad-weather days recorded (surfacing in US5).

---

## Phase 5: User Story 3 - Rolling forecast horizon with revision, never cancel (Priority: P2)

**Goal**: Book firmly within the reliable window, defer beyond it, and re-evaluate existing future bookings each run — moving a walk when its window turns bad, never auto-cancelling, flagging `needs-decision` when nothing good remains.

**Independent Test**: A booked day whose forecast turns bad moves to another good window that day (both invite events move); with no alternative it stays put and is flagged `needs-decision` `reason='forecast-turned-bad'` (never cancelled); a still-good booking is untouched; a past-start walk is never modified; days beyond the reliable horizon are deferred.

### Tests for User Story 3

- [ ] T020 [P] [US3] In `backend/SelfTest.js`: suite for revision — booked window turned bad with an alternative → `move` (both stored ids `setTime`, ledger window rewritten, still `status='booked'`); still-good → no change.
- [ ] T021 [P] [US3] In `backend/SelfTest.js`: suite for never-cancel + horizon + freeze — bad window with no alternative → `needs-decision` `reason='forecast-turned-bad'`, walk left in place; past-start rows never touched; days between `dogWalkReliableDays` and `dogWalkOuterDays` are deferred (no row).

### Implementation for User Story 3

- [ ] T022 [US3] In `backend/DogWalk.js`: `moveWalk_(row, plan, settings)` — `getEventById` each stored id and `setTime(newStart, newEnd)` (keep guest + tag), rewrite the ledger window keeping `status='booked'`, append `dogwalk-move`. `withLock_`-wrapped.
- [ ] T023 [US3] In `backend/DogWalk.js`: re-evaluation branch in `runDogWalkFinder` — for each existing future (start not in the past) `booked` row: recompute the day's availability (own window unioned free) + weather; if still eligible, leave as-is; if the current window fails, `moveWalk_` when an eligible window exists else set `needs-decision` `reason='forecast-turned-bad'` (never cancel). Skip past-start rows entirely (FR-018).
- [ ] T024 [US3] In `backend/DogWalk.js`: horizon handling — only book/re-evaluate weekdays within `dogWalkReliableDays`; weekdays from there to `dogWalkOuterDays` are deferred (no booking, no flag) until they slide into range (research R6).

**Checkpoint**: Revision + never-cancel + rolling horizon behave per spec; no walk is ever silently dropped or cancelled.

---

## Phase 6: User Story 4 - Second short walk after an early morning walk (Priority: P3)

**Goal**: When the day's primary walk starts before 09:00, also book a 30-minute afternoon walk after 13:00 when free + weather-good; skip silently otherwise.

**Independent Test**: Force a pre-09:00 primary on a day with a good, free afternoon window → a second `slot='second'` 30-min walk is booked; no afternoon window → only the primary; primary ≥ 09:00 → no second; re-run → no duplicate.

### Tests for User Story 4

- [ ] T025 [P] [US4] In `backend/SelfTest.js`: suite for the second-walk rule — fires only when primary start < `dogWalkSecondTriggerBefore`; books a 30-min window after `dogWalkSecondAfter`; skips silently when none; idempotent (no duplicate `second` row).

### Implementation for User Story 4

- [ ] T026 [US4] In `backend/DogWalk.js`: `secondWalkPlan_(primaryPlan, freeIntervals, forecast, settings)` — if `primaryPlan.windowStart` is before `dogWalkSecondTriggerBefore`, select a `dogWalkSecondDurationMin` window starting at/after `dogWalkSecondAfter` (same selection + weather rules), else return null.
- [ ] T027 [US4] In `backend/DogWalk.js`: wire the second walk into `runDogWalkFinder` — after a primary is booked/kept, plan and `bookOrReconcileWalk_` a `slot='second'` row (its own two invite events + ledger row + `dogwalk-book`); include `slot='second'` rows in re-evaluation (US3) too.

**Checkpoint**: Early-primary days get the intended bonus afternoon walk; all other days unchanged.

---

## Phase 7: User Story 5 - Visibility, manual resolution, suggest-only mode (Priority: P3)

**Goal**: The app shows exactly one walk per day, surfaces needs-decision days for manual handling, supports suggest-only mode, and sends change notifications (push on move + needs-decision, silent on first booking).

**Independent Test**: `dogwalks.list` returns one entry per booked/suggested day; the dashboard shows a notice listing needs-decision days; `dogWalkAutoBook=FALSE` yields `suggested` rows with no invite events (flip to TRUE → booked with invites); a move and a needs-decision each push once to both people, an initial booking pushes nothing.

### Tests for User Story 5

- [ ] T028 [P] [US5] In `backend/SelfTest.js`: suite for suggest-only — `dogWalkAutoBook=FALSE` produces `status='suggested'` rows (window filled) and creates **no** calendar events; flipping to TRUE books them; and a `notifiedAt` guard prevents re-pushing an unchanged needs-decision day.
- [ ] T029 [P] [US5] In `frontend/src/lib/dogwalks.test.ts`: unit tests for selectors `upcomingWalks` and `needsDecisionDays` in `frontend/src/lib/dogwalks.ts`.
- [ ] T030 [P] [US5] In `frontend/src/components/DogWalkNotice.test.tsx`: renders needs-decision days with reason + calendar link; renders nothing when none; dismiss persists (per-device, mirroring 019).

### Implementation for User Story 5

- [ ] T031 [US5] In `backend/DogWalk.js`: suggest-only branch — when `dogWalkAutoBook` is false, `bookOrReconcileWalk_`/second-walk path writes `status='suggested'` with the window and sends no invites/creates no events; append `dogwalk-suggest`. Flipping the flag on a later run upgrades a `suggested` row to `booked`.
- [ ] T032 [US5] In `backend/DogWalk.js`: change-notification wiring — during `runDogWalkFinder`, on a `move` and on a newly-flagged `needs-decision`, call `sendPushToPerson_` (reuse `Push.js`) to **both** Max and Jaz with the appropriate message; set `notifiedAt` to guard repeats; send **no** push on an initial `booked` (the Google invite notifies). Per clarify Q4.
- [ ] T033 [US5] In `backend/DogWalk.js` + `backend/Api.js`: `listUpcomingDogWalks_()` (today-forward rows shaped to the response type in contracts) and register `'dogwalks.list'` in the `HANDLERS` map.
- [ ] T034 [P] [US5] In `frontend/src/hooks/useDogWalks.ts`: TanStack Query hook calling `dogwalks.list` via the app's `authedCall` (mirror an existing data hook, e.g. `useEvents`).
- [ ] T035 [P] [US5] In `frontend/src/lib/dogwalks.ts`: the `DogWalk` type + `upcomingWalks(rows)` and `needsDecisionDays(rows)` selectors (data-model.md).
- [ ] T036 [US5] In `frontend/src/components/DogWalkNotice.tsx`: dashboard notice listing needs-decision days (reason + link into the calendar to book manually); dismissible per-device (localStorage, mirroring 019's notice pattern); wire it into the dashboard.
- [ ] T037 [US5] In the calendar view (e.g. `frontend/src/components/…` calendar integration): render booked + suggested dog walks as a read-only event source (owner `both` styling) on the calendar and the dashboard 7-day strip, from `useDogWalks` — one entry per walk.

**Checkpoint**: One walk shown in the app per day; needs-decision surfaced; suggest-only + change pushes working end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T038 In `backend/SelfTest.js`: add `selfTestDogWalk()` (public) aggregating the US1–US5 suites, printing `DOG WALK: ALL PASS`, and fold it into the appropriate 028 split-runner (`selfTest4CalendarAndComms()`) so the chunked live run covers it without breaking the coverage audit.
- [ ] T039 [P] Run `/impeccable audit` on `DogWalkNotice` + the calendar walk styling (owner `both` color, WCAG 2.1 AA); fix any contrast/touch-target findings.
- [ ] T040 [P] Confirm `frontend` — `npm run build` clean (no type errors) and all new Vitest suites green.
- [ ] T041 Update `BACKLOG.md` (011 → implemented/pending PR with any deviations) and write back into spec/research any implementation deviations discovered (constitution VII).
- [ ] T042 Deploy backend (`clasp push && clasp deploy -i <deploymentId>`) and run the `quickstart.md` live validation (setupDatabase → installDogWalkTrigger → selfTestDogWalk → real `runDogWalkFinder` book/move/needs-decision/suggest-only). Prompt the human for the Apps Script-editor runs and the one-time calendar sharing/Settings setup (§A) — these are device/OAuth-gated.

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **US1 (Phase 3)** is the MVP and the backbone every later story extends (availability, selection, booking, the run-loop). US2–US5 depend on US1's engine existing.
- **US2 (Phase 4)** adds weather into US1's pipeline. **US3 (Phase 5)** adds revision/horizon over US1+US2. **US4 (Phase 6)** extends the loop with the second walk. **US5 (Phase 7)** adds the frontend + notifications + suggest-only over the ledger states the backend stories produce.
- Because all backend stories live largely in `backend/DogWalk.js`, they are **sequential** (same file), in priority order — not parallel across stories. Parallelism is within a phase across **different files** (marked [P]): SelfTest suites, and the frontend files in US5 (`useDogWalks.ts`, `lib/dogwalks.ts`, `DogWalkNotice.tsx`).
- **Polish (Phase 8)** after the desired stories are complete.

### Within each story

- SelfTest/Vitest tasks first (they encode the acceptance criteria), then implementation.
- Backend helpers before the run-loop wiring that calls them.

## Parallel Example (User Story 1)

```text
# The three SelfTest suites touch independent assertions and can be drafted together:
T007  computeAvailability_ suite
T008  selectWindow_ suite
T009  idempotency + weekend-skip suite
# Implementation T010–T014 is sequential (all in backend/DogWalk.js).
```

## Parallel Example (User Story 5 — frontend fans out)

```text
T034  useDogWalks.ts        (hook)
T035  lib/dogwalks.ts       (selectors)
T036  DogWalkNotice.tsx     (component)   # different files → parallel
# Backend T031–T033 remain sequential in DogWalk.js/Api.js.
```

## Implementation Strategy

- **MVP** = Phases 1–3 (Setup + Foundational + US1): walks book in mutual-free windows as two single-guest invites + one ledger row, idempotent. Deployable and demoable on its own.
- **Incremental**: +US2 (weather) → +US3 (revision/never-cancel) → +US4 (second walk) → +US5 (app visibility, suggest-only, notifications). Each is an independently testable increment via `selfTestDogWalk()` sub-suites and the quickstart.
- Single-developer, sequential by priority (the backend engine is one file); commit after each task or logical group; validate at each checkpoint.

## Notes

- Two users forever: work cal IDs/emails are two fixed Settings values — no roles/tenancy (constitution I).
- Every book/move/suggest/needs-decision appends to ActivityLog (VI); all ledger + calendar writes are idempotent and `withLock_`-wrapped (V).
- No new OAuth scope (calendar + scriptapp already authorized by 007); no new dependency; free-tier only (III).
- Live Apps Script runs (setupDatabase, installDogWalkTrigger, selfTestDogWalk, runDogWalkFinder) and calendar sharing are human/OAuth-gated — surfaced in T042 / quickstart.
