# Quickstart & Validation: Home Dashboard

Frontend-only feature — validation is local (dev server + unit tests). **No `clasp` deploy**
and no backend change are required. The one non-code gate is the **governance amendment**
(Scenario G), which needs Max's co-approval before merge.

## Prerequisites

- `cd frontend && npm install` (already installed in normal dev).
- Signed-in session against the existing Apps Script web app (existing auth), OR use the
  component/unit tests which seed data directly.

## Run

```bash
cd frontend
npm run dev        # local preview
npm test           # Vitest unit + component tests
npm run build      # must pass with no type errors (Definition of Done)
```

## Validation scenarios

Map to spec user stories / success criteria. Prefer the unit tests for the pure logic
(deterministic "today"); use the dev server for the visual/nav checks.

### Scenario A — Dashboard is the landing view (US1, SC-001, FR-001)
1. Open the app (fresh load).
2. **Expect**: the Home dashboard is the first screen, not the calendar. The "Home" nav item
   is active. The "Calendar" nav item is present and one tap away.

### Scenario B — Today / Overdue / This weekend grouping (US1, FR-002/3/4)
1. Seed (via test or Sheet): a Jaz task due today, an event today, an open task due
   yesterday, an open task due this coming Saturday.
2. **Expect**: today's task + event under **Today** (Jaz color); yesterday's task under
   **Overdue** and *not* under Today; Saturday's task under **This weekend**.

### Scenario C — Empty states (US1, FR-011, SC-006)
1. Seed a quiet period: nothing due today, nothing overdue, nothing this weekend.
2. **Expect**: each section shows a calm empty state. No errors, no blank panels.

### Scenario D — Load balance, week & month (US2, FR-006/7/8, SC-004)
1. Seed 4 open tasks owned by the viewer and 5 owned by the other person due this week, plus
   some `both` tasks and a completed task in the week.
2. **Expect**: week summary reads viewer=4, other=5; `both` shown as its **own** figure (not
   added to either); the completed task is not counted. Month counts ≥ week counts. Numbers
   match a hand count exactly.
3. Sign in as the shared household account (no acting person) → **Expect**: Max and Jaz shown
   by name (no "you"); shared is never counted as an owner (FR-009).

### Scenario E — Highlights, sparse (US3, FR-010)
1. Seed a multi-day/weekend event in the next several days and an open task linked to a
   `quarterly` recurring rule (e.g. "change the air filter") due soon; also seed ordinary
   weekly chores due soon.
2. **Expect**: a highlight naming the event with its day range; a "rare chore coming up"
   highlight for the quarterly chore; **no** highlight for the weekly chores. ≤ 3 highlights.
3. Seed nothing noteworthy → **Expect**: no highlights / calm empty line, never filler.

### Scenario F — Owner color + accessibility (SC-005)
1. With mixed-owner items on screen, run `/impeccable audit`.
2. **Expect**: every item attributable to Max/Jaz/Both by a non-color-only signal; owner
   colors meet WCAG 2.1 AA contrast.

### Scenario G — Governance amendment (US4, FR-014) — **gates merge**
1. Review the branch's edits to `PRODUCT.md`, `DESIGN.md`, the constitution's Development
   Workflow wording (+ version bump), and `CLAUDE.md`'s Design Context.
2. **Expect**: none of them still assert "calendar is home"; all describe the dashboard as
   the landing view with the calendar as primary secondary navigation.
3. **Gate**: Max co-approves the amendment (constitution amendment process) **before** the
   feature merges. Do not merge without it.

## Definition of done (this feature)

- Scenarios A–F pass locally; `npm run build` and `npm test` green.
- New UI passes `/impeccable audit` (Scenario F) before PR.
- Governance amendment (Scenario G) prepared and **co-approved by Max** before merge.
- `BACKLOG.md` updated (stage + PR link) per the start-feature loop.
