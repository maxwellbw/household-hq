# Implementation Plan: Perf & Resilience

**Branch**: `030-perf-resilience` | **Date**: 2026-07-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-perf-resilience/spec.md`

## Summary

Collapse the app's ~10 sequential cold-load round-trips into a single backend `data.bootstrap` read that seeds the existing TanStack Query cache, so every primary view renders from one response (the activity feed stays a lazy per-tab load). Make every backend call time-boundable and self-healing (an `AbortController` timeout in the shared client plus a transient-only read retry with backoff), so a stalled or blipping request never hangs and usually recovers invisibly. Harden boot-restore so a transient failure (whoami or bootstrap) auto-retries and then shows a recoverable "Couldn't load — Retry" screen that preserves the session, instead of dumping a validly-signed-in user at the sign-in wall. Fill the remaining optimistic-save gaps left by feature 028 (lists, list items, recurring rules, recurring events, templates, settings), and code-split the bundle so a first visit downloads only what the initial view needs (the heavy Schedule-X calendar and the More area load on demand). No Sheet schema change, no new dependency, no user-visible screen behaves differently — only faster and sturdier.

## Technical Context

**Language/Version**: TypeScript ~6.0 (frontend, React 19); Google Apps Script V8 (backend, ES2015+, dependency-free)

**Primary Dependencies**: Vite 8, React 19, TanStack Query 5, Tailwind 3 + shadcn/ui, Schedule-X 4 (calendar). Backend: none (Apps Script stdlib). **No new dependency is added by this feature** — timeout uses native `AbortController`, retry uses TanStack Query's built-in retry, splitting uses native `React.lazy`/dynamic `import()`.

**Storage**: One Google Sheet (unchanged). This feature adds no tab, column, or record shape.

**Testing**: Vitest + Testing Library (frontend), `backend/SelfTest.js` run via `clasp run selfTest` (backend)

**Target Platform**: GitHub Pages static PWA (installed on iPhone + desktop browsers); Apps Script web app backend

**Project Type**: Web application (`/frontend` + `/backend`)

**Performance Goals**: Cold open issues exactly one initial data request (down from ~10); time-to-real-data at least halved under normal household connectivity; previously-blocking saves reflect in UI <~100 ms; first render does not download deferred chunks.

**Constraints**: Apps Script 6-minute per-request limit and response-size ceiling (bootstrap must fit one request; activity feed deferred to keep the largest ever-growing list out of the cold payload); read-once-per-tab Sheet access; text/plain POST envelope (feature-001 CORS decision) unchanged; two-user allowlist gate unchanged; offline-tolerant PWA.

**Scale/Scope**: Two users, one household. Dataset sizes are tens-to-low-hundreds of rows per tab — small enough that composing all core tabs into one response is cheap. No scale/tenancy concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ Pass | No roles, tenancy, registration, or scale abstractions. Bootstrap honors the same two-email allowlist + per-actor task scoping as the calls it composes. |
| II. The Sheet Is the Source of Truth | ✅ Pass | No schema change. The TanStack Query cache is a UI-layer cache seeded from the Sheet and invalidated on every write (the existing pattern) — not a shadow source of truth. Bootstrap is read-only; hand-edits remain authoritative on next fetch. |
| III. Free-Tier Only | ✅ Pass | No new service, no paid tier, no API key. |
| IV. Boring and Debuggable | ✅ Pass | No new dependency. `AbortController`, TanStack retry, and `React.lazy` are stock. Retry logic is a small pure predicate; splitting is a handful of `lazy()` boundaries. Straight-line over clever. |
| V. Idempotent Generation | ✅ Pass (N/A for new code) | Bootstrap is read-only. Existing idempotent writes are untouched; write recovery leans on that existing idempotence rather than adding auto-retry of writes. |
| VI. Every State Change Is Logged | ✅ Pass | Bootstrap logs nothing (read-only). The optimistic-save conversions change only *when* the UI updates, not the backend handlers — every write still appends to ActivityLog exactly as before. |
| VII. Spec-Driven Development | ✅ Pass | spec → clarify → plan chain followed; on branch `030-perf-resilience`. |

**Result**: No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/030-perf-resilience/
├── plan.md              # This file
├── research.md          # Phase 0 output — 6 decisions (bootstrap, cache-seeding, timeout/retry, boot-restore, splitting, optimistic gaps)
├── data-model.md        # Phase 1 output — the bootstrap payload shape (aggregate of existing collections)
├── quickstart.md        # Phase 1 output — live validation of all 5 stories
├── contracts/
│   └── api-bootstrap.md  # Phase 1 output — the data.bootstrap action contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── Api.js               # ADD 'data.bootstrap' handler to HANDLERS (composes existing list helpers; excludes activity)
└── SelfTest.js          # ADD a bootstrap self-test asserting shape parity with individual list actions

frontend/
├── vite.config.ts       # ADD manualChunks (split Schedule-X + React vendor) to complement React.lazy
├── src/
│   ├── main.tsx         # UPDATE QueryClient defaultOptions: transient-only retry predicate + backoff for reads
│   ├── App.tsx          # UPDATE to React.lazy the Calendar + More views behind Suspense + an error boundary; wrap signed-in app in the boot/bootstrap gate
│   ├── lib/
│   │   └── api.ts       # ADD AbortController timeout to apiCall; classify timeout/abort as retryable network error
│   ├── hooks/
│   │   ├── useAuth.tsx        # UPDATE restore(): transient whoami failure → recoverable 'restore-error' state (auto-retry then manual), NOT signed-out
│   │   ├── useBootstrap.ts    # NEW — one data.bootstrap query that seeds every dataset cache key via setQueryData
│   │   ├── useMutations.ts    # EXTEND optimistic pattern to any remaining task/event gaps
│   │   ├── useListMutations.ts# EXTEND optimistic: list create/delete, list-item create/edit
│   │   └── (recurring/recurringEvents/templates/settings mutation hooks) # EXTEND optimistic per research R6 inventory
│   └── components/
│       ├── auth/
│       │   ├── RestoringGate.tsx   # REUSE for the auto-retry phase
│       │   └── BootErrorGate.tsx   # NEW — recoverable "Couldn't load — Retry" screen (manual fallback)
│       └── shell/
│           └── LazyBoundary.tsx    # NEW — Suspense + error boundary wrapper for lazy views (retryable chunk-load failure)
└── src/lib/api.test.ts, src/hooks/*.test.ts  # ADD/UPDATE unit tests (timeout, retry predicate, bootstrap seeding, restore hardening, optimistic revert)
```

**Structure Decision**: Existing two-project web layout (`/frontend` + `/backend`). All changes are additive edits to existing files plus four small new frontend modules (`useBootstrap.ts`, `BootErrorGate.tsx`, `LazyBoundary.tsx`, and the mutation-hook extensions). One new backend handler. No new tab, no new top-level directory.

## Phase 0 — Research (see research.md)

Six decisions resolve the how:

1. **R1 — `data.bootstrap` handler**: one new backend action composing the existing `list*` helpers into a single response; activity excluded; same identity/actor gating; sequential in-memory tab reads well within the 6-min limit.
2. **R2 — Cache seeding without double-fetch**: `useBootstrap` seeds each dataset's query key with `queryClient.setQueryData`; because seeded data is fresh under `staleTime: 30s`, the existing per-dataset hooks mount without refetching. Activity's hook only mounts inside the (lazy) More view, so it stays a lazy load by construction.
3. **R3 — Timeout + transient-only retry**: `AbortController` timeout inside `apiCall`; a `retry`/`retryDelay` predicate in the QueryClient that retries only network/timeout/bad-response codes (never VALIDATION_FAILED/FORBIDDEN/UNAUTHENTICATED/UNKNOWN_ACTION), with bounded count + backoff; mutations keep TanStack's default of no retry (writes not auto-retried).
4. **R4 — Boot-restore state machine**: add a recoverable `restore-error` auth state; `restore()`'s transient branch (today → `signed-out`) routes there instead; genuine forbidden/expired still route to their terminal states; a unified auto-retry-then-manual gate covers both whoami and bootstrap transient failures and preserves the session.
5. **R5 — Code splitting**: `React.lazy` the Schedule-X calendar view and the More view (with a `LazyBoundary` giving a graceful fallback + retryable chunk-load error); `manualChunks` splits the Schedule-X and React vendor bundles so the initial chunk stays lean.
6. **R6 — Optimistic-save gap inventory**: enumerate the mutation hooks still using `onSuccess`-invalidate-only and convert them to the established `onMutate`/`onError`-rollback/`onSettled`-invalidate pattern from feature 028.

## Phase 1 — Design & Contracts

- **data-model.md**: the bootstrap payload as a transport-level aggregate of the nine core collections, each field-identical to its individual `list` response; activity explicitly excluded; no new stored entity.
- **contracts/api-bootstrap.md**: the `data.bootstrap` request/response envelope, gating, error codes, and shape-parity guarantee.
- **quickstart.md**: live validation for all five stories (one request on cold load, restore hardening, timeout/retry, optimistic gaps, split bundle), runnable against the deployed web app with a dev session token.

## Complexity Tracking

No constitution violations — table omitted.
