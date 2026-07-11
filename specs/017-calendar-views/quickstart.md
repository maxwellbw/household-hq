# Quickstart — Calendar views & 7-day surfaces (017)

Manual validation for a **frontend-only** feature. No backend deploy; the live GitHub Pages
app (or `npm run dev`) reads the existing Sheet via the current API.

## Prerequisites

- Signed in as an allowlisted account (Max, Jaz, or shared) — sign-in is required to load data.
- Some existing data to exercise the views:
  - An event with a prep checklist (some tasks `done`, some `open`).
  - At least one **standalone open task with a due date in the past** (for overdue).
  - A day with **more items than the desktop cap** (≥ 5) for "+N more".

## Setup

```bash
cd frontend
npm install          # if needed
npm run test         # unit + component tests must pass
npm run build        # tsc -b && vite build — zero type errors
npm run dev          # local preview
```

## Scenarios

### A. Week & Next-7 views (US1, FR-001/002/002a/002b)
1. Open the Calendar tab. Use the **view switcher** to pick **Week**.
   - ✅ Exactly 7 day-columns, **Sunday first → Saturday**, for the current week.
   - ✅ Events + dated tasks appear as owner-colored chips (all-day list, no hourly grid).
2. Pick **Next 7 days**.
   - ✅ First column is **today**; span is today → +6 days.
3. Use prev/next in Week → moves a **full week**; in Next-7 → shifts the rolling window,
   still 7 days.
4. Repeat A on a **mobile-width** screen — the switcher is present and both week views work.

### B. Sunday-start everywhere (US2, FR-005)
1. Month view: ✅ leftmost weekday header is **Sunday**, rightmost **Saturday**.
2. Week view: ✅ first day **Sunday**.
3. Dashboard 7-day math and any "this week" grouping start Sunday.

### C. Mobile month navigation (US3, FR-006/007)
1. On a phone-width screen in the month view:
   - ✅ **Prev/next month controls are visible** without horizontal scrolling.
   - ✅ Tapping them changes the month.
   - ✅ A tall month scrolls so **every week/day is reachable**.

### D. Desktop month de-clutter + "+N more" (US4, FR-008/009)
1. On desktop, find the dense day (≥ 5 items):
   - ✅ Cell shows a bounded number of **compact chips** + a **"+N more"** control; the cell does
     not overflow its row.
2. Activate "+N more":
   - ✅ Calendar jumps to a **single-day view** listing **all** that day's items.
3. A sparse day shows all chips with **no** "+N more".

### E. Prep-task progress on chips (US5, FR-010/011)
1. Locate the event with a prep checklist:
   - ✅ Its chip shows **"M/N tasks"** matching current done/total (e.g. "3/7 tasks").
2. Complete one of its prep tasks (from the event detail):
   - ✅ The chip's count increments (e.g. "4/7 tasks") after refresh/invalidation.
3. An event with no prep tasks shows **no** progress indicator.

### F. Overdue on today, display-only (US6, FR-012/013/014)
1. With a standalone **open** task whose due date is in the **past**:
   - ✅ It appears on **today** with an **Overdue** badge.
   - ✅ It does **not** also appear on its original past date.
2. Inspect the raw Sheet / task detail:
   - ✅ The task's stored `dueDate` is **unchanged** (still the past date).
3. Complete it → ✅ overdue treatment disappears. Reschedule another overdue task to a future
   date → ✅ it moves to that date with **no** overdue badge.

### G. Dashboard 7-day strip (US7, FR-015–018)
1. On the Home dashboard:
   - ✅ A strip of **exactly 7 day-tiles**, **today first**, then the next 6 days.
   - ✅ Each tile summarizes items with **owner-colored dots/counts**.
   - ✅ A day with no items shows an **empty tile** (still present).
2. Tap a tile:
   - ✅ The **Calendar opens focused on that date**.

## Accessibility gate (constitution DoD)
- Run `/impeccable audit` on the new/changed UI before PR.
- ✅ WCAG 2.1 AA: view switcher, day-tiles, and "+N more" are keyboard-reachable buttons with
  accessible names; overdue badge and owner identity are not color-only; contrast ≥ AA.

## Definition of done
- All scenarios A–G pass on desktop **and** mobile widths.
- `npm run test` green; `npm run build` zero type errors.
- No new backend writes, Sheet columns, or calendar-sync activity (SC-008).
