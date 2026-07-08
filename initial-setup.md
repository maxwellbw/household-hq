# initial-setup.md — Household HQ

The full setup sequence, in order. Designed to be run **from inside Claude Code**: open your project folder in Claude Code and say *"work through initial-setup.md"* — it will execute every step tagged **[Claude]** and pause to hand you every step tagged **[You]** (browser logins, OAuth consents, and sharing can't be automated).

Legend: **[You]** = human required (browser/auth) · **[Claude]** = Claude Code runs it · **[Jaz]** = Jaz's parallel checklist

---

## Phase 0 — Bootstrap (before Claude Code can drive)

- [ ] **[You]** Install Node 24+ (Impeccable's CLI requires 24+): https://nodejs.org or `nvm install 24`
- [ ] **[You]** Install Claude Code and sign in: https://claude.com/claude-code
- [ ] **[You]** Create an empty local folder (e.g., `~/dev/household-hq`) and open it in Claude Code. Everything below happens from here.

## Phase 1 — Tooling installs

- [ ] **[Claude]** Verify/install prerequisites: `git --version`, `node --version` (≥24)
- [ ] **[Claude]** Install uv (Spec Kit CLI runner): `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS/Linux)
- [ ] **[Claude]** Install clasp: `npm install -g @google/clasp`
- [ ] **[Claude]** Install gh CLI (`brew install gh` on macOS, or platform equivalent)
- [ ] **[You]** `gh auth login` — follow the browser prompt (Claude runs the command; you complete the browser auth)

## Phase 2 — Repo

- [ ] **[Claude]** `git init` in the folder, then create the private repo: `gh repo create household-hq --private --source=. --push` (after first commit below)
- [ ] **[Claude]** Add project files at the right paths:
  - `CLAUDE.md` (repo root)
  - `DESIGN.md` (repo root)
  - `docs/household-hq-project-brief.md`
  - `initial-setup.md` (this file)
  - `.gitignore` (node_modules, dist, `.clasprc.json`, `.impeccable/` working files)
- [ ] **[Claude]** Initial commit + push
- [ ] **[You]** Add Jaz as a collaborator: repo → Settings → Collaborators → invite (or `gh api` — Claude can run it, but confirm her GitHub username first)

## Phase 3 — Spec Kit init

- [ ] **[Claude]** `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
- [ ] **[Claude]** From repo root: `specify init . --ai claude --force` (force: directory is non-empty)
- [ ] **[Claude]** Verify `.specify/` and `.claude/commands/` (the `/speckit.*` commands) exist; commit + push
- [ ] **[You]** Restart/reload Claude Code so the new slash commands register

## Phase 4 — Design tooling

- [ ] **[Claude]** `npx impeccable install`
- [ ] **[You + Claude]** Run `/impeccable init` in Claude Code — answer its questions; point it at `docs/household-hq-project-brief.md` and the existing `DESIGN.md` (register: **product**). Let it write/refine `PRODUCT.md`.
- [ ] **[Claude]** Commit + push

## Phase 5 — Spec writing (no Google setup needed yet)

- [x] **[You + Claude]** `/speckit.constitution` — feed it §7 (Constraints & Principles) of the brief; review the output together *(v1.0.0 ratified 2026-07-07)*
- [x] **[You + Claude]** `/speckit.specify` for feature **001 sheets-schema-and-api** using brief §4–5
- [x] **[You + Claude]** `/speckit.clarify` on 001 — resolve brief §8 open questions as they come up *(Q2 timezone: household TZ; Q3: one completion closes `both` tasks; Q4: seasonal recurrence fully supported in v1)*
- [x] **[You + Claude]** `/speckit.plan` on 001
- [x] Optional: spec features 002–003 ahead before implementing anything

## Phase 6 — Google architecture (required before implementing 001's backend)

- [ ] **[You]** Enable the Apps Script API for your Google account (one toggle): https://script.google.com/home/usersettings
- [x] **[You]** `clasp login` — Claude runs it; you complete the browser OAuth *(logged in as household@example.com 2026-07-07)*
- [x] **[Claude]** Create the standalone Apps Script project from the repo:
  `mkdir backend && cd backend && clasp create --type standalone --title "Household HQ Backend"`
  (creates the script project and local `.clasp.json`; commit the folder, never commit `~/.clasprc.json`) *(scriptId 1y0dfar1jgMKuXvzHPUpDqmh6szA8ga59lUVFwIaobFujbUo6rlmAyk7D; timeZone set to America/Los_Angeles; `clasp push` verified 2026-07-07)*
- [ ] **[You]** Create the Google Sheet **"Household HQ DB"** at https://sheets.new — copy the Sheet ID from the URL into `backend` config when feature 001 asks for it. Share with Jaz as **Editor**.
- [ ] **[You]** Share the Apps Script project with Jaz (open via `clasp open-script` → Share)
- [ ] **[You]** Create the shared **"Household"** Google Calendar (calendar.google.com → Other calendars → Create); share with Jaz with **"Make changes to events"**
- [ ] **[You]** This week, independent of setup: you and Jaz each find out whether your **work calendar** can share free/busy externally (personal Google account or a private ICS URL). This decides feature 011's implementation path.

## Phase 7 — Build loop (repeat per feature)

- [ ] **[Claude]** New branch per feature: `git checkout -b 001-sheets-schema-and-api`
- [ ] **[You + Claude]** `/speckit.tasks` → review → `/speckit.implement`
- [ ] **[Claude]** Backend deploys: `cd backend && clasp push && clasp deploy`
- [ ] **[You]** First deployment only: in the deploy dialog set **Execute as: User accessing the web app** and **Who has access: Anyone with a Google account** (the email allowlist does the real gating). You and Jaz each authorize the app once in the browser; re-authorize any time `appsscript.json` scopes change.
- [ ] **[Claude]** Frontend scaffold (during feature 006 or earlier if the plan calls for it): Vite + React + TS + Tailwind + shadcn/ui in `/frontend`; GitHub Actions workflow deploying `frontend/dist` to GitHub Pages on merge to main
- [ ] **[You]** Repo → Settings → Pages → Source: GitHub Actions (one-time toggle)
- [ ] **[Claude]** UI features get `/impeccable critique` while iterating and `/impeccable polish` + `/impeccable audit` before PR
- [ ] **[Claude]** PR per feature; merge to main deploys frontend automatically

## Jaz's parallel checklist (~5 min total)

- [ ] **[Jaz]** Accept GitHub collaborator invite
- [ ] **[Jaz]** Accept Sheet, Apps Script, and Calendar shares
- [ ] **[Jaz]** Enable Apps Script API on her account: https://script.google.com/home/usersettings
- [ ] **[Jaz]** Authorize the web app on first use (browser prompt)
- [ ] **[Jaz]** Later, only if she wants to push backend code herself: install Node + clasp, `clasp login`
- [ ] **[Jaz]** Phase 2 feature (ntfy pings): install the ntfy app and subscribe to her private topic (topic names get generated during feature 009)

## Done when

Constitution exists, feature 001 is specced/planned, the Sheet + Script + Calendar exist and are shared, `clasp push` works from `/backend`, and the repo has CLAUDE.md, DESIGN.md, PRODUCT.md, and `.specify/` committed. From there it's just the Phase 7 loop, feature by feature (order in brief §10).
