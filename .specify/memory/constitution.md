<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: n/a (initial ratification — all placeholders filled)
- Added sections:
  - Core Principles (I–VII, from project brief §7 Constraints & Principles)
  - Platform Constraints
  - Development Workflow
  - Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is generic and
    resolves against this file at plan time; no changes required.
  - ✅ .specify/templates/spec-template.md — no constitution-specific sections; compatible.
  - ✅ .specify/templates/tasks-template.md — no constitution-specific sections; compatible.
- Follow-up TODOs: none
-->

# Household HQ Constitution

## Core Principles

### I. Two Users Forever

The system serves exactly two users, Max and Jaz, authenticated against a two-email
allowlist stored in Settings. There MUST NOT be multi-tenant abstractions, role or
permission systems, user registration flows, or "scale" accommodations of any kind.
Every task and event has an owner drawn from exactly three values: `max`, `jaz`, or
`both`. Any change that introduces roles, tenancy, or generalization beyond two known
users is wrong by definition — simplify instead.

**Rationale**: This is a coordination tool for one household, not a product. Ruthless
optimization for two known users keeps the codebase small enough for its own users to
maintain.

### II. The Sheet Is the Source of Truth

One Google Sheet (tabs as tables: Events, Tasks, TaskTemplates, Recurring, ActivityLog,
Settings) is the single source of truth. It MUST remain human-readable and hand-editable
at all times: either user can open the raw Sheet, read it, and edit a cell without
breaking the app. Consequences:

- No opaque serialized blobs in cells; values are plain text, ISO 8601 dates, or simple
  delimited lists.
- The app MUST tolerate rows edited, reordered, or appended by hand.
- Row position is never an identifier; IDs are generated with `Utilities.getUuid()`.
- No secondary datastore, cache-as-truth, or shadow state that can drift from the Sheet.

**Rationale**: Human inspectability is the debugging story and the disaster-recovery
story. If the app dies, the household data survives as a legible spreadsheet.

### III. Free-Tier Only

The system runs entirely on free services: GitHub Pages (frontend hosting), Google Apps
Script (backend + triggers), Google Sheets (database), ntfy.sh (pings), Open-Meteo
(weather, keyless). No servers, no paid services, no API keys that bill. Sole exception:
the Claude API, in Phase 4 features only. A feature that cannot be built within free-tier
quotas MUST be redesigned or dropped, not upgraded around.

**Rationale**: Zero recurring cost means the system never gets turned off for budget
reasons and never depends on a billing relationship to keep working.

### IV. Boring and Debuggable

Prefer boring, well-trodden, debuggable solutions over clever ones. Both users MUST be
able to maintain every part of the system with Claude Code assistance. This means:

- No frameworks or dependencies beyond the decided stack without a constitution
  amendment.
- The Apps Script backend stays dependency-free (no bundlers, no npm).
- Straight-line code over abstraction layers; three similar lines beat one clever
  indirection.
- When two designs are equally capable, choose the one that is easier to inspect when it
  breaks.

**Rationale**: The maintainers are the users. Code either of them cannot follow with
assistance is a liability, not an asset.

### V. Idempotent Generation

All generated writes — recurring-chore materialization, template-driven prep tasks,
calendar sync, digests — MUST be idempotent: re-running any trigger never duplicates
rows, events, or notifications. Generators check for existing output (by stable ID or
natural key) before creating. Where concurrent writes are possible, writes are wrapped in
`LockService`.

**Rationale**: Time-driven triggers re-run, overlap, and fail mid-flight as a matter of
course in Apps Script. Idempotency is the only defense that requires no operator.

### VI. Every State Change Is Logged

Every state change — create, edit, complete, snooze, delete, whether initiated by a user
or a trigger — MUST append a row to ActivityLog recording timestamp, actor, action, and
targetId. No silent mutations. The log is append-only; it is never edited or pruned by
application code.

**Rationale**: Completion awareness ("Jaz already did that") is a core product feature,
and the log doubles as the audit trail when data looks wrong.

### VII. Spec-Driven Development

No feature code is written without a spec folder under `/specs/NNN-name/`. The chain per
feature is specify → clarify → plan → tasks → implement, each feature on its own branch,
merged by PR. Deviations discovered during implementation are written back into the spec,
never silently shipped. Feature order follows the project brief §10 unless Max explicitly
reorders.

**Rationale**: Spec Kit artifacts are the shared memory between two part-time maintainers
and their AI assistant; skipping them trades a day of speed for months of confusion.

## Platform Constraints

The stack is decided and is not re-litigated feature-by-feature (amend this constitution
to change it):

- **Database**: one Google Sheet, tabs as tables.
- **Backend**: standalone Google Apps Script web app (`doGet`/`doPost` serving JSON),
  synced to `/backend` with clasp; time-driven triggers for recurrence, sync, digests.
- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn/ui in `/frontend`, deployed
  to GitHub Pages, installable as a PWA.
- **Auth**: Google Identity Services ID token on every API call, verified against the
  two-email allowlist in Settings. No other auth concepts exist.
- **Dates**: all handling in the single household timezone from Settings (default
  `America/Los_Angeles`); ISO 8601 strings in the Sheet.
- **Apps Script realities**: 6-minute execution limit, `UrlFetchApp` for HTTP, V8
  runtime, no npm. Read a whole tab per request, operate in memory, write back in one
  batch.

## Development Workflow

- Every feature: spec folder, own branch, PR to `main`. Merge to `main` deploys the
  frontend; backend deploys are manual `clasp push && clasp deploy`.
- Definition of done per task: matches the spec; Sheet-writing functions idempotent and
  locked where concurrent; ActivityLog appended; dates in household timezone;
  `npm run build` passes with no type errors; new UI passes an `/impeccable audit`
  before PR; README or spec updated if behavior or setup changed.
- UI work follows `DESIGN.md` and `PRODUCT.md` (calm, warm, calendar-first; owner color
  coding is identity, never decoration; WCAG 2.1 AA).

## Governance

This constitution supersedes all other practices and documents; on any conflict, the
constitution wins. `CLAUDE.md` is the runtime bridge for day-to-day agent guidance and
must stay consistent with this file.

- **Amendments**: proposed as a PR touching this file, stating the change, rationale, and
  version bump; both users approve. Dependent templates and `CLAUDE.md` are updated in
  the same PR.
- **Versioning**: semantic. MAJOR for removing or redefining a principle, MINOR for
  adding a principle or materially expanding guidance, PATCH for clarifications and
  wording.
- **Compliance**: every plan passes the Constitution Check gate before research and again
  after design. Violations are either removed or justified in the plan's Complexity
  Tracking table; unjustified violations block the PR.

**Version**: 1.0.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
