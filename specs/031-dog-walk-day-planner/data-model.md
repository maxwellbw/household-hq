# Data Model: Dog-Walk Day Planner (031)

Phase 1 output. Two persisted changes (one Sheet column, one script property); everything
else the planner shows is derived per request and stored nowhere.

---

## 1. DogWalks tab — one new column

`HEADERS.DogWalks` (`backend/Config.js:88`) gains `decidedBy` as the final column:

```
id, date, slot, status, windowStart, windowEnd, durationMin,
maxGcalEventId, jazGcalEventId, reason, notifiedAt, updatedAt, decidedBy
```

| Field | Values | Meaning |
|---|---|---|
| `decidedBy` | `max`, `jaz`, or blank | Who made this decision by hand. Blank means the finder owns the row and may move, replace, or flag it freely. |

Applied by `setupDatabase()` via the existing additive `migrateHeaders_`
(`backend/Setup.js:62`) — idempotent, no bespoke migration, existing rows get a blank cell
and therefore stay automatic.

### `status` values (existing, plus one)

| Status | Set by | Meaning |
|---|---|---|
| `booked` | finder or user | A walk is booked; calendar invites exist. |
| `needs-decision` | finder | The finder could not find an eligible window and is asking for help. |
| `skipped` | **user only (new)** | A user removed the walk for this day/slot. The finder leaves it alone. |

`skipped` is deliberately distinct from `needs-decision`: one means "a human decided no",
the other means "the machine could not decide". Collapsing them would make it impossible
for the planner to tell the user which of the two happened.

### Interaction with the freeze rule

`isFrozen_` (`backend/DogWalk.js:614`) gains a second, earlier condition:

```
frozen  ⟸  decidedBy is non-blank                     (new — a human decided)
        ∨  (status ∈ {booked, needs-decision} ∧ windowStart ≤ now)   (existing — already started)
```

`processDogWalkDay_` already consults `isFrozen_` for both slots and returns early, so
respecting user decisions requires no new branch in the state machine (FR-021).

### State transitions

```
                    ┌──────────────────── user books ──────────────────┐
                    │                                                  ▼
  (no row) ──finder books──▶ booked ──finder moves──▶ booked      booked+decidedBy
      │                        │                                       │
      │                   forecast bad                            user unbooks
      │                        ▼                                       ▼
      └──finder flags──▶ needs-decision                         skipped+decidedBy
                               │                                       │
                               └──────── user releases (decidedBy cleared) ───────┐
                                                                                  ▼
                                                                    back to finder control
```

A row with non-blank `decidedBy` accepts transitions only from user actions
(`dogwalks.book`, `.unbook`, `.release`) or a hand-edit in the Sheet. Clearing the cell —
in the app or by hand — returns the day to the finder (FR-022).

---

## 2. Forecast cache — one script property

Key: `hq.dogwalk.forecastCache` in `PropertiesService.getScriptProperties()`. Not a Sheet
tab (see research R2). Disposable: deleting it costs at most one run's fallback.

### Encoding

A small header line followed by newline-delimited hour rows, deliberately inspectable in
the Apps Script editor rather than an opaque blob:

```
v1|<fetchedAt ISO-with-offset>|<lat>|<lon>
2026-07-18T08,72,10,1
2026-07-18T09,74,10,1
...
```

Each row: `YYYY-MM-DDTHH,temperatureF,precipProbPct,wmoCode` — the same four values
`fetchForecast_` already builds its in-memory map from, so decoding reproduces exactly the
structure `weatherGate_` consumes and no gate logic changes.

### Trimming (keeps the value under the ~9KB script-property ceiling)

| Dimension | Stored | Rationale |
|---|---|---|
| Days | `reliableDays` (default 14) of the 16 fetched | Days past the reliable horizon are never evaluated by the run loop. |
| Hours | `earliestStart` → `latestStart` + longest duration (default 08:00–17:00) | Only hours that can contain a walk are ever gated. |

≈14 × 10 = 140 rows × ~25 bytes ≈ **3.5KB**, well clear of the ceiling. The writer asserts
the encoded size and, if it ever exceeds a safety threshold, drops the furthest-out days
first and logs that it did — the near-term days are the ones that matter.

### Validity rules

A cached forecast is **usable for booking decisions** only if all hold:

1. `fetchedAt` is within **24 hours** of now (FR-006).
2. `lat`/`lon` match current Settings — otherwise the household moved and the weather is
   for the wrong place.
3. It contains the hours being gated for the day under evaluation.

Failing (1) or (3) it may still be **displayed** in the planner, labelled with its age, but
must not gate a booking. Failing (2) it is discarded outright.

### Writers (research R3)

| Writer | When | Path |
|---|---|---|
| `runDogWalkFinder` | Nightly (hour 3) | Trigger — the congested path |
| `warmForecastCache` | Nightly (hour 21) | Trigger — independent draw |
| `dogwalks.day` | Whenever the planner is opened | Interactive — the path observed to work |

Any successful fetch from any path overwrites the key (FR-006a). Last write wins; there is
no merge, because a whole forecast is always fetched at once.

---

## 3. Derived, not stored

The planner computes these per request from the engine's existing functions and persists
none of them. They are response shapes, not entities — see `contracts/dogwalks-api.md`.

| Shape | Built by | Note |
|---|---|---|
| Busy block | `fetchAllSourceEvents_` + `computeAvailability_` | Ignore-list already applied; carries which person's calendar it came from, for owner coloring. |
| Hourly gate result | `weatherGate_`'s per-hour checks | Which of the four gates failed, named — the heart of US2. |
| Candidate window | `selectWindow_` / `secondWalkPlan_` | Includes the ones not chosen, and why the chosen one won. |

Reusing the engine's own functions rather than reimplementing them in the API layer — or
worse, the frontend — is what makes FR-015 ("the planner MUST reflect the same reasoning
the nightly run uses") structurally true instead of a promise to keep in sync by hand.

---

## Validation rules

| Rule | Enforced where |
|---|---|
| `decidedBy` ∈ {`max`, `jaz`, blank} | Write path; anything else is normalized to blank and logged (Principle II — tolerate hand-edits). |
| A booking window must not have already started | `dogwalks.book` (FR-023). |
| A booking window must fall on the requested date in household tz | `dogwalks.book`. |
| Duration must be one of `durationsMin`, or the second-walk duration for `slot=second` | `dogwalks.book` (spec Out of Scope: no arbitrary durations). |
| Booking a gate-failing or busy window requires `confirmOverride: true` | `dogwalks.book` (FR-021a). |
| One row per (date, slot) | Existing `upsertDogWalkRow_` / `findRow_`. |
| Concurrent writes serialized | Existing `withLock_` on the booking path (FR-024). |
