# Implementation Plan: Stay Signed In (Session Persistence)

**Branch**: `018-stay-signed-in` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-stay-signed-in/spec.md`

## Summary

Today the app holds the Google ID token in memory only and re-prompts on every visit
(`frontend/src/lib/auth.ts`, `frontend/src/hooks/useAuth.tsx`). This feature makes sign-in
rare by (1) turning on GIS **auto-select** so a returning user's browser silently re-issues
an ID token on app open, (2) remembering the shared-account **acting person** in
`localStorage` and surfacing a dismissible "Signed in as <person> — switch?" affirmation
instead of a blocking prompt, and (3) handling mid-session credential expiry **reactively** —
when an authenticated request fails on a stale credential, silently re-acquire one token and
retry the request once. No credential is ever written to durable storage; authorization is
always re-verified server-side against the existing allowlist. Frontend-only: no backend,
Sheet, scope, or deployment changes.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (Vite), matching the existing `/frontend`.

**Primary Dependencies**: Google Identity Services (GIS) browser library (already loaded via
`<script>` in `index.html`); TanStack Query (existing); no new packages.

**Storage**: Browser `localStorage` for a tiny UI record only — the chosen acting person and
an "attempt auto sign-in" hint. **No token/credential is persisted.** GIS's own `g_state`
cookie governs auto-select eligibility.

**Testing**: Vitest + Testing Library (existing suite, currently 185 tests green). New unit
tests for the persistence helper and the reactive-retry wrapper; component test for the
affirmation banner.

**Target Platform**: Mobile + desktop browsers (GitHub Pages PWA target). Must work on iOS
Safari, where One Tap/FedCM is most likely to decline silent re-auth → interactive fallback.

**Project Type**: Web app (existing `/frontend` + `/backend`); this feature touches
`/frontend` only.

**Performance Goals**: Session restore on app open completes within a few seconds in the
common case (SC-002); no perceptible interruption on reactive refresh (SC-003).

**Constraints**: No server-side session store (free-tier, stateless web app preserved). No
new OAuth scopes → no re-authorization. Must not regress first-time sign-in.

**Scale/Scope**: Two users. ~5–7 frontend files touched (auth lib, useAuth, App boot/gate,
a new persistence helper, an affirmation banner, and migration of data-hook call sites to a
retry-aware authed call).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ No roles/tenancy. Acting person stays `max`/`jaz`; allowlist
  unchanged; persistence never widens who may enter (FR-008).
- **II. The Sheet Is the Source of Truth** — ✅ No Sheet changes and no shadow datastore of
  truth. `localStorage` holds only re-derivable UI convenience (acting person); identity is
  re-verified from a fresh server-checked token every session, so nothing can drift.
- **III. Free-Tier Only** — ✅ No new services; GIS + browser storage only.
- **IV. Boring and Debuggable** — ✅ `localStorage` + a single-flight reactive retry are
  well-trodden. No new dependencies or abstraction layers.
- **V. Idempotent Generation** — ✅ N/A: no trigger-driven or Sheet writes introduced.
- **VI. Every State Change Is Logged** — ✅ No new Sheet state changes. Restoring a session
  is not a mutation; actor attribution in ActivityLog is preserved after restore (FR-010).
- **VII. Spec-Driven Development** — ✅ On its own branch with spec + clarify complete.

**Result: PASS — no violations, Complexity Tracking not required.** (Re-checked after Phase 1
design below: still PASS — the design adds no Sheet state, no backend surface, no new deps.)

## Project Structure

### Documentation (this feature)

```text
specs/018-stay-signed-in/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (client-side session state)
├── quickstart.md        # Phase 1 output (manual + automated validation)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
frontend/src/
├── lib/
│   ├── auth.ts                     # ADD auto_select + silentSignIn()/promptOneTap() helpers
│   └── session-store.ts            # NEW — localStorage read/write for acting person + hint
├── hooks/
│   └── useAuth.tsx                 # restore-on-boot state machine; reactive refresh + retry;
│                                   #   expose authedCall(); persist/clear on sign-in/out
├── types/
│   └── gis.d.ts                    # EXTEND typings (prompt momentListener, revoke, etc.)
├── components/auth/
│   ├── SignInGate.tsx              # unchanged behavior; add 'restoring' loading state
│   ├── RestoringGate.tsx           # NEW (or a status branch) — calm restore state (FR-005)
│   └── ActingPersonAffirm.tsx      # NEW — dismissible "Signed in as X — switch?" banner
├── App.tsx                         # boot: attempt restore before showing gate; mount affirm
└── (data hooks: useTasks/useEvents/useMutations/…) # migrate call sites to authedCall()
```

**Structure Decision**: Existing web-app layout; work confined to `/frontend/src`. The one
cross-cutting change is routing the ~13 authenticated call sites (`{ token: session!.token }`)
through a single retry-aware `authedCall` so reactive refresh is centralized rather than
duplicated per hook.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.
