# Implementation Plan: Task & Event Details + Collaboration

**Branch**: `019-details-collaboration` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-details-collaboration/spec.md`

## Summary

Four capability slices on the existing Sheet-as-DB + Apps Script + React stack, no new
services and no new scopes:

- **Task notes** — add a `notes` column to Tasks; it flows through the existing
  create/update paths automatically once it is a known header. Render `http(s)://` URLs
  as tappable links via a new pure `linkify` helper shared by tasks and events.
- **Acknowledge / commit** — add server-managed `ackBy` + `ackAt` columns to Tasks and one
  new idempotent action `tasks.acknowledge`. A task assigned to the *other* single person
  reads "not yet committed" (derived client-side from `owner`/`status`/`ackBy`) until that
  person taps **I've got it**. Acknowledgement fires a best-effort ntfy ping to the assigner
  (reusing 009) and surfaces a dismissible dashboard notice (derived from task fields +
  a per-device localStorage dismissal, mirroring 018's UI-hint pattern).
- **Event notes editing** — Events already store & display `notes`; wire it into event
  create + `EventEditSheet` and re-render display through the shared `linkify`.
- **Event location** — add a `location` column to Events, wire it into create/edit/detail,
  and map it onto the mirrored calendar event via `CalendarEvent.setLocation()` in the
  existing one-way sync (007), which already updates entries in place idempotently.

The schema grows by four columns total (`Tasks.notes`, `Tasks.ackBy`, `Tasks.ackAt`,
`Events.location`); all land via the existing idempotent `setupDatabase()`/`migrateHeaders_`
migration, run once from the Apps Script editor after `clasp push`.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (frontend, Vite); Google Apps Script V8
(ES2015+, no npm) (backend).

**Primary Dependencies**: Frontend — React, @tanstack/react-query, Tailwind, shadcn/ui,
vitest + Testing Library. Backend — none (dependency-free Apps Script; `CalendarApp`,
`UrlFetchApp`, `SpreadsheetApp`, `LockService`).

**Storage**: One Google Sheet. Tabs touched: **Tasks** (+`notes`, +`ackBy`, +`ackAt`),
**Events** (+`location`), **ActivityLog** (new `acknowledge` action rows). No new tab.
Per-device UI dismissal of the ack notice lives in `localStorage` (not household data).

**Testing**: `vitest` (frontend unit/component); `SelfTest.js` `selfTest()` from the Apps
Script editor + `quickstart.md` live pass (backend).

**Target Platform**: Installable PWA (GitHub Pages) on mobile + desktop; Apps Script web
app backend.

**Project Type**: Web application (existing `/frontend` + `/backend`).

**Performance Goals**: Human-scale — a two-person household. Notes/link rendering and the
ack derivation are O(n) over the already-loaded task list; no new network round-trips on
render. Acknowledgement is one POST plus a best-effort ntfy call.

**Constraints**: Apps Script 6-min/run, read-whole-tab-write-batch, `LockService` on
writes, plain-text ISO strings, household timezone from Settings. Free-tier only; no new
OAuth scope (calendar + external_request already granted). WCAG 2.1 AA on all new UI.

**Scale/Scope**: Two users forever. ~4 new/changed backend functions, ~1 new backend
action, ~4 new columns; ~1 new frontend lib (`linkify`) + 1 new mutation hook + 1 new
dashboard notice component + edits to 6 existing components and the two payload builders.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Two Users Forever** | ✅ Acknowledgement is defined purely in terms of "the other single person" via the existing `otherPerson_`; owner stays `max`/`jaz`/`both`. No roles, no assignee table, no "assignedBy" field — the assigner is the non-owner by the two-person invariant. |
| **II. The Sheet Is the Source of Truth** | ✅ New columns are plain text (`notes`, `location`), plus `ackBy` (`max`/`jaz`) and `ackAt` (ISO datetime) — all human-readable and hand-editable. Acknowledgement state lives in the Sheet; only the ephemeral "I dismissed this notice" flag lives in `localStorage`, which cannot drift from or contradict household data (it is UI state, matching 018's precedent). |
| **III. Free-Tier Only** | ✅ No new services. ntfy (009) and Calendar (007) are reused; no new scope. |
| **IV. Boring and Debuggable** | ✅ Straight-line additions: columns flow through existing `fullRecord_`/`mutablePatch_`; one small pure `linkify` helper; one new action modeled exactly on `snoozeTask_`/`pingCompletion_`. |
| **V. Idempotent Generation** | ✅ `tasks.acknowledge` is a no-change replay if already acknowledged (mirrors `setTaskLifecycle_`); the ntfy ping is best-effort and never throws; location sync rides the existing idempotent reconciler (update-in-place, no duplication). |
| **VI. Every State Change Is Logged** | ✅ Note/location edits log `update` via the existing update path; acknowledgement logs a new `acknowledge` action; the ack-reset-on-reassignment rides the same `update` row. |
| **VII. Spec-Driven Development** | ✅ Spec + clarify done; this plan precedes tasks/implement on its own branch. |

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/019-details-collaboration/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (linkify rule, ack model, notice storage, location sync)
├── data-model.md        # Phase 1 — schema deltas + acknowledgement lifecycle
├── quickstart.md        # Phase 1 — live validation scenarios A–H
├── contracts/
│   └── api.md           # Phase 1 — tasks.acknowledge + updated create/update field lists
└── checklists/
    └── requirements.md  # Spec quality checklist (from /speckit.specify)
```

### Source Code (repository root)

```text
backend/
├── Config.js            # HEADERS: +Tasks.notes/ackBy/ackAt, +Events.location; ACTION_VERBS.acknowledge; isWriteAction_ regex
├── Api.js               # tasks.acknowledge handler; createTask_/updateTask_ guard ack fields + reset on reassign
├── Ntfy.js              # pingAcknowledge_ (assigner ← "X has it"), reuses postToNtfy_/ntfyTopicFor_
├── Sheets.js            # setTaskAcknowledge_ (locked, idempotent, logs 'acknowledge')
├── CalendarSync.js      # syncCalendarForEvent_: setLocation() on create + update (incl. clear)
├── Setup.js             # (unchanged) migrateHeaders_ already lands the new columns
└── SelfTest.js          # new cases: acknowledge lifecycle, ack reset on reassign, location→gcal mapping

frontend/src/
├── types/domain.ts              # Task +notes/ackBy/ackAt; Event +location
├── lib/
│   ├── linkify.ts               # NEW pure splitter: text → segments (text | http(s) link)
│   ├── linkify.test.ts          # NEW
│   ├── tasks.ts                 # NEW helpers: isUncommitted(task, viewer), canAcknowledge(task, viewer)
│   ├── quickAdd.ts              # NewEventInput +notes/location; NewOneTimeTaskInput +notes; builders pass them
│   ├── ackNotices.ts            # NEW: derive assigner notices from tasks + viewer
│   └── ackDismissals.ts         # NEW: localStorage read/write of dismissed notice keys
├── hooks/useMutations.ts        # useAcknowledgeTask (optimistic ackBy); useUpdateTask/Event payloads gain notes/location
├── components/
│   ├── ui/NotesText.tsx         # NEW: renders linkify segments (shared by task & event detail)
│   ├── task/TaskDetailSheet.tsx # notes display (NotesText) + edit; "not yet committed" + "I've got it"
│   ├── task/TaskEditSheet.tsx   # notes textarea
│   ├── task/TaskRow.tsx         # "not yet committed" badge + inline "I've got it" (assignee)
│   ├── event/EventDetailSheet.tsx # location display; notes via NotesText
│   ├── event/EventEditSheet.tsx # notes + location fields
│   ├── quickadd/QuickAddSheet.tsx # task notes; event notes + location
│   └── dashboard/
│       ├── DashboardHome.tsx    # render AckNotices at top
│       └── AckNotices.tsx       # NEW dismissible "X has it" notices
```

**Structure Decision**: Existing two-package web app (`/frontend`, `/backend`). No new
top-level structure; the feature is additive columns + one action + shared UI helpers.

## Phase 0 — Research

See [research.md](research.md). Resolves: the exact linkify rule (clarified: `http(s)://`
only) and its safe-render approach; the acknowledgement data model (server-managed
`ackBy`/`ackAt` on the Task row, assigner = non-owner, reset-on-reassign); where the
dismissible notice's dismissal lives (per-device `localStorage`, with rationale vs. a Sheet
column); and the calendar location-sync approach (`setLocation` on the existing reconciler,
including the clear case).

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — the four column additions with types/validation, the
  acknowledgement lifecycle table (open→committed, reassign→reset), and the derived
  "uncommitted"/"notice" predicates.
- [contracts/api.md](contracts/api.md) — the new `tasks.acknowledge` action envelope
  (request/response, idempotency, error codes) and the amended field lists for
  `tasks.create`/`tasks.update` (notes editable; ackBy/ackAt rejected) and
  `events.create`/`events.update` (notes + location editable).
- [quickstart.md](quickstart.md) — validation scenarios A–H covering migration, task notes
  + links, acknowledge round-trip (both channels), reassignment reset, event notes, event
  location + calendar mapping, and the hand-editable-Sheet regression check.

## Complexity Tracking

No constitution violations — table not required.
