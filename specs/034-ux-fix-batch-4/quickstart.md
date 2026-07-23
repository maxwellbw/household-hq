# Quickstart / Validation: UX Fix Batch 4

How to validate each story end-to-end. Frontend runs against the live Apps Script backend.

## Prerequisites

- **Frontend dev**: `cd frontend && npm run dev` (or the `frontend` launch config) → http://localhost:5173.
- **Browser auth without OAuth** (sandbox-friendly): `cd backend && clasp push && clasp run mintDevSessionToken`, then paste the token into `localStorage['hq.sessionToken']` on the app origin.
- **Backend (US3 only)**: after editing `backend/`, `clasp push` then run `setupDatabase()` once (adds the `stockedAt` column), then `clasp deploy -i <deploymentId>` to refresh the existing web-app URL.
- **Automated checks**: `cd frontend && npm run build` (no type errors) and `npm test` (Vitest). Backend: `clasp run selfTest` (or the relevant `selfTest*` chunk — check in before batch-running chunks, per prior guidance).

## US1 — Book a walk over a conflict (P1)

1. Open the dog-walk planner on a day where every candidate is busy or gate-failing (e.g. a fully-booked day).
2. Tap an hour / rejected candidate that overlaps a busy block or fails a gate. The confirm bar shows the window and a warning ("Conflicts with …" / "Fails: …").
3. **Expected**: **Book** is now *enabled* (previously disabled). Tap it.
4. **Expected**: the "This window … Book anyway" panel appears, naming the gate(s)/conflict(s). Tap **Book anyway**.
5. **Expected**: the walk appears under "This day's walks" as booked; the warning clears.
6. **Negative**: a window outside the walk-eligible hours (e.g. stepped past the band) keeps **Book** disabled with "Outside the walk-eligible hours".
7. Repeat 2–5 with **Book backup** for the second slot.

## US2 — Schedule a someday task (P2)

1. Go to the Tasks tab; expand **Someday**. Have at least one undated task (owner already set).
2. Tap the task **title**. **Expected**: the **task detail sheet** opens (not a schedule modal) — consistent with Open/Done rows.
3. Open the row's **⋮** menu. **Expected**: a **Schedule** item is present and there are **no dead items** (no Snooze/Edit-due that do nothing).
4. Tap **Schedule**. **Expected**: the Schedule dialog opens with the **owner already selected** to match the task; only a date is needed.
5. Pick a date, confirm. **Expected**: the task leaves Someday and appears as a dated task; the change is visible.
6. Re-open Schedule and **Cancel**. **Expected**: the task is unchanged.
7. *(Live walkthrough note: confirm the menu wording and overall feel in-browser; write back any copy change to the spec.)*

## US3 — Last-stocked date (P3)

1. In a list's **All** view, mark an item **stocked** (tap its checkbox).
2. **Expected**: its row shows "stocked <today's date>" (household tz).
3. Mark it **needed** again, then **stocked** again on a later day (or re-toggle). **Expected**: the shown date is the most recent stocking; toggling to needed does **not** erase it.
4. An item **never stocked** shows **no** date.
5. **Sheet check**: open the ListItems tab — a `stockedAt` column holds a plain ISO string; hand-clearing it makes the row show no date without error.
6. **Backend**: `clasp run selfTest` covers set-on-stocked / preserve-on-need / not-client-writable.

## US4 — All-view sort/group/order (P3)

1. In a list's **All** view with a mix of stocked and needed items across sections:
2. **Default (no toggles)**: **Expected** two blocks — stocked items on top, needed items below — in natural order.
3. Toggle **Sort A–Z**. **Expected**: items within each block sort by name.
4. Toggle **Group by section**. **Expected**: each block is grouped under section headings (unsectioned → "Other"); empty sections omitted.
5. Both on: **Expected**: grouped sections, alphabetical within each, stocked block entirely above the needed block.
6. **Invariant**: in every combination, no unchecked (needed) item appears above a checked (stocked) item.

## US5 — Staples count on the dashboard (P3)

1. Mark enough **staple** items **needed** across lists to trip the nudge threshold.
2. On the Home dashboard, **Expected**: the banner reads "Running low on staples — N needed" where N matches the current needed-staples count (grammatical for N=1).
3. Change the count (stock one). **Expected**: the number updates on next dashboard load.

## Definition-of-done gates (per CLAUDE.md)

- `npm run build` clean; `npm test` green; backend `selfTest` green.
- New UI passes an `/impeccable audit` before PR.
- Dates in household tz; ActivityLog appended on stock changes (existing action reused).
- BACKLOG.md stage updated as the feature progresses.
