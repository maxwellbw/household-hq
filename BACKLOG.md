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
| 007 | Google Calendar sync | ✅ merged | [specs/007-gcal-sync](specs/007-gcal-sync/spec.md) | [#7](https://github.com/maxwellbw/household-hq/pull/7) |

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

**008 — Email digests** (next in brief §10, Phase 2). Not started.
Kick off with "start feature 008" to run the full loop.

_007 merged to `main` (PR #7) and deployed to the Apps Script web app (`clasp` @11, same stable URL). One-way outbound sync of Events + dated Tasks → shared Household Google Calendar; nightly `syncCalendar()` trigger installed on the shared account, which is now authorized for the broad `calendar` scope (front-loaded so 011 needs no re-auth). `Tasks.gcalEventId` column + `gcalEventReminderMin`/`gcalTaskReminderTime` Settings live. Validated end-to-end (selfTest ALL PASS + quickstart A–G on both phones). Feature 011 work-calendar decisions (sharing target, ignore-list, auto-invite) captured in brief §5 item 16._

_006 merged to `main` and deployed to GitHub Pages at `https://maxwellbw.github.io/household-hq/` (Vite + React + Schedule-X calendar frontend; first frontend feature). Deploy runs on push to `main` via `.github/workflows/deploy-frontend.yml`, reading repo Variables `VITE_API_BASE_URL` (backend `clasp` @10) + `VITE_GOOGLE_CLIENT_ID`. One user-run validation still open: T057 live quickstart sign-in walkthrough (Scenarios A–G)._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, move "Currently active" to the next feature in brief §10.
