# Household HQ — Backlog / Sprint Tracker

Source of truth for feature order: `docs/household-hq-project-brief.md` §10.
Per-feature detail lives in `specs/NNN-name/`. This file is the one-glance index —
update it whenever a feature moves stage (spec written, plan done, tasks generated,
implemented, merged). Ask Claude to "update BACKLOG.md" after any speckit step or PR merge.

**Stage legend:** `spec` → `clarify` → `plan` → `tasks` → `implement` → `deployed` → `merged`

## Phase 1 — Core (MVP)

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 001 | Sheets schema and JSON API | ✅ merged | [specs/001-sheets-schema-and-api](specs/001-sheets-schema-and-api/spec.md) | [#1](https://github.com/maxwellbw/household-hq/pull/1) |
| 002 | Auth allowlist + verified attribution | ✅ merged | [specs/002-auth-allowlist](specs/002-auth-allowlist/spec.md) | [#2](https://github.com/maxwellbw/household-hq/pull/2) |
| 003 | Tasks CRUD and activity log | ✅ merged | [specs/003-tasks-crud-and-activity-log](specs/003-tasks-crud-and-activity-log/spec.md) | [#3](https://github.com/maxwellbw/household-hq/pull/3) |
| 004 | Recurring chore engine | ✅ merged | [specs/004-recurring-engine](specs/004-recurring-engine/spec.md) | [#4](https://github.com/maxwellbw/household-hq/pull/4) |
| 005 | Events and prep templates | ✅ merged | [specs/005-events-and-prep-templates](specs/005-events-and-prep-templates/spec.md) | [#5](https://github.com/maxwellbw/household-hq/pull/5) |
| 006 | Calendar UI (home screen) | ✅ merged | [specs/006-calendar-ui](specs/006-calendar-ui/spec.md) | [#6](https://github.com/maxwellbw/household-hq/pull/6) |
| 007 | Google Calendar sync | 🟢 implemented + validated, PR open | [specs/007-gcal-sync](specs/007-gcal-sync/spec.md) | [#7](https://github.com/maxwellbw/household-hq/pull/7) |

## Phase 2 — Comfort

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 008 | Email digests | ⬜ not started | — | — |
| 009 | ntfy.sh completion pings | ⬜ not started | — | — |

## Phase 3 — Stretch

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 010 | PWA install + web push | ⬜ not started | — | — |
| 011 | Weather-aware dog-walk window finder | ⬜ not started | — | — |

## Phase 4 — Someday (data-model-compatible only; build nothing yet)

- Projects concept (vendor threads grouping tasks)
- Claude API vendor outreach (draft/parse/propose, human sends)

---

## Currently active

**007 — Google Calendar sync** (next in brief §10). Stage: **planned** (spec + clarify + plan done) on branch `007-gcal-sync`.
One-way outbound push of app Events + dated Tasks → shared Household Google Calendar (native phone notifications). Work-calendar reading / dog-walk finder / weather / auto-invite are explicitly deferred to 011. Clarify decisions: immediate mirror + nightly reconcile; default reminders (30 min / 09:00); today-forward window; `[Owner]` title prefix + per-owner color. Design: new `CalendarSync.js` reconciler brain (on-write + nightly `syncCalendar()`), pointer stored in `Events.gcalEventId` + new `Tasks.gcalEventId` column, broad `calendar` OAuth scope (front-loaded for 011). T001–T014 implemented + deployed (@11, stable URL). T015 validated live: shared account re-authorized for the `calendar` scope (via `checkCalendarAuth()`), `setupDatabase()` re-run (added `Tasks.gcalEventId` + the two Settings), `householdCalendarId` set, `installCalendarTrigger()` installed, `selfTest()` → **ALL PASS**, quickstart Scenarios A–G confirmed on both phones. Self-test note: the live calendar blocks assert only single-execution-reliable behavior (create/update/pointer bookkeeping) because `CalendarApp` caches within an execution; removal / stale-pointer recreation / self-healing / orphan sweep are validated cross-execution in quickstart E/F. PR open — awaiting merge (Max's call).

_006 merged to `main` and deployed to GitHub Pages at `https://maxwellbw.github.io/household-hq/` (Vite + React + Schedule-X calendar frontend; first frontend feature). Merged via direct push because repo PRs were disabled at the time — worth re-checking that setting before 007. Deploy runs on push to `main` via `.github/workflows/deploy-frontend.yml`, reading repo Variables `VITE_API_BASE_URL` (backend `clasp` @10) + `VITE_GOOGLE_CLIENT_ID`. One user-run validation still open: T057 live quickstart sign-in walkthrough (Scenarios A–G)._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, move "Currently active" to the next feature in brief §10.
