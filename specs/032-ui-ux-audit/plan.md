# Implementation Plan: Theming & Systemic UI Hygiene

**Branch**: `032-ui-ux-audit-theming` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-ui-ux-audit/spec.md` (+ evidence in [audit.md](audit.md))

## Summary

Add a complete dark theme to the existing single-source token system (`frontend/src/index.css` `:root` block) via a `[data-theme]` override layer with a per-device System/Light/Dark preference, dark browser-chrome/`theme-color`/favicon handling, and dark values for the Schedule-X variable bridge — then land the 19 systemic hygiene findings from the audit (dashboard reading-order merge, shared error/retry + Undo-toast + freshness patterns, desktop layout containment, Tasks/Lists de-noising, filter-state unification, sign-out consolidation, a11y sweep). Zero backend changes; zero new dependencies; DESIGN.md rewritten to match shipped reality in the same PR.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18 / Vite (existing `/frontend`)

**Primary Dependencies**: Tailwind + shadcn/ui, Schedule-X (calendar), @fontsource Fraunces/Inter — no additions (Constitution IV)

**Storage**: Google Sheet via existing Apps Script API — **untouched**. New per-device state in `localStorage` (`hq.theme`, `hq.ownerFilter`), following the existing `hq.sessionToken` key convention

**Testing**: Vitest + Testing Library (existing per-component `*.test.tsx` convention); `npm run build` type gate; manual quickstart validation on the deployed Pages build

**Target Platform**: Mobile-first PWA (GitHub Pages), desktop secondary; evergreen browsers

**Project Type**: Web frontend (existing app shell); no backend tasks

**Performance Goals**: Theme switch < 1s with no reload (SC-002); no added initial-bundle weight beyond the token CSS (~1–2 KB)

**Constraints**: WCAG 2.1 AA in **both** themes against actual rendered backgrounds; owner colors remain identity-legible in dark; no mixed-theme frames during OS switches; `prefers-reduced-motion` untouched

**Scale/Scope**: ~12 view/component clusters touched in `/frontend/src`; 23 FRs; 0 API/schema changes

## Constitution Check

*GATE: evaluated pre-Phase-0 and re-evaluated post-Phase-1 — **PASS** (both), with two justified nuances.*

| Principle | Status | Notes |
|---|---|---|
| I. Two users forever | PASS | No roles/tenancy; theme is a device preference, not a user system |
| II. Sheet is source of truth | PASS (nuance) | `hq.theme` / `hq.ownerFilter` live in localStorage **by design**: they are device-scoped UI state, not household data — a shared Settings row would force one phone's choice onto the other (spec edge case). Losing them on a cleared browser is acceptable and documented |
| III. Free-tier only | PASS | No new services |
| IV. Boring & debuggable | PASS | No theming library; one CSS override block + one ~40-line hook. Undo built on the existing toast + mutation layer |
| V. Idempotent generation | PASS | No generated writes touched |
| VI. Every state change logged | PASS (nuance) | Undo **appends a compensating ActivityLog entry** (e.g., `task-reopen`) via the existing API's normal logging; it never edits or removes the original entry. Net-visible state matches what the user sees; the log stays append-only |
| VII. Spec-driven | PASS | This chain; deviations write back to spec.md |

**Post-design re-check (after Phase 1)**: no new violations introduced by research decisions; R2's owner-color adjustments stay within "owner identity" bounds (same three identities, dark-tuned values documented in DESIGN.md).

## Project Structure

### Documentation (this feature)

```text
specs/032-ui-ux-audit/
├── audit.md             # Pre-spec evidence (already merged into review)
├── spec.md              # Behavior contract
├── plan.md              # This file
├── research.md          # Phase 0 — R1–R7 decisions
├── data-model.md        # Phase 1 — device-state entities
├── contracts/
│   └── ui-states.md     # Phase 1 — shared UI-pattern contracts (theme, retry, undo, freshness)
├── quickstart.md        # Phase 1 — live validation guide
└── tasks.md             # Phase 2 (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
frontend/src/
├── index.css                        # + [data-theme="dark"] token block; color-scheme swap
├── hooks/
│   ├── useTheme.ts                  # NEW — preference + matchMedia + <html data-theme> + theme-color meta
│   ├── useOwnerFilter.ts            # persistence + single shared instance (context)
│   └── useUndoableMutation.ts       # NEW — wraps existing mutations with undo-toast window
├── components/
│   ├── shell/AppShell.tsx           # desktop main padding / FAB placement; avatar menu (F-08, F-28)
│   ├── shell/ErrorState.tsx         # NEW shared retry pattern (F-09) — adopted by Feed/Lists/etc.
│   ├── shell/SyncedAt.tsx           # NEW shared freshness label (F-23)
│   ├── dashboard/DashboardHome.tsx  # section order merge (F-27); Lately strip mount (F-18)
│   ├── dashboard/LatelyStrip.tsx    # NEW (F-18)
│   ├── dashboard/LoadBalance.tsx    # copy + zero-collapse (F-19)
│   ├── dashboard/GroceryNudge.tsx   # tappable (F-31)
│   ├── dashboard/SevenDayStrip.tsx  # today pre-selected; merged day card (F-27)
│   ├── task/TasksView.tsx           # horizon grouping (F-14); quieter commit affordance
│   ├── task/SomedayList.tsx         # single home (F-29; removed from calendar scroll in App.tsx)
│   ├── lists/ListsView.tsx          # add-affordance cleanup (F-15); retry adoption
│   ├── more/MoreView.tsx            # Appearance settings section (System/Light/Dark)
│   ├── feed/FeedView.tsx            # ErrorState adoption (F-09)
│   └── calendar/calendar-theme.css  # dark values for --sx-* bridge; icon/select chrome (F-17)
├── index.html                       # theme-color metas; dark-scheme favicon
└── public/ (icon.svg)               # prefers-color-scheme-aware SVG favicon
DESIGN.md                            # dark tokens, ink drift, nav reality (F-24)
```

**Structure Decision**: everything rides the existing `/frontend` layout; two genuinely new primitives (`useTheme`, `useUndoableMutation`) and three small shared components (`ErrorState`, `SyncedAt`, `LatelyStrip`). No `/backend` edits — verified during research that every needed API call already exists (R5, R7).

## Complexity Tracking

No constitution violations to justify. The two "nuance" rows in the gate are design choices consistent with principle intent, documented above and in research.md.
