# Quickstart & Validation: Stay Signed In (Session Persistence)

Frontend-only. **No backend/clasp deploy and no OAuth re-authorization** — `auth.whoami` and
token verification are reused unchanged (research R6).

## Prerequisites

- `frontend/.env` (or repo Variables) has `VITE_GOOGLE_CLIENT_ID` and `VITE_API_BASE_URL`.
- A signed-in-capable Google account on the Settings allowlist (Max, Jaz, or shared).

## Build & unit checks

```bash
cd frontend
npm run build          # must pass with no type errors (Definition of Done)
npm test               # existing suite + new tests for session-store, authedCall retry, affirm
```

New automated coverage to expect green:
- `session-store` read/write + corrupt-value fallback.
- `authedCall` retries exactly once on `UNAUTHENTICATED`/`INVALID_CREDENTIAL`, single-flight
  under concurrent failures, and gives up cleanly when refresh fails.
- `ActingPersonAffirm` renders remembered person and switches on tap.
- Boot state machine: `restoring` shown when `hq.autoSignIn` set; wall when absent.

## Manual browser validation (the real proof — needs live Google OAuth)

> The sandboxed preview can't do real Google OAuth; run these on a normal desktop browser and
> a phone, as flagged for 016/017.

### US1 — Returning stays signed in (P1)
1. `npm run dev`, sign in with Google. Confirm you land on the dashboard.
2. Close the tab entirely (and, to exercise expiry, wait >1h or clear the in-memory token by
   a full reload after the token would be stale).
3. Reopen the app URL. **Expect**: a brief calm "restoring" state, then the dashboard as the
   same person — **no sign-in button tap** (SC-001, SC-002).
4. Shared account only: after step 3, **expect** a dismissible "Signed in as <person> —
   switch?" banner, already set to the right person — not the blocking "Who's this?" prompt.

### US2 — Long session never interrupts (P2)
1. Sign in, leave the tab open past token expiry (~1h) — or simulate by invalidating the
   in-memory token.
2. Perform a write (complete or create a task). **Expect**: it succeeds with no interactive
   sign-in and no lost input (SC-003). One Tap may or may not flash, but no button wall.

### US3 — Sign-out & safety (P3)
1. Sign out from More. Reopen the app. **Expect**: the interactive sign-in wall, **no** auto
   re-entry (SC-005).
2. Revoke the app's access at <https://myaccount.google.com/permissions> (or remove the email
   from the Settings allowlist). Reopen. **Expect**: clean fall-back to the sign-in wall or a
   clear "not on the household list" message — **never a prompt loop** (SC-006).
3. First-time / cleared-storage visit: clear site data, reopen. **Expect**: the normal
   sign-in wall, unchanged from today (no regression, FR-011).

### Edge checks
- Corrupt `hq.actingPerson`/`hq.autoSignIn` (set a garbage value in devtools → Application →
  Local Storage). Reopen. **Expect**: treated as signed-out, normal wall, no crash.
- Multiple Google accounts signed into the browser: reopen. **Expect**: silent re-select of
  the prior account, or a clean fallback prompt — never a wrong-account guess.

## Design gate

- Run `/impeccable audit` on the new `RestoringGate` and `ActingPersonAffirm` before PR
  (calm loading state; banner meets WCAG AA contrast and ≥44px touch target — matches the
  bar 017 held).

## Done when

- Build + tests green; all US1–US3 manual scenarios pass on desktop **and** a phone; sign-out
  and revoked-access fall back cleanly with no loop; first-time sign-in unchanged.
