# UI Contract: Home Dashboard

This is a **frontend UI contract** (the project exposes no new external/HTTP interface for
this feature — all data comes from existing API methods). It specifies the dashboard's
inputs, sections, and observable states so the view can be validated against the spec.

## Inputs (all from existing hooks — no new network calls)

| Input | From | Used for |
|-------|------|----------|
| `tasks: Task[]` | `useTasks()` | smart views, load balance, rare-chore highlights |
| `events: Event[]` | `useEvents()` | Today/weekend items, event highlights |
| `recurring: RecurringRule[]` | `useRecurring()` | cadence lookup for rare-chore highlights |
| `timezone: string` | `useSettings().timezone` | all day bucketing |
| `viewer` | `useAuth().session` | "you vs. them" framing (acting person) |

## Navigation contract

- `NavSection` gains `'home'` as the **first** item (label "Home", icon `Home`).
- `App.tsx` initializes `active` to `'home'`; opening the app renders `<DashboardHome />`
  (FR-001, SC-001).
- Selecting the "Calendar" nav item renders the unchanged calendar view (FR-007, SC-007).
- The dashboard is reachable from any tab by selecting "Home".

## Section contract

The view renders, top to bottom:

1. **Smart views (US1)** — three labeled groups:
   - **Today**: tasks + events dated today. Each row owner-colored (Max/Jaz/Both) with a
     non-color signal (label/initial), meeting WCAG AA (SC-005).
   - **Overdue**: open tasks strictly before today. Never shows an item also in Today.
   - **This weekend**: tasks + events in Fri–Sun.
   - Each group with no items shows a calm empty state, not a blank area (FR-011).

2. **Load balance (US2)** — for **This week** and **This month**:
   - Renders Max's, Jaz's, and Both's open-task counts for the period.
   - Presents an at-a-glance "who has more" comparison (e.g. "you have 4, Jaz has 5").
   - Counts reconcile exactly to the underlying tasks (SC-004).

3. **Highlights (US3)** — ≤ 3 sparse callouts, or nothing:
   - Noteworthy upcoming event ("Friends are here Fri–Sun").
   - Rare chore coming up ("rare chore coming up: change the air filter").
   - When nothing qualifies, the area is absent or shows a calm empty line — never filler
     (FR-010, US3 scenario 4).

## State contract

| State | Expected behavior |
|-------|-------------------|
| Queries pending | Loading affordance consistent with other views; no layout jump to error |
| Queries error | Existing auth-error handling applies (via `handleAuthError`); no dashboard-specific data mutation |
| All sections empty (quiet week) | Only calm empty states; **zero** error messages, zero blank/broken panels (SC-006) |
| Read-only | Rendering/reading the dashboard changes no task or event state (FR-013); nothing appended to ActivityLog |

## Non-goals (this contract)

- No new backend endpoint, Sheet column, or trigger.
- No completing/editing/scheduling from the dashboard's core view (existing sheets/dialogs
  may be linked later; not required here).
- No landing-view Settings toggle (landing is fixed to the dashboard).
