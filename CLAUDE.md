# CLAUDE.md — Household HQ

Read this at the start of every session. It is the bridge between Spec Kit's artifacts and day-to-day work.

## What this project is

A two-user (Max + Jaz) household manager: calendar-first UI, tasks assignable to `max` / `jaz` / `both`, recurring chores, event prep-checklist templates, email digests, Google Calendar sync, and (later) a weather-aware dog-walk window finder. Full context: `docs/household-hq-project-brief.md`. Guiding principles: `.specify/memory/constitution.md` — the constitution wins on any conflict.

## Stack (decided — do not re-litigate without updating the constitution)

- **Database:** one Google Sheet, tabs as tables (Events, Tasks, TaskTemplates, Recurring, ActivityLog, Settings). Must always remain human-readable and hand-editable without breaking the app.
- **Backend:** Google Apps Script standalone project in `/backend`, deployed as a web app serving JSON via `doGet`/`doPost`. Time-driven triggers handle recurrence materialization, calendar sync, and digests. Synced to this repo with `clasp`.
- **Frontend:** `/frontend` — Vite + React + TypeScript + Tailwind + shadcn/ui, deployed to GitHub Pages via GitHub Actions, installable as a PWA. Calendar component: FullCalendar or Schedule-X (whichever the 006 plan selects; record the decision there).
- **Auth:** Google Identity Services on the frontend → ID token sent with every API call → backend verifies and checks against the two-email allowlist in Settings. No other auth concepts exist.
- **External services:** Open-Meteo (weather, keyless), ntfy.sh (instant pings). Nothing paid, no servers.

## Repo layout

```
/frontend            Vite app
/backend             Apps Script source (clasp-managed; .clasp.json points at the script project)
/specs/NNN-name/     Spec Kit artifacts per feature (spec.md, plan.md, tasks.md, ...)
/docs/               Project brief and any supporting docs
/.specify/           Spec Kit config + memory/constitution.md
CLAUDE.md  DESIGN.md  PRODUCT.md
```

## Workflow — Spec-Driven Development (Spec Kit)

No feature code without a spec folder. The chain per feature:

1. `/speckit.specify` → `specs/NNN-name/spec.md` (what & why; no tech choices)
2. `/speckit.clarify` → resolve ambiguities before planning
3. `/speckit.plan` → plan.md (how, within the stack above)
4. `/speckit.tasks` → tasks.md (ordered, phased)
5. `/speckit.implement` → code, task by task

Each feature on its own branch, merged by PR. Feature order lives in the brief §10; don't skip ahead unless Max says so.

### Starting a feature — the "start feature NNN" shorthand

When the user says **"start feature NNN"** (optionally with the name), run the Phase 7 build loop autonomously, stopping only at the review gates below. Look up the name from `specs/NNN-*/` if it exists, else from brief §10. Do this without re-asking for the workflow:

1. `git checkout -b NNN-name` (branch off `main`).
2. **If `specs/NNN-*/` already has spec.md + plan.md** (features are often pre-specced): go straight to `/speckit.tasks`. **Otherwise** run `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` first, pausing after clarify's questions and after the plan.
3. Run `/speckit.tasks`, then **⏸ PAUSE** — present the task breakdown for review. Wait for the user's go-ahead ("implement" / "go").
4. Run `/speckit.implement`. Then `cd backend && clasp push && clasp deploy` (or `clasp deploy -i <deploymentId>` to refresh the existing web-app URL rather than mint a new one), and validate live per the feature's `quickstart.md`.
5. **⏸ PAUSE** — show validation results. On the user's go-ahead, commit + push + open the PR.
6. **⏸ PAUSE before merging** — merging is always the user's explicit call.

Prompt the user for the steps only they can do (browser OAuth on first deploy or after `appsscript.json` scope changes; the one-time Pages toggle in feature 006). "start feature NNN" with no other words is a complete instruction — infer everything else from here, the brief, and the spec folder.

## Commands you'll need

```bash
# Frontend
cd frontend && npm run dev          # local dev
npm run build                        # CI builds & deploys on merge to main

# Backend (Apps Script)
cd backend && clasp push             # upload local source to the script project
clasp deploy                         # create/refresh the web-app deployment
clasp pull                           # only if someone edited in the online editor (avoid this)
clasp open-script                    # open in browser for trigger setup / logs
```

The Apps Script web app must be deployed as **Execute as: user accessing the app**, access **Anyone with a Google account** (allowlist does the real gating). After changing scopes in `appsscript.json`, both users must re-authorize.

## Definition of done (per task)

- Matches the spec; deviations are written back into the spec, not silently shipped.
- Backend functions that write to the Sheet are **idempotent** (safe to re-run; triggers will re-run) and wrapped in `LockService` where concurrent writes are possible.
- Every state change appends to ActivityLog (timestamp, actor, action, targetId).
- All dates handled in the single household timezone from Settings (default `America/Los_Angeles`); store ISO 8601 strings in the Sheet.
- Frontend passes `npm run build` with no type errors; new UI passes an `/impeccable audit` before the PR.
- README or the relevant spec updated if behavior/setup changed.

## Gotchas & conventions

- **Sheets is the DB:** read a whole tab once per request (`getDataRange().getValues()`), operate in memory, write back in one batch. Never loop `getValue()` per cell.
- **IDs:** generate with `Utilities.getUuid()`; never rely on row position.
- **Apps Script quirks:** 6-min execution limit per run; `UrlFetchApp` for all HTTP; ES2015+ is fine (V8 runtime); no npm in Apps Script — keep backend dependency-free.
- **CORS:** Apps Script web apps don't send CORS headers for JSON POSTs from other origins; use `text/plain` content-type POSTs with JSON bodies (avoids preflight) or GET with parameters. Decide once in feature 001 and stick to it.
- **Never commit:** `.clasprc.json` (clasp credentials), Sheet/script IDs are fine to commit (repo is private) but keep them in one config file.
- **Two users forever.** If a change introduces roles, tenancy, or "scale," it's wrong — simplify.

## Design

All UI work follows `DESIGN.md` (Claude-app-inspired warm palette, calendar-first). Use the Impeccable skill: `/impeccable critique` while iterating, `/impeccable polish` before merging UI work.

### Design Context (from PRODUCT.md)

Register: **product**. Two users (Max, Jaz) only — coordination tool, not a general product. Personality: calm, warm, unfussy — "kitchen corkboard, not Jira board." Calendar is home; tasks tether visually to their events. Owner color coding (Max/Jaz/Both) is identity, never decoration. Accessibility target: WCAG 2.1 AA. Full detail: `PRODUCT.md`.
