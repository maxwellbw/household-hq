# Implementation Plan: Calendar UI (Home Screen)

**Branch**: `006-calendar-ui` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-calendar-ui/spec.md`

## Summary

Feature 006 bootstraps the entire `/frontend` app — the project's first UI — and ships the calendar-first home screen. A signed-in, allowlisted user (Google Identity Services → ID token → feature-002 backend gate) lands on a calendar that reads Events and Tasks from the existing backend, renders each with consistent owner-color identity, and **tethers prep tasks to their parent event** (the signature interaction). It adds three bounded write paths on top of viewing: **task check-off/reopen**, and a friction-free **quick-add** that creates an event, a recurring chore, or a one-time task from one "+" — all through existing backend actions. Owner filtering is done with independent, combinable toggle chips. No new backend behavior; edit/delete of existing items is out of scope.

**Technical approach**: A Vite + React + TypeScript + Tailwind + shadcn/ui SPA in `/frontend`, deployed to GitHub Pages via GitHub Actions. A single typed API client wraps the backend's `text/plain` JSON-envelope transport and attaches the GIS ID token to every call. TanStack Query owns server state (fetch, cache, optimistic check-off, invalidate-on-write). The calendar grid/agenda comes from **Schedule-X** (see research R1 — the CLAUDE.md-flagged decision), themed entirely with the DESIGN.md token palette via CSS variables; events and tethered task chips render through custom event content. All dates display in the household timezone from Settings.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, targeting ES2020 browsers (modern mobile Safari + Chrome).

**Primary Dependencies**: Vite (build/dev), React, Tailwind CSS, shadcn/ui (Radix primitives), Schedule-X (`@schedule-x/react` + calendar/event-modal packages) for the calendar, TanStack Query (server-state/caching), Google Identity Services (GIS) browser library loaded from Google for sign-in. No calendar/date library beyond Schedule-X's own; light date helpers are hand-written or use the browser `Intl`/`Temporal`-free `Intl.DateTimeFormat` with the household timezone.

**Storage**: None client-side of record — the backend Google Sheet is the source of truth (constitution II). The only local persistence is the GIS session/token in memory + owner-filter UI state (localStorage, non-authoritative) and TanStack Query's in-memory cache (with a "last synced" timestamp surfaced per FR-016).

**Testing**: `npm run build` (tsc + Vite) must pass with zero type errors (DoD). Component/logic unit tests with Vitest + React Testing Library for the pure pieces (owner→color mapping, task→event tether derivation, relative-due formatting, quick-add payload builders, API envelope parsing). Manual quickstart validation against the live deployed backend. `/impeccable audit` before PR.

**Target Platform**: Static PWA-capable SPA on GitHub Pages. Primary: mobile browsers (375px, iOS/Android). Secondary: desktop (~1100px content column). Backend: existing Apps Script web app (unchanged).

**Project Type**: Web application — new `/frontend` (this feature), existing `/backend` (read/consume only).

**Performance Goals**: First calendar paint within ~2s on a normal connection after auth (SC-005), with a loading state until then and never an indefinite spinner. 60fps interactions; check-off feels instant (optimistic). Calendar readable and horizontal-scroll-free at 375px.

**Constraints**: Free-tier only (constitution III) — GitHub Pages hosting, no paid libs (Schedule-X + all deps MIT/permissive). All owner coding uses DESIGN.md tokens (no ad-hoc hex). WCAG 2.1 AA (contrast ≥4.5:1 on real backgrounds incl. owner-soft tints, 44px targets, focus rings, `prefers-reduced-motion`). Two users forever (constitution I) — no roles/tenancy/registration.

**Scale/Scope**: Two users; tens to low-hundreds of events/tasks in any viewed window. One SPA, roughly these screens/regions: sign-in gate, calendar home (month desktop / agenda mobile), event-detail sheet with prep checklist, quick-add sheet (3 types), owner-filter chips, bottom tab bar shell (Calendar active; Tasks/Feed/More stubbed for later features). ~15–25 components.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Two Users Forever | ✅ Pass | Owner values are exactly `max`/`jaz`/`both`; identity comes from the feature-002 allowlist; shared account resolves to a person for writes. No roles, registration, or tenancy introduced. |
| II. The Sheet Is the Source of Truth | ✅ Pass | Frontend is a pure consumer. No client-side datastore-of-record; TanStack Query cache is disposable and never authoritative. All writes go straight to the backend actions that own the Sheet. |
| III. Free-Tier Only | ✅ Pass | GitHub Pages hosting; all dependencies are free/permissive-licensed (MIT). No paid services or billable keys. GIS and the backend are free. |
| IV. Boring and Debuggable | ✅ Pass (with note) | Stays within the decided stack (Vite/React/TS/Tailwind/shadcn). Straight-line React + a single API client + TanStack Query for state; no bespoke state framework. New dependency **Schedule-X** is justified in research R1 (grid/date-math is error-prone to hand-roll; a themeable, well-documented calendar is the boring choice). Alternative (FullCalendar) recorded; final selection is the reviewer's call at the plan gate. |
| V. Idempotent Generation | ✅ Pass (n/a-ish) | No trigger/generation code here. Writes reuse the backend's already-idempotent, `LockService`-wrapped create/complete actions. Client uses optimistic update + invalidation, tolerant of re-fetch. |
| VI. Every State Change Is Logged | ✅ Pass | Every write path (check-off, reopen, quick-add create) calls a backend action that appends to ActivityLog server-side; the client adds no silent mutations. |
| VII. Spec-Driven Development | ✅ Pass | This plan follows spec.md (clarified) on branch `006-calendar-ui`; deviations get written back to the spec. |

**Gate result: PASS.** One item to confirm at the plan-review pause: the calendar-library selection (Schedule-X vs FullCalendar, research R1) — CLAUDE.md explicitly defers this to the 006 plan. No Complexity Tracking entries required (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/006-calendar-ui/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (calendar lib, transport, auth wiring, state, PWA scope)
├── data-model.md        # Phase 1 — frontend view/domain model + tether derivation
├── quickstart.md        # Phase 1 — end-to-end validation scenarios (against live backend)
├── contracts/
│   └── api-client.md    # Phase 1 — frontend↔backend contract (actions used, shapes, errors)
└── tasks.md             # Phase 2 — /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
frontend/                         # NEW — the entire Vite app (first frontend feature)
├── index.html
├── package.json
├── vite.config.ts                # base path for GitHub Pages project site
├── tsconfig.json
├── tailwind.config.ts            # DESIGN.md tokens as Tailwind theme extension
├── postcss.config.js
├── components.json               # shadcn/ui config
├── .env / .env.example           # VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID
├── public/
│   └── manifest.webmanifest      # PWA-capable shell (install/push deferred to 010)
└── src/
    ├── main.tsx                  # app entry, QueryClientProvider, GIS bootstrap
    ├── App.tsx                   # auth gate → app shell
    ├── index.css                 # Tailwind layers + DESIGN.md CSS variables (palette)
    ├── lib/
    │   ├── api.ts                # typed API client (text/plain POST envelope, token attach, error mapping)
    │   ├── auth.ts               # GIS sign-in, token lifecycle, whoami, actingPerson gate
    │   ├── owners.ts             # owner → color/label/initial (DESIGN tokens)
    │   ├── datetime.ts           # household-tz formatting, relative-due ("T−2 days", overdue)
    │   └── tether.ts             # derive event→tasks grouping + standalone tasks
    ├── types/
    │   └── domain.ts             # Event, Task, Settings, Identity, Owner types
    ├── hooks/
    │   ├── useAuth.ts            # session/identity/actingPerson
    │   ├── useEvents.ts          # events.list query
    │   ├── useTasks.ts           # tasks.list query
    │   ├── useSettings.ts        # settings.list (timezone)
    │   └── useMutations.ts       # complete/reopen/create (optimistic + invalidate)
    ├── components/
    │   ├── ui/                   # shadcn/ui generated primitives
    │   ├── auth/SignInGate.tsx   # signed-out state + refusal message + acting-person prompt
    │   ├── shell/AppShell.tsx    # header (who am I) + bottom tab bar (Calendar active)
    │   ├── calendar/CalendarHome.tsx        # Schedule-X wrapper; month(desktop)/agenda(mobile)
    │   ├── calendar/EventContent.tsx        # custom event render: owner edge/tint + prep chip/count
    │   ├── calendar/OwnerFilterChips.tsx    # independent combinable Max/Jaz/Both toggles
    │   ├── calendar/EmptyState.tsx          # warm serif empty state
    │   ├── event/EventDetailSheet.tsx       # event + tethered prep checklist (T−N labels)
    │   ├── task/TaskRow.tsx                 # checkbox, owner chip, relative due, check-off
    │   └── quickadd/QuickAddSheet.tsx       # one "+" → event | recurring chore | one-time task
    └── styles/ (if needed)

.github/workflows/
└── deploy-frontend.yml           # NEW — build + deploy /frontend to GitHub Pages on merge to main
```

**Structure Decision**: Web application. `/backend` already exists and is consumed unchanged; this feature creates `/frontend` in full. Component layout follows DESIGN.md regions (calendar home, event detail, quick-add, owner filter, app shell with bottom tabs) with pure logic isolated in `lib/` for unit testing. A GitHub Actions workflow deploys the static build to Pages (the one-time Pages "enable" toggle is a user action called out at deploy time).

## Complexity Tracking

> No Constitution Check violations require justification. The one new runtime dependency (Schedule-X) is justified in research R1 and stays within the "decided stack + calendar library" allowance already anticipated by CLAUDE.md/the brief. Table intentionally empty.
