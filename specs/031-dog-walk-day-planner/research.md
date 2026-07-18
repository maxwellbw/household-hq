# Research: Dog-Walk Day Planner (031)

Phase 0 output. Resolves the unknowns in `plan.md`'s Technical Context.

---

## R1 — Why does the nightly trigger get HTTP 429 when a manual run does not?

**Observed (2026-07-18)**: `runDogWalkFinder` fired by its time-driven trigger logged
`non-200 response (HTTP 429)` on attempts 1, 2 and 3, all within the same second
(01:26:13), and deferred every day in the horizon. Running the identical function manually
succeeds. Same URL, same parameters, same script project — so the difference lies in the
execution environment, not the request.

**Leading hypothesis — shared trigger egress + top-of-hour synchronization.**
Apps Script runs time-driven triggers on shared batch infrastructure whose outbound IP pool
is much more heavily shared than the path taken by manual/editor executions. The trigger is
installed with `.atHour(1)` (`DOG_WALK_TRIGGER_HOUR = 1`, `backend/Config.js:256`), and
Apps Script dispatches such triggers at an arbitrary minute inside the 01:00–02:00 window.
An extremely large cohort of scheduled scripts fires in that same window, and Open-Meteo —
free, keyless, requiring no signup — is a common default weather source among them.
Open-Meteo rate-limits per source IP. The result is a burst against a shared address that
trips the limit for reasons entirely unrelated to this household's one request per night.
A manual run happens at a quiet hour, from a different egress path, and sees no limit.

**Supporting evidence**: the failure is intermittent rather than permanent; it is
time-correlated (top-of-hour window); and the request itself is unchanged between the two
cases, which rules out a malformed URL, bad coordinates, or a parameter-driven quota.

**Alternatives not yet ruled out**:

| Alternative | How to distinguish |
|---|---|
| Per-project quota differing between trigger and interactive execution | Would show as a consistent failure at any trigger hour, not a time-correlated one. Moving the trigger hour discriminates. |
| Attribution differences when no user session is active | Would fail 100% of trigger runs, not intermittently. The finder has succeeded on prior nights. |
| Open-Meteo applying stricter limits to requests lacking browser-like headers | Would fail manual runs too, since `UrlFetchApp` sends the same default headers either way. Largely excluded already. |

**Decision: design for resilience rather than block on a confirmed root cause.**
The failure is observable roughly once per night, which makes root-causing slow and
expensive in calendar time. Every mitigation below is correct under *all* the hypotheses
above, so the fix does not depend on which one is true:

1. A durable forecast cache with a non-trigger warm path (R2, R3) — makes any single
   failed fetch non-fatal regardless of cause.
2. Minutes-scale backoff that distinguishes 429 from generic transient failures (R4) —
   directly addresses the rate-limit hypothesis.
3. Moving the finder trigger off hour 1 (R3) — both a mitigation and the cleanest
   experiment for discriminating the hypotheses.

Instrumentation is added so the next occurrences are diagnosable without guesswork: log the
response body on a non-200 (Open-Meteo returns a JSON `reason` string on 429), the attempt
timestamps, and whether the execution was trigger- or user-initiated.

**Rationale**: shipping a fix that works under every candidate cause beats waiting nights
to confirm which cause is real. If the trigger-hour move turns out to eliminate the failure
entirely, that confirms the hypothesis for free, as a side effect of a change worth making
anyway.

---

## R2 — Where does the cached forecast live?

**Decision: `PropertiesService.getScriptProperties()`, one key, compact delimited encoding,
trimmed to the walk-relevant hours of the reliable horizon.**

| Option | Verdict |
|---|---|
| A new Sheet tab | **Rejected.** Principle II requires the Sheet stay human-readable with no opaque serialized blobs. A few thousand forecast cells is machine data no human would read or edit, and its presence invites hand-edits to something that is meant to be disposable. It would also make a throwaway cache look like household data. |
| `CacheService` | **Rejected as the primary store.** Maximum TTL is 6 hours, which cannot satisfy the 24-hour freshness limit in FR-006. Entries can also be evicted early under memory pressure — acceptable for a cache, fatal for the only fallback. |
| `PropertiesService` script properties | **Chosen.** Durable, survives across executions and deploys, no TTL ceiling, already used in this codebase (`backend/Auth.js:63`), and invisible to the Sheet. |

**Size constraint and encoding.** Script properties cap a single value at ~9KB. A naive
JSON dump of all 16 forecast days at hourly resolution (384 entries with three fields each)
lands around 9–10KB — too close to the ceiling to be safe. Two reductions bring it well
under:

- **Trim the horizon** to `reliableDays` (default 14) rather than the fetched 16 — days
  beyond the reliable horizon are never evaluated by the run loop anyway.
- **Trim the hours** to those that can contain a walk: `earliestStart` through
  `latestStart` plus the longest duration (default 08:00–17:00), rather than all 24.

That yields roughly 14 days × 10 hours = 140 entries. Encoded as newline-delimited
`YYYY-MM-DDTHH,temp,precipProb,code` rows (~25 bytes each) the payload is ~3.5KB, leaving
comfortable headroom. The encoding is trivially inspectable in the Apps Script editor,
which matters for debugging (Principle IV).

**Stored alongside**: `fetchedAt` (ISO-with-offset, household tz) and the `lat`/`lon` the
forecast was fetched for, so a coordinates change in Settings invalidates the cache rather
than silently serving weather for the old location.

**Rationale**: one mechanism, no new Sheet surface, durable enough for a 24-hour window,
and small enough that the size ceiling is not a live risk.

---

## R3 — How does the cache get warmed when the failing path is the only writer?

This is the trap the naive design walks into: if only `runDogWalkFinder` fetches forecasts,
and `runDogWalkFinder` is precisely what gets rate-limited, then the cache is empty exactly
when the fallback needs it. A cache alone would not have fixed the 2026-07-18 incident.

**Decision: three writers, none of which is solely the 1am finder trigger.**

1. **Move the finder trigger off hour 1** → `DOG_WALK_TRIGGER_HOUR = 3`. Less congested
   than the extremely popular midnight/1am band, and doubles as the R1 experiment.
2. **A separate forecast warm-up trigger** at an unrelated hour (`21`), running a small
   `warmForecastCache` entry point that fetches and stores only. Cheap (one HTTP call), and
   means a 3am failure falls back to a forecast at most ~6 hours old — comfortably inside
   the 24-hour limit. Two independent draws at different hours make simultaneous failure
   much less likely than one.
3. **The planner's on-demand reads (US2)**, which run inside user-initiated web-app
   requests. These take the interactive execution path — the one already observed to
   succeed — so ordinary daytime use of the planner keeps the cache fresh. Any successful
   fetch from any path updates the cache (FR-006a).

**Ordering note**: US1 ships before US2, so writers 1 and 2 must carry the fix on their own
initially; writer 3 strengthens it once the planner lands. This is why the warm-up trigger
is part of US1 rather than deferred — without it, US1's fallback would depend on the same
congested path it is meant to protect against.

**Rejected**: retrying the whole finder run later via a self-rescheduling trigger. It
multiplies executions, complicates the idempotency story, and Apps Script offers no clean
"retry this run in 20 minutes" primitive that does not leave triggers to clean up.

---

## R4 — Retry and backoff schedule

**Decision: classify the failure, then back off on a schedule sized to the class, bounded
by the 6-minute execution limit.**

Current behavior is a flat `Utilities.sleep(500)` between three attempts
(`DOG_WALK_FETCH_RETRY_SLEEP_MS_`), putting all three inside one second — which is why the
log shows three failures at the same timestamp. Against a rate limit this is worthless: no
rate-limit window is under a second.

| Failure class | Schedule (sleep before next attempt) | Reasoning |
|---|---|---|
| HTTP 429 (rate limited) | 45s, then 150s | Spans ~3.5 minutes, enough to cross a per-minute limiter and to let a top-of-hour burst drain. |
| Other non-200 / thrown exception | 2s, then 8s | Transient network or brief server error; no benefit to waiting minutes. |

Worst case is ~195s of sleeping plus fetch time, safely inside the 360s ceiling — and this
is the whole budget for one HTTP call in a run that otherwise does calendar reads. The
finder fetches the forecast first, before any calendar work, so a slow retry sequence
cannot strand a partially completed run.

**Also**: on a non-200, log `resp.getContentText()` (truncated). Open-Meteo returns a JSON
body with a human-readable `reason` on 429, which will confirm or refute R1's hypothesis on
the next occurrence at zero cost.

**Rejected**: honoring a `Retry-After` header. Open-Meteo does not reliably send one, and
branching on a header that is usually absent adds a code path that is almost never
exercised and therefore almost never correct (Principle IV).

---

## R5 — How is a user decision marked so automatic runs respect it?

**Decision: a new `decidedBy` column on the DogWalks tab; blank means automatic.**

| Option | Verdict |
|---|---|
| New status values (`user-booked`, `user-skipped`) | **Rejected.** `status` currently answers "what is the state of this walk" and is consumed by the frontend and `listUpcomingDogWalks_`. Overloading it with *who decided* conflates two orthogonal facts and forces every status consumer to learn the new values. |
| Encode into the existing `reason` column | **Rejected.** `reason` is a free-text diagnostic (`no-mutual-free`, `forecast-turned-bad`); making it load-bearing for control flow makes a debugging field into a state machine input. |
| New `decidedBy` column | **Chosen.** One column, one meaning: `max`, `jaz`, or blank. Hand-editable and self-explanatory in the Sheet — a human can clear the cell to hand a day back to the finder, which is exactly FR-022's affordance. |

`HEADERS.DogWalks` gains `decidedBy`; `migrateHeaders_` (`backend/Setup.js:62`) already
performs additive column migration idempotently, so this needs a `setupDatabase` run and no
bespoke migration code.

**Interaction with the existing freeze**: `isFrozen_` (`backend/DogWalk.js:614`) currently
freezes a row whose window has already started. It gains a second condition — a non-blank
`decidedBy` freezes the row regardless of time. This is the smallest possible change to the
run loop: `processDogWalkDay_` already calls `isFrozen_` for both slots and returns early,
so user decisions are respected with no new branch in the state machine.

**User-removed days** get `status = 'skipped'` with `decidedBy` set — distinct from
`needs-decision` (the finder could not decide) and from a booked row. The finder skips it;
clearing `decidedBy` returns the day to automatic handling.

---

## R6 — API surface for the planner

**Decision: one read endpoint and three write endpoints**, following the existing
`noun.verb` dispatch convention in `backend/Api.js`.

| Action | Purpose |
|---|---|
| `dogwalks.day` | Everything the planner needs for one date: merged busy blocks, per-hour gate results, candidate windows, the chosen window, forecast provenance (live/cached + age). Read-only. |
| `dogwalks.book` | Book a walk into an explicit window for a (date, slot). Sets `decidedBy`. Requires `confirmOverride` when the window fails a gate or overlaps a busy block. |
| `dogwalks.unbook` | Remove a booked walk; sets `status = 'skipped'` and `decidedBy`. |
| `dogwalks.release` | Clear `decidedBy`, returning the day to automatic handling (FR-022). |

`dogwalks.day` deliberately returns the *derived* reasoning rather than making the frontend
recompute it. The frontend must not reimplement `computeAvailability_`, `weatherGate_`, or
`selectWindow_` — a second implementation would drift from the engine's and break FR-015
("the planner MUST reflect the same reasoning the nightly run uses"). Reusing the engine's
own functions to build the response is what makes FR-015 structurally true rather than a
thing to remember.

`dogwalks.book` routes through `bookOrReconcileWalk_`/`ensureInviteEvent_` — the same path
`resolveSlot_` uses — satisfying FR-018 and inheriting its idempotency and `withLock_`
wrapping (FR-019, FR-024) rather than reimplementing them.

---

## R7 — Frontend surface for the planner

**Decision: a panel opened from the existing day surfaces, not a new top-level tab.**

`DayPeekPanel.tsx` already shows a day's walks (feature 029), and `CalendarHome.tsx` owns
the day views. The planner opens from the walk entry in the day peek — the calendar stays
the organizing metaphor and no new navigation destination is introduced (PRODUCT.md,
constitution "dashboard-first landing with the calendar as primary secondary navigation").

Rendering is a vertical timeline for the day: busy blocks as filled bands, per-hour gate
results as a weather strip alongside, candidate windows as selectable regions. Owner colors
(Max/Jaz/Both) mark whose calendar a busy block came from — identity, never decoration.

Loaded on demand via `dogwalks.day` when the planner opens, rather than folded into
`data.bootstrap`. Bootstrap is the cold-load path that feature 030 worked to slim down;
adding per-day planner payloads for every day in the horizon would undo that. The planner
is opened deliberately for one day, which is exactly the shape of a lazy load.

---

## Constitution alignment

| Principle | How this feature complies |
|---|---|
| I — Two users forever | No new roles or permissions. `decidedBy` holds `max` or `jaz` — the same two-value vocabulary already used for ownership. |
| II — The Sheet is the source of truth | The forecast cache is in script properties, explicitly *not* a Sheet tab, and is disposable — losing it degrades nothing but one run's fallback. `decidedBy` is a plain hand-editable text column. |
| III — Free-tier only | Open-Meteo remains the keyless free source. The fix reduces load on it rather than increasing it. One extra lightweight daily trigger. |
| IV — Boring and debuggable | One cache mechanism, one new column, four endpoints following the existing dispatch pattern. The planner reuses the engine's own functions rather than growing a parallel implementation. |
| V — Idempotent generation | Booking routes through the existing `bookOrReconcileWalk_` path and inherits its idempotency and locking. The warm-up trigger only overwrites a cache key. |
| VI — Every state change is logged | `dogwalks.book`, `.unbook`, and `.release` each append to ActivityLog with the acting person. Cache writes are not state changes to household data and are not logged. |
| VII — Spec-driven | This feature has spec, plan, research, data model, contracts, and quickstart before implementation. |

No violations. Complexity Tracking table in `plan.md` is empty.
