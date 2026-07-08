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
| 004 | Recurring chore engine | 🚀 implemented, PR open | [specs/004-recurring-engine](specs/004-recurring-engine/spec.md) | [#4](https://github.com/maxwellbw/household-hq/pull/4) |
| 005 | Events and prep templates | ⬜ not started | — | — |
| 006 | Calendar UI (home screen) | ⬜ not started | — | — |
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

**004 — Recurring chore engine** (next in brief §10). Code implemented (12/12 tasks),
deployed to `@7`, `selfTest()` `ALL PASS`. PR [#4](https://github.com/maxwellbw/household-hq/pull/4)
open; ⏸ merging is Max/Jaz's call. Branch `004-recurring-engine`.

_003 merged in [#3](https://github.com/maxwellbw/household-hq/pull/3); 004 deployed at `clasp` @7._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, move "Currently active" to the next feature in brief §10.
