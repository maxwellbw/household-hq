# Quickstart — Calendar UI (006) validation

End-to-end validation for the calendar UI against the **live deployed backend**. Run after
`/speckit.implement` and after the frontend is built/served. Covers every user story and the
constitution/DoD gates.

## Prerequisites

1. Backend deployed and reachable (features 001–005): the web-app URL is known, and Settings
   has `maxEmail`, `jazEmail` (and optionally `sharedEmails`) filled, plus a `timezone`.
2. Some seed data in the Sheet for a visible window: at least one **event with prep tasks**
   (so the tether is exercised), one **standalone task**, and events owned by different people
   (max / jaz / both).
3. Google OAuth: the app's origin (GitHub Pages URL and `http://localhost:5173`) is an
   authorized JavaScript origin for the OAuth client (`OAUTH_CLIENT_ID`). *(User action in
   Cloud Console if not already set — flagged at deploy.)*

## Setup

```bash
cd frontend
cp .env.example .env      # set VITE_API_BASE_URL (web-app URL) + VITE_GOOGLE_CLIENT_ID (= OAUTH_CLIENT_ID)
npm install
npm run dev               # http://localhost:5173
# Production build gate (must pass with zero type errors):
npm run build
```

## Scenario A — Sign-in gate & identity (US3, FR-004/005/006)

1. Open the app signed out → **only** the sign-in gate shows; no events/tasks visible. ✅ FR-004
2. Sign in with an **allowlisted** account → admitted; header shows who you are (Max or Jaz);
   calendar loads. ✅ SC-004
3. Sign in with a **non-allowlisted** Google account → calm refusal message; no data. ✅ FR-005
4. (Shared account, if configured) → prompted to act as **Max or Jaz** before any write. ✅ R3
5. Simulate expiry (clear token) and trigger a call → returned to sign-in, no stale-forever
   errors. ✅ FR-006

## Scenario B — Calendar home (US1, FR-001/007/008/009/010)

1. After sign-in the **calendar is the first view** (no navigation needed). ✅ FR-001/SC-001
2. Events for the current period render on correct dates/times, each with **owner color +
   initial/label**. ✅ FR-007/SC-003
3. Navigate prev / next / **today** → each period loads its events. ✅ FR-008
4. Desktop shows a month-scale view; at 375px it shows an agenda/list view and has **no
   horizontal page scroll**. ✅ FR-009/FR-003/SC-005
5. Navigate to an empty period → warm **empty state** (serif line + affordance), not a blank
   grid or spinner. ✅ FR-010

## Scenario C — Tethered prep tasks (US2, FR-011/012/013/014)

1. The seeded event with prep tasks shows a **prep indicator** (owner chips and/or count). ✅ FR-011
2. Open/tap it → **prep checklist** with each task's title, owner (color+initial), status, and
   **relative due / T−N** label. ✅ FR-012
3. A Jaz-owned task uses her berry/plum color + "J" — consistent with elsewhere. ✅ FR-014
4. The standalone task appears on its own date with **no dangling tether**. ✅ FR-013

## Scenario D — Owner filter chips (US4, FR-015)

1. All chips (Max/Jaz/Both) on by default → everything visible. ✅
2. Turn **off Jaz** → Jaz-only items hide; Max + Both remain. ✅
3. Leave **only Both** on → only shared items visible. ✅
4. Turn all back on → full set returns. Each chip shows its owner color + label + on/off state. ✅ FR-015

## Scenario E — Task check-off (US6, FR-019/020)

1. Check off an open task in a checklist → quiet check animation + toast; it settles into done
   **without a full reload**. ✅ FR-019
2. Reload the app (or check as the other user) → the task is still **done** (persisted to the
   Sheet, visible to the other person). ✅ SC-008
3. Reopen it → returns to open and persists. ✅
4. Force a write failure (offline) → UI **reverts** and shows a plain error, not a false done. ✅ FR-020

## Scenario F — Quick-add (US5, FR-021/022/023/024/025)

1. The **"+"** is reachable from the calendar (thumb-reachable on mobile). ✅ FR-021
2. Quick-add offers **event / recurring chore / one-time task**. ✅ FR-022
3. Create an **event** (title + date/time + owner only) → saves and appears on the calendar
   immediately with the owner color. ✅ FR-024
4. Create a **recurring chore** (title + cadence + owner) → saved as a rule; its instances show
   up per the nightly generator (verify a materialized instance appears in a covered date, or
   confirm the Recurring row exists in the Sheet). ✅ R6
5. Create a **one-time task** (title + due date + owner) → appears on that date. ✅
6. Fast path uses **only minimum fields** (defaults fill the rest); a backend `VALIDATION`
   error shows inline and does **not** lose input. ✅ FR-023
7. Confirm there is **no edit/delete UI** for existing events/tasks (out of scope). ✅ FR-025

## Scenario G — Resilience, timezone, a11y (FR-016/017/018, SC-006)

1. Kill the network mid-session → last-known data stays with a **"last synced"** note + retry;
   no infinite spinner. ✅ FR-016
2. Set your device to a different timezone → dates/times still display in the **household tz**
   from Settings. ✅ FR-017
3. Enable `prefers-reduced-motion` → transitions are instant/crossfade; no animation is
   load-bearing. ✅ FR-018
4. Run `/impeccable audit` → **no unwaived findings**; verify contrast ≥4.5:1 on owner-soft
   tints, 44px targets, visible focus rings. ✅ SC-006

## Definition-of-done gates

- [ ] `npm run build` passes with **zero type errors**.
- [ ] Every scenario above verified against the live backend.
- [ ] Owner coding uses **only DESIGN.md tokens** (no ad-hoc hex); consistent across views.
- [ ] `/impeccable audit` clean; WCAG 2.1 AA checks pass.
- [ ] GitHub Actions deploy to Pages succeeds; app loads at the Pages URL and signs in.
