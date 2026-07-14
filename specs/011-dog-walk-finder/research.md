# Research: Weather-Aware Dog-Walk Window Finder (011)

Phase 0 decisions. Format per item: **Decision / Rationale / Alternatives considered.**

## R1 — Booking mechanism: two single-guest invites on the household account's own calendar (not via 007 sync, not on the shared Household calendar)

**Decision**: A booking creates **two separate single-guest events** on the household account's **own (primary) calendar** (`CalendarApp.getDefaultCalendar()`), one per person:
`getDefaultCalendar().createEvent(title, start, end, { guests: maxWorkEmail, sendInvites: true })` and again with `jazWorkEmail`. Each is tagged `hhqKind='dogwalk'`, `hhqId=<DogWalks row id>`, `hhqPerson='max'|'jaz'` (reusing/extending `CalendarSync.tagEntry_`). The DogWalks ledger stores **both** event ids (`maxGcalEventId`, `jazGcalEventId`). The walk is **not** an Events-tab row (007 never touches it) and is **not** placed on the shared Household calendar.

**Rationale**: The user requires two separate invites so neither person sees the other's work email as a co-guest. Putting both single-guest events on the household account's **primary** calendar (rather than the shared "Household" calendar) means: each guest still gets their invite on the right work calendar, the app shows exactly one walk (from the single ledger row), and the shared Household calendar the two humans watch does **not** get two overlapping duplicate copies. 007's generic sync is avoided for the same reason as before — its reconcile can't carry guests. **Reconciles spec FR-010/FR-011** (written back).

**Alternatives considered**: (a) One event with both work emails as guests — rejected by the user (co-guest email exposure). (b) Two single-guest events on the **shared Household** calendar — works for the app (one ledger row) but shows two overlapping blocks on the shared Google calendar; rejected to keep it clean. (c) Three events (two invites + one guest-less display copy on the shared Household calendar) — available as an opt-in if the users later want the walk visible on the shared calendar too; not built by default.

## R2 — Invitations, two-event identity, and the "unanswered invite still blocks time" assumption

**Decision**: Each of the two events invites exactly one **work email** (`maxWorkEmail` / `jazWorkEmail`) with `sendInvites: true`. Household HQ only sends; each user configures their own work account to accept/auto-add. Treat an unanswered invite as still blocking that guest's time. A **move** updates both events (`setTime` on each stored id, keeping its single guest + tag); a person whose work email is unset simply gets no event (the other still books).

**Rationale**: Personal/Workspace Google accounts have no one-click auto-RSVP; the reliable, in-scope behavior is that an invited event appears on the guest's calendar and (by default) counts as busy pending response. The spec scopes "auto-accept" as user-side setup (Assumptions). **Own-walk identity on the work-calendar read side**: because we read each work calendar directly, a person's own walk invite appears there on the next run *without* our private `hhq*` tag (organizer-set tags don't propagate to a guest's copy). So we do **not** rely on the tag to exclude it — instead, when *re-planning a specific day that already has a booked walk*, we treat that walk's own current window (known from the ledger) as free (R3/R10), which lets the walk stay or move without treating its own slot as occupied. On all other days the invite only exists on its own day, so there is no cross-contamination.

**Alternatives considered**: Requiring "Make changes to events" sharing to write walks straight onto each work calendar — rejected by the user: work calendars won't grant external write access. Detecting own invites on work calendars by iCalUID via the Advanced Calendar API — rejected as needless complexity; the ledger-window approach is simpler and boring.

## R3 — Reading availability: work calendars + Household calendar, minus ignore-list

**Decision**: Availability per day = the intersection of free time across **three** sources read over the whole horizon window in one `getEvents(rangeStart, rangeEnd)` call each: `maxWorkCalId`, `jazWorkCalId`, and the Household calendar (`householdCalendarId`). An event counts as **busy** unless its title case-insensitively matches an ignore-list entry. All-day events on a work calendar count as busy for the whole search window unless ignore-listed. **Own-walk handling**: because the two invites appear on each work calendar as a guest copy (untagged), the finder does not detect its own walk by tag; instead, when re-planning a day that already has a booked walk, it treats that walk's **own current window (from the ledger)** as free, so the walk can stay or move without its own slot counting against it.

**Rationale**: Q1 clarification added the Household calendar so walks avoid appointments already on it. The ledger-window approach cleanly handles "a walk shouldn't block itself" without depending on tag propagation to guest calendar copies (which doesn't happen). Reading whole-range once per calendar respects the 6-minute budget (R8).

**Alternatives considered**: Google Advanced Calendar `Freebusy.query` — rejected: returns busy blocks without titles, so the ignore-list can't apply. `CalendarApp.getEvents` gives titles and needs no advanced-service enablement.

## R4 — Free/busy-only ICS fallback (Jaz's work calendar, if detail-sharing is blocked)

**Decision**: Primary path is `CalendarApp.getCalendarById(workCalId)` on a calendar shared at "See all event details". If a work calendar can only be shared free/busy (corporate restriction), configure its **private ICS URL** in Settings (`jazWorkIcsUrl`) and read busy blocks via `UrlFetchApp`, parsing `VEVENT` start/end only. Free/busy-only sources **cannot** apply the ignore-list (no titles) — documented as a known degradation. If **neither** detail-share nor ICS is configured for a person, the finder cannot compute a true mutual-free window → **fail safe**: flag affected in-range days `needs-decision` (reason `calendar-unreadable`) rather than book against incomplete availability (FR-022).

**Rationale**: Matches brief §5.16's "shared to personal accounts, or via private ICS URLs if corporate sharing is blocked." Keeps the feature usable even if Jaz's employer blocks external detail sharing, while never silently booking on half the picture.

**Alternatives considered**: OAuth into the work account — out of scope (no new auth concepts, constitution). Assuming free when a calendar is unreadable — rejected: would book walks over real meetings.

**Open at implement time**: whether Jaz's Google work calendar supports external detail-sharing is a **setup-time** determination (quickstart §A). The ICS-parse path is built defensively but only exercised if needed; if full-detail sharing works for both, the ICS branch stays dormant.

## R5 — Open-Meteo request shape and weather-code → snow/ice mapping

**Decision**: One `UrlFetchApp` GET to `https://api.open-meteo.com/v1/forecast` with `latitude`, `longitude`, `hourly=temperature_2m,precipitation_probability,weathercode`, `temperature_unit=fahrenheit`, `timezone=<household tz>`, `forecast_days=16`. A candidate hour **fails** the weather gate if: `temperature_2m > weatherHeatF` (default 80), `temperature_2m < weatherColdFloorF` (default 20), `precipitation_probability >= weatherPrecipPct` (default 50), **or** its WMO `weathercode` is in the snow/ice set: **71,73,75,77** (snow / snow grains), **85,86** (snow showers), **66,67** (freezing rain), **56,57** (freezing drizzle). A walk window is weather-good only if **every** hour it overlaps passes.

**Rationale**: `timezone=` makes Open-Meteo return hour timestamps already in the household tz, sidestepping offset math. Fahrenheit direct from the API avoids conversion. The WMO snow/ice/freezing codes cover the "snow/ice" gate independent of the precip-probability number (freezing rain can be dangerous even at moderate probability). `forecast_days=16` is the API max and defines the outer edge of what's knowable (R6).

**Alternatives considered**: Daily min/max only (brief's original "daily high ≥ threshold → only mornings" heuristic) — rejected in favor of the clarified **per-hour** gates, which are more precise and make the 9 AM–12 PM band + heat gate interact naturally. This supersedes the placeholder `weatherMorningCutoff` Setting (dropped in R7).

## R6 — Horizon & forecast reliability numbers

**Decision**: Two horizon numbers in Settings: `dogWalkReliableDays` (default **14**) — the firm auto-book horizon — and `dogWalkOuterDays` (default **21**) — the outer sliding edge. Each run: for weekdays from today through `today + dogWalkReliableDays`, book/re-evaluate; weekdays from there to `today + dogWalkOuterDays` are **deferred** (no booking, no flag) until they slide into the reliable window. Open-Meteo data is fetched for 16 days; any candidate day without forecast coverage is treated as deferred regardless of the number.

**Rationale**: Directly encodes the user's decision — "book firmly in the ~10–14 day real-forecast window, revise only if a day turns bad." 14 sits at the top of the reliable band and inside the 16-day fetch; 21 keeps "3 weeks" as the advertised outer horizon the window slides toward without pretending day-21 weather is known.

**Alternatives considered**: A single 21-day horizon booking blind past the forecast — rejected: violates the weather-honesty the user explicitly asked for.

## R7 — Settings-key reconciliation (existing placeholders vs. clarified defaults)

**Decision**: Reconcile the pre-existing 011 placeholder keys and add the rest (full list in data-model.md):
- **Keep**: `householdLat`, `householdLon`, `weatherHeatF` (80).
- **Change defaults**: `weatherPrecipPct` 40 → **50**; `weatherColdFloorF` 25 → **20** (per clarify).
- **Drop**: `weatherMorningCutoff` — superseded by per-hour gates (R5).
- **Add**: `dogWalkAutoBook` (TRUE), `maxWorkCalId`, `jazWorkCalId`, `maxWorkEmail`, `jazWorkEmail`, `jazWorkIcsUrl` (optional fallback), `dogWalkIgnoreList` (`Focus time; Block; Busy; Hold`), `dogWalkTitle` (`Booked`), `dogWalkEarliestStart` (`08:00`), `dogWalkLatestStart` (`16:00`), `dogWalkDurationsMin` (`60,45,30`), `dogWalkMiddayBandStart` (`09:00`), `dogWalkMiddayBandEnd` (`12:00`), `dogWalkSecondAfter` (`13:00`), `dogWalkSecondTriggerBefore` (`09:00`), `dogWalkSecondDurationMin` (`30`), `dogWalkReliableDays` (`14`), `dogWalkOuterDays` (`21`).

**Rationale**: The project's convention is config-in-Settings, all hand-editable (constitution II). Reconciling the stale precip/cold defaults now avoids a mismatch between the spec and the seeded Sheet. Changing a default only affects freshly-seeded cells; `seedSettings_` must not overwrite a hand-set value (existing idempotent-seed behavior).

**Alternatives considered**: Hard-coding thresholds — rejected: users must be able to tune "too hot / too wet" without a redeploy.

## R8 — 6-minute budget & batching

**Decision**: Per run: 1 Open-Meteo fetch (16-day hourly) + 1 `getEvents(range)` per source calendar (≤3) + read DogWalks tab once + read Settings once. Compute all in-range weekdays in memory. Writes (create/move event, upsert DogWalks row, push, log) happen per changed day, wrapped in `withLock_`. Expected: a handful of calendar API calls + ≤~15 day computations — well under 6 minutes.

**Rationale**: Mirrors the constitution's "read a whole tab/range once, operate in memory, write back" rule and how `CalendarSync`/`Digests` already batch. SC-007 is the guard.

**Alternatives considered**: Per-day `getEvents` calls — rejected: 3×15 = 45 calendar reads risks the limit and is needless.

## R9 — Window selection: closest-to-midday within the 9 AM–12 PM band

**Decision**: Within a day's eligible (mutual-free ∩ weather-good) time between `dogWalkEarliestStart` and `dogWalkLatestStart`: (1) choose the **longest** duration from `dogWalkDurationsMin` (60→45→30) that fits any eligible window; (2) among all eligible windows of that duration, rank by preference: windows whose start falls inside the 9 AM–12 PM band beat those outside it; within the same tier, pick the one whose start is **closest to 12:00 noon**; ties broken by earliest. The chosen walk's start/end are snapped to the eligible sub-window.

**Rationale**: Encodes Q2 exactly ("closest to midday, ideally 9am–12pm"). Consequence: primary walks rarely start before 9 AM, so the pre-9 AM **second-walk** rule (FR-009) becomes the intended rare exception. Deterministic and unit-testable.

**Alternatives considered**: Earliest-eligible (original spec default) and best-weather — both rejected by the user in clarify.

## R10 — Revision & never-cancel state machine

**Decision**: For each in-range future (start not in the past) DogWalks row:
- **booked**, window still eligible → leave as-is (no move, no notify).
- **booked**, window now fails weather (or a newly-added meeting overlaps) → recompute the day; if an eligible window exists, **move** (update **both** invite events' times via their stored ids + rewrite the DogWalks row window, keeping `status='booked'`), push "walk moved", log. If none exists → **do not cancel**: keep the row and both events, set `status='needs-decision'`, `reason='forecast-turned-bad'`, push once, log.
- No booking yet and day is in-range with an eligible window → **book** (or, in suggest-only mode, write `status='suggested'` with the window and send no invite).
- No booking and **no** eligible window (no mutual-free, or all weather-bad) → `status='needs-decision'` with the specific reason, push once.
- **notifiedAt** guards against re-pushing the same needs-decision day every run.

**Rationale**: Directly implements Q3 ("re-check daily, never cancel, notify & ask when unsure") and Q4 ("push on changes only"). Past-start rows are frozen (FR-018).

**Alternatives considered**: Auto-cancel on unmovable bad weather (original spec) — explicitly overruled in clarify.

## R11 — DST & timezone

**Decision**: All day boundaries, search-window bounds, and band math are computed with `Utilities.formatDate` / date construction in the household tz from Settings. Open-Meteo timestamps are requested in that same tz (R5). Store ISO 8601 strings (with offset) in DogWalks.

**Rationale**: Constitution Platform Constraints. Requesting forecast in-tz plus formatting in-tz keeps a spring-forward/fall-back day from shifting or doubling a window.

**Alternatives considered**: UTC internally with conversion at the edges — more error-prone for a two-user single-tz app; rejected for the boring/debuggable path.

## R12 — Frontend surface

**Decision**: New POST action `dogwalks.list` returns upcoming DogWalks rows (booked/suggested/needs-decision, from today forward). Frontend: `useDogWalks` query hook; render booked/suggested walks as a read-only **event source** on the Schedule-X calendar (owner `both` styling) and on the dashboard's 7-day strip; a dismissible **DogWalkNotice** on the dashboard lists needs-decision days with their reason (mirrors 019's dismissible-notice + per-device localStorage pattern), each linking into the calendar so the user can book manually. No write actions in this feature — manual resolution reuses existing event creation.

**Rationale**: Satisfies US5 visibility + manual-resolution with minimal new surface, reusing established hooks/patterns. Keeps 011 mostly backend, honoring the "finish visible UX before new backend" memory only insofar as this backend feature was explicitly prioritized by the user.

**Alternatives considered**: A full in-app "pick one of these suggested windows to book" flow — deferred as optional; the notice + manual booking meets "notify and ask" without new write endpoints. Revisit if the manual path proves clunky in real use.
