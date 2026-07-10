# Implementation Plan: Home Dashboard

**Branch**: `014-home-dashboard` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-home-dashboard/spec.md`

## Summary

Make a new **Home dashboard** the app's landing view, replacing the calendar as the first
screen. The dashboard summarizes existing tasks and events three ways: **smart views**
(Today / Overdue / This weekend, US1), a **week/month load balance** (Max vs. Jaz vs. Both,
US2), and a sparse set of **contextual highlights** (noteworthy events + rare chores, US3).
It is **frontend-only and read-only** — every piece of data it needs (tasks with
owner/date/status, events, recurring rules, settings/timezone) is already served by the
existing backend and cached by existing react-query hooks. No Sheet schema change, no new
API method, no backend deploy.

Because making the dashboard the landing view **reverses the "calendar is home" principle**
in `PRODUCT.md`, `DESIGN.md`, and the constitution's Development Workflow, the feature
carries a **governance amendment (US4)** that Max must co-approve before implementation
merges. The amendment is prepared as part of this branch but gated on Max's sign-off.

## Technical Context

**Language/Version**: TypeScript 6 / React 19 (existing `/frontend` Vite app)

**Primary Dependencies**: Existing only — `@tanstack/react-query`, `temporal-polyfill`,
Tailwind + shadcn/ui, `lucide-react`. **No new dependencies** (Constitution IV).

**Storage**: None new. Reads existing Google Sheet data via existing API methods
(`tasks.list`, `events.list`, `recurring.list`, `settings.list`).

**Testing**: Vitest + Testing Library (existing). Pure bucketing/summary/highlight logic
unit-tested in `src/lib/*.test.ts`; the dashboard component gets a render test as
`SomedayList`/`CalendarHome` do.

**Target Platform**: PWA on phones (primary) and desktop (weekly), same as the app.

**Project Type**: Web application — frontend-only change within the existing structure.

**Performance Goals**: Dashboard renders from already-cached query data with no new network
round-trips; grouping/counting is O(n) over the household's tasks/events (tens, not
thousands). Perceived load is instant when the queries are warm.

**Constraints**: All date bucketing pinned to the household timezone (Settings.timezone) via
the existing `temporal-polyfill` helpers in `lib/datetime.ts` — never the device clock.
WCAG 2.1 AA contrast for owner color coding.

**Scale/Scope**: Two users; a household's worth of tasks/events. One new nav destination,
one new view component with three sections, one new pure-logic module, a handful of new
datetime range helpers, and the governance-doc amendment.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ Pass | Dashboard shows `max`/`jaz`/`both` only. Landing is **fixed**, not a per-user setting (clarified) — no config knob, no roles, no tenancy. |
| II. The Sheet Is the Source of Truth | ✅ Pass | Read-only view over existing data. No new storage, cache-as-truth, or shadow state. |
| III. Free-Tier Only | ✅ Pass | Frontend-only; no new services. |
| IV. Boring and Debuggable | ✅ Pass | Pure functions + existing React/query patterns; **zero new dependencies**. Straight-line grouping code. |
| V. Idempotent Generation | ✅ Pass (N/A) | No writes; nothing generated. |
| VI. Every State Change Is Logged | ✅ Pass (N/A) | Dashboard is read-only; it mutates nothing, so nothing to log. |
| VII. Spec-Driven Development | ✅ Pass | This branch follows specify→clarify→plan→tasks→implement. |
| Design guidance: "calendar-first" (Dev Workflow, `DESIGN.md`, `PRODUCT.md`) | ⚠️ **Amendment required** | This feature reverses the stated "calendar is home" direction. Resolved by the **US4 governance amendment**, co-approved by Max per the constitution's amendment process before merge. Tracked in Complexity Tracking. |

**Gate result**: PASS to proceed with Phase 0/1 design. The single conflict (calendar-first
guidance) is not a code violation to justify-and-ship — it is resolved *properly* by amending
the governing documents with Max's co-approval, which is itself an acceptance criterion (US4,
FR-014). Implementation must not merge until that amendment is approved.

## Project Structure

### Documentation (this feature)

```text
specs/014-home-dashboard/
├── plan.md              # This file
├── spec.md              # Feature spec (with Clarifications)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (derived view-model, no schema change)
├── quickstart.md        # Phase 1 output (validation scenarios)
├── contracts/
│   └── dashboard-view.md # Phase 1 output (UI contract: sections, inputs, states)
└── checklists/
    └── requirements.md  # Spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
frontend/src/
├── App.tsx                              # CHANGED: default active = 'home'; render DashboardHome
├── components/
│   ├── shell/
│   │   └── navItems.ts                  # CHANGED: add 'home' NavSection (first item)
│   └── dashboard/                       # NEW
│       ├── DashboardHome.tsx            # NEW: top-level view; composes the three sections
│       ├── SmartViews.tsx               # NEW (US1): Today / Overdue / This weekend
│       ├── LoadBalance.tsx              # NEW (US2): week + month per-person/both counts
│       ├── Highlights.tsx               # NEW (US3): sparse contextual callouts
│       └── DashboardHome.test.tsx       # NEW: render test with seeded query data
├── lib/
│   ├── datetime.ts                      # CHANGED: add weekend/week/month range helpers
│   ├── datetime.test.ts                 # CHANGED: cover new range helpers
│   ├── dashboard.ts                     # NEW: pure bucketing + load-balance + highlight logic
│   └── dashboard.test.ts                # NEW: unit tests for the pure logic
└── (existing hooks reused as-is: useTasks, useEvents, useRecurring, useSettings, useAuth)
```

**Structure Decision**: Reuse the existing `/frontend` single-app structure. All new UI
lives under `components/dashboard/`; all new pure logic lives in `lib/dashboard.ts` and new
range helpers in `lib/datetime.ts` (kept separate from React so it is unit-testable and
"boring"). Navigation is the existing `AppShell` + `navItems.ts` tab model — the dashboard
becomes a new first nav item and the default `active` section; **the calendar tab is
unchanged and remains one tap away** (FR-001, FR-007).

### Governance amendment (this feature, US4 — gated on Max)

```text
PRODUCT.md                       # "calendar first" → dashboard-first landing; calendar as primary secondary nav
DESIGN.md                        # "Calendar is home." → "Dashboard is home." + landing description
.specify/memory/constitution.md  # Development Workflow line: "calendar-first" wording + version bump
CLAUDE.md                        # Design Context note kept consistent with the above
```

## Complexity Tracking

> The only Constitution Check item not immediately "Pass" is the calendar-first design
> guidance. It is not a code-complexity violation; it is a deliberate, governed change.

| Item | Why needed | How it is resolved (not "justified away") |
|------|-----------|-------------------------------------------|
| Reversing "calendar is home" design guidance | The feature's whole purpose (per BACKLOG clarification 2026-07-09) is to make the dashboard the landing view, reducing at-a-glance mental load | Amend `PRODUCT.md`, `DESIGN.md`, the constitution's Development Workflow wording, and `CLAUDE.md` in this branch; **Max co-approves** per the constitution's amendment process before merge (US4/FR-014). Version bump: MINOR (materially changes stated design direction; no numbered principle is removed or redefined). |
