# Implementation Plan: Weather-Aware Dog-Walk Window Finder

**Branch**: `011-dog-walk-finder` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-dog-walk-finder/spec.md`

## Summary

A daily time-driven Apps Script trigger reads free/busy from both work Google calendars **and** the shared Household calendar over a rolling ~10–14 day (real-forecast) horizon, subtracts an ignore-list of not-really-busy titles, intersects the mutual-free time with an Open-Meteo hourly forecast filtered by weather gates, and books one dog walk per in-range weekday in the best window (longest of 60/45/30 min, closest to midday within a 9 AM–12 PM band). Booking = **two separate single-guest events** (one per person's work email) created on the household account's **own calendar** plus a hidden tag — so neither guest sees the other and the shared Household calendar shows no duplicate; the walk is recorded as **one** row in a new hand-editable **DogWalks** ledger tab that also drives the frontend (the app shows a single walk). The engine **never auto-cancels**: a booked window that turns bad is moved that day; if nothing good remains — or no eligible window exists at all — the day is flagged as *needs-decision* and both users get a push. A frontend layer shows booked walks on the calendar/dashboard and surfaces needs-decision days for manual resolution. Everything reuses the broad `calendar` scope, `script.scriptapp` trigger scope, `CalendarApp` helpers, the 010 web-push system, the Settings tab, and ActivityLog — no new OAuth scope, no new dependency, no paid service.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+) backend; TypeScript + React 18 (Vite) frontend.

**Primary Dependencies**: Backend — none new (dependency-free per constitution); reuses `CalendarApp`, `UrlFetchApp` (Open-Meteo), `LockService`, `SpreadsheetApp`, `ScriptApp` triggers, and the existing `Push.js`/`WebPush.js`. Frontend — existing stack (TanStack Query, Schedule-X calendar, shadcn/ui); no new packages.

**Storage**: The one Google Sheet. New tab **DogWalks** (idempotency ledger + manual-decision surface + frontend source). New Settings keys. No secondary datastore.

**Testing**: Backend — `SelfTest.js` suites (pure helpers exercised directly, plus a live self-test entry point). Frontend — Vitest component/unit tests, matching existing feature patterns.

**Target Platform**: Apps Script web app (Execute as deploying/shared account, access Anyone) + GitHub Pages PWA.

**Project Type**: Web application (backend `/backend` + frontend `/frontend`).

**Performance Goals**: One daily run completes within Apps Script's **6-minute** limit for the full horizon — achieved by fetching each source calendar's events **once** for the whole horizon window and Open-Meteo's hourly forecast in **one** fetch, then computing all in-range weekdays in memory.

**Constraints**: All time math in the single household timezone from Settings (ISO 8601 in the Sheet), DST-safe. Idempotent, `LockService`-wrapped writes. Open-Meteo hourly forecast reliably reaches ~14–16 days — the horizon design lives inside that limit.

**Scale/Scope**: Two users, two dogs, ≤ ~15 in-range weekdays per run, 3 source calendars. No scale accommodations (constitution I).

## Constitution Check

*GATE: evaluated before Phase 0 and re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ Pass | Work emails/cal IDs are two fixed Settings values; no roles, tenancy, or generalization. Owner of every walk is `both`. |
| II. The Sheet Is the Source of Truth | ✅ Pass | New **DogWalks** tab is plain-text, ISO dates, UUID `id`, hand-editable and hand-deletable; app tolerates edits. Consistent with 024 adding Lists/ListItems. No shadow state — the tab + the gcal tag are the only truth. |
| III. Free-Tier Only | ✅ Pass | Open-Meteo keyless; Apps Script triggers; no paid service, no billed key. |
| IV. Boring and Debuggable | ✅ Pass | Straight-line helpers, dependency-free, reuses existing `CalendarApp`/push/lock patterns. No new abstractions. |
| V. Idempotent Generation | ✅ Pass | Dedupe by DogWalks natural key (date, slot) + the `hhqKind='dogwalk'` gcal tag; all writes under `LockService`. Re-runs never duplicate; never-cancel means no destructive churn. |
| VI. Every State Change Is Logged | ✅ Pass | Every book / move / needs-decision flag appends to ActivityLog (timestamp, actor `system`, action, targetId). |
| VII. Spec-Driven Development | ✅ Pass | On branch `011-dog-walk-finder`, full spec folder; the one design reconciliation (FR-011 direct-write vs. via-007) is written back into the spec. |

**Result**: No violations. Complexity Tracking table omitted.

**Post-Phase-1 re-check**: Still passing — the design adds one tab, one API action, one trigger, and reuses existing subsystems; nothing introduces tenancy, paid services, hidden state, or clever indirection.

## Project Structure

### Documentation (this feature)

```text
specs/011-dog-walk-finder/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — DogWalks tab, Settings keys, gcal tagging
├── quickstart.md        # Phase 1 — live validation guide (setup + self-test + real run)
├── contracts/
│   └── dogwalks-api.md   # Phase 1 — dogwalks.list action + internal function contracts
├── checklists/
│   └── requirements.md   # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (repository root)

```text
backend/
├── DogWalk.js           # NEW — the finder engine: horizon loop, availability, weather gates,
│                        #   window selection, book/move, never-cancel/flag, trigger + installer
├── Config.js            # EDIT — DogWalks headers; reconcile/extend 011 Settings keys
├── Setup.js             # EDIT — create DogWalks tab; seed new Settings; setupDatabase() coverage
├── CalendarSync.js      # REUSE — getHouseholdCalendar_, tagEntry_, resolveGcalEvent_ helpers
│                        #   (share the tag + calendar-resolve helpers)
├── Push.js              # REUSE — sendPushToPerson_ for move / needs-decision notifications
├── Api.js               # EDIT — register 'dogwalks.list' handler
├── ActivityLog.js       # REUSE — appendLog_
└── SelfTest.js          # EDIT — new suite(s): availability intersection, ignore-list, weather
                         #   gate, tie-break/band selection, second-walk rule, idempotency,
                         #   never-cancel→flag; live selfTestDogWalk() entry point

frontend/
├── src/hooks/useDogWalks.ts        # NEW — TanStack Query hook over dogwalks.list
├── src/lib/dogwalks.ts             # NEW — pure shaping/selectors (upcoming, needs-decision)
├── src/components/DogWalkNotice.tsx# NEW — dashboard needs-decision notice (mirrors 019 pattern)
├── calendar integration            # EDIT — render dog walks as an event source on the calendar
└── tests                            # NEW — Vitest coverage for hook, selectors, notice
```

**Structure Decision**: Web application (Option 2). The engine is a single new backend file `DogWalk.js` (mirroring how `CalendarSync.js`, `Digests.js`, `RecurringEvents.js` each own one trigger-driven feature), plus small edits to `Config.js`/`Setup.js`/`Api.js`/`SelfTest.js`. Frontend adds a read-only hook + a dashboard notice + a calendar event source, following existing feature conventions.

## Key design decisions (detail in research.md)

1. **Booking = two single-guest invites on the household account's own calendar, NOT via 007 sync and NOT on the shared Household calendar.** One event invites Max's work email, one invites Jaz's — neither guest sees the other. Both live on the household account's primary calendar (so the shared Household calendar shows no duplicate), carry the `hhqKind='dogwalk'` tag, and their two ids are stored on the single DogWalks row. Not Events-tab rows, so 007's sync never touches them. Reconciles spec **FR-010/FR-011** (written back).
2. **DogWalks ledger tab** is the idempotency key store, the never-double-book guard, the needs-decision surface, and the frontend data source — one row per (date, slot), backed by two invite events. The app shows one walk.
3. **Availability = both work calendars (minus ignore-list titles) + the Household calendar.** Tags don't propagate to a guest's calendar copy, so own-walk exclusion during re-planning uses the ledger's known window (not a tag), letting a walk stay or move without blocking itself.
4. **Rolling horizon**: each daily run recomputes in-range weekdays (today … reliable-forecast horizon ~14d), books newly-in-range days, and re-evaluates existing future bookings; days beyond the forecast are deferred silently.
5. **Never cancel**: a bad-turned window is moved; if unmovable or unplaceable, the day is flagged `needs-decision` and a push fires (once — guarded by `notifiedAt`).
6. **Notifications**: silent on first booking (the Google invite notifies); push on move and on needs-decision, via existing `sendPushToPerson_` to both people.
7. **No new scope / re-auth**: `calendar` + `script.scriptapp` already in `appsscript.json` (007 front-loaded them).

## Phase 0 — Research

See [research.md](research.md). Resolves: Open-Meteo request shape & weather-code→snow/ice mapping; invite/guest mechanics and the "unanswered invite still blocks time" assumption; the direct-write-vs-007 reconciliation; ignore-list & free/busy-only ICS fallback; horizon/reliability numbers; window-selection algorithm (band + closest-to-midday); DST handling; 6-minute-budget batching; Settings-key reconciliation (existing placeholders vs. clarified defaults).

## Phase 1 — Design & Contracts

- **data-model.md** — DogWalks tab columns + states, gcal tagging scheme, the full Settings-key set (new + reconciled), ActivityLog action verbs.
- **contracts/dogwalks-api.md** — the `dogwalks.list` POST action (request/response envelope) and the internal engine function contracts (`runDogWalkFinder`, `installDogWalkTrigger`, `planDayWindows_`, `weatherGate_`, `selectWindow_`).
- **quickstart.md** — setup (share calendars, set Settings, `setupDatabase()`), `selfTestDogWalk()` expectations, and a live real-run validation walking through book → move → needs-decision → suggest-only.
