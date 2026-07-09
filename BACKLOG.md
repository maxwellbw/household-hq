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
| 006 | Calendar UI (home screen) | 🔍 in review | [specs/006-calendar-ui](specs/006-calendar-ui/spec.md) | PR open |
| 007 | Google Calendar sync | ⬜ not started | — | — |

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

**006 — Calendar UI (home screen)** (next in brief §10). Implemented; PR open, in review.
Tasks T001–T056 done (Vite + React + Schedule-X calendar, owner-tethered tasks, quick-add,
check-off, owner filter; build clean, 44/44 tests, `/impeccable audit` 17/20 with AA contrast +
modal focus-trap fixes applied). Remaining before merge: T057 live quickstart walkthrough (Google
sign-in — user-run) and the one-time GitHub Pages enablement + repo Variables
(`VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`) for the Actions deploy.

_005 merged in [#5](https://github.com/maxwellbw/household-hq/pull/5); backend deployed at `clasp` @10 (event-driven prep-template generation, nightly `generatePrepTasks` trigger installed alongside 004's `generateRecurringTasks`)._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, move "Currently active" to the next feature in brief §10.
