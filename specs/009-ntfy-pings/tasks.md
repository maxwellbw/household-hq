---
description: "Task list for feature 009 — ntfy.sh completion pings"
---

# Tasks: ntfy.sh Completion Pings (ntfy-pings)

**Input**: Design documents from `/specs/009-ntfy-pings/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/ntfy-contract.md](contracts/ntfy-contract.md)

**Tests**: This project has no separate test suite; the convention (features 004–008) is
in-project `SelfTest.js` assertions on **pure** helpers, run via `selfTest()` in the Apps Script
editor. Test tasks below add `SelfTest.js` cases — they are part of the definition of done, not a
separate TDD suite, and never send a real POST.

**Organization**: Backend-only feature. Two user stories: US1 (the instant ping — MVP) and US2
(configurability + graceful degradation). Both live mostly in one new file, `backend/Ntfy.js`, so
US2 builds directly on US1 rather than being independently deployable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Apps Script backend lives in `/backend` (flat `.js` files, no `src/`). All paths below are
repo-relative. No frontend, no `tests/` directory.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one config surface the feature reads.

- [X] T001 Create the feature file `backend/Ntfy.js` with a top-of-file doc comment (mirroring
  `CalendarSync.js`/`Digests.js` — feature 009, what it does, best-effort/never-throws contract).
  Empty stubs are filled in later phases.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config constants, the new Settings seed key, and the log verb that every later task
depends on. **⚠️ Must complete before US1/US2 work.**

- [X] T002 In `backend/Config.js`, add the `NTFY_BASE_URL = 'https://ntfy.sh'` constant (near the
  other feature constants) and add `'ntfy-ping': 'sent a completion ping'` to the `ACTION_VERBS`
  map so the activity feed renders the new row (data-model.md, contract §6).
- [X] T003 In `backend/Config.js`, add `['ntfyEnabled', 'TRUE', 'feature 009; FALSE turns off
  completion pings']` to `SETTINGS_SEED` (the two topic keys `ntfyTopicMax`/`ntfyTopicJaz` are
  already seeded); bump `API_VERSION` (patch) for traceability.

**Checkpoint**: Config knows the base URL, the on/off default, and the log verb.

---

## Phase 3: User Story 1 - Instant "they did it" ping (Priority: P1) 🎯 MVP

**Goal**: Completing a task POSTs `"<Completer> completed: <title>"` to the *other* person's ntfy
topic; the completer is never pinged; a re-complete of an already-done task pings nothing; every
attempt is logged.

**Independent Test**: With both topics set and subscribed on phones, complete a task as Max →
Jaz's phone buzzes, Max's stays silent; the ActivityLog gains one `ntfy-ping` row. Re-sending
`complete` for the same task adds no row and no push (quickstart Scenarios A, B, C).

### Implementation for User Story 1

- [X] T004 [US1] In `backend/Ntfy.js`, implement the pure helpers: `otherPerson_(person)`
  (`max`↔`jaz`), `ntfyTopicFor_(recipient, settings)` (returns `ntfyTopicJaz` for Jaz,
  `ntfyTopicMax` for Max), and `buildPingMessage_(completer, title)` →
  `"<Completer> completed: <title>"`, with empty-title fallback (`"<Completer> completed a task"`)
  and long-title clamping (contract §3, data-model.md).
- [X] T005 [US1] In `backend/Ntfy.js`, implement `postToNtfy_(topic, message)`: `UrlFetchApp.fetch(
  NTFY_BASE_URL + '/' + encodeURIComponent(topic), { method: 'post', payload: message, headers:
  { Title: 'Household HQ', Tags: 'white_check_mark' }, muteHttpExceptions: true })`; return
  `{ ok: code>=200 && code<300, code }`. No auth header (contract §4, research D4).
- [X] T006 [US1] In `backend/Ntfy.js`, implement `pingCompletion_(task, completer)` happy path:
  read Settings, resolve recipient+topic, build message, call `postToNtfy_`, and append one
  `appendLog_('system', 'ntfy-ping', task.id, 'pinged <Recipient>: "<title>"')` on success. Wrap
  the whole body in `try { … } catch (e) { }` so it never throws (contract §1, §2). (Implemented
  in one pass together with the US2 gates T009/T010, since they're the same function body.)
- [X] T007 [US1] In `backend/Api.js`, add `pingCompletion_(result.task, actor)` inside
  `completeTask_`'s existing `if (result.changed)` block, right after `mirrorTaskToCalendar_(...)`
  (plan §"single hook point"). This is the only edit to existing logic and gives FR-008 (no
  duplicate on no-op) + reopen-then-complete-pings-again for free.
- [X] T008 [P] [US1] In `backend/SelfTest.js`, add assertions for the pure helpers from T004:
  `otherPerson_` both directions, `ntfyTopicFor_` picks the correct key for each recipient, and
  `buildPingMessage_` format + empty-title fallback + long-title clamp. (No POST issued.)

**Checkpoint**: A real completion pings the other person and logs it; re-completes are silent.

---

## Phase 4: User Story 2 - Configurable & degrades gracefully (Priority: P2)

**Goal**: `ntfyEnabled=FALSE` suppresses all pings; a blank recipient topic skips only that
person; an unreachable/erroring ntfy never blocks or fails the completion — and each of these
outcomes (skipped-disabled, skipped-blank, failed) is logged. Completion always succeeds.

**Independent Test**: Blank `ntfyTopicJaz` → Max completes → completion succeeds, no push to Jaz,
log shows `ntfy skipped (topic blank)`. Set `ntfyEnabled=FALSE` → completion succeeds, no push,
log shows `ntfy skipped (disabled)`. Point a topic at a failing endpoint → task still `done`, API
returns success, log shows `ntfy failed (HTTP <code>)` (quickstart Scenarios D, E, F).

### Implementation for User Story 2

- [X] T009 [US2] In `backend/Ntfy.js` `pingCompletion_`, add the ordered gates before sending
  (contract §2): if `ntfyEnabled` is falsey (reuse the project's `TRUE`/`FALSE` boolean-Settings
  parsing; blank → `TRUE`) → log `ntfy skipped (disabled)` and return; if the resolved topic is
  blank → log `ntfy skipped (topic blank)` and return. Neither path calls `UrlFetchApp` (FR-005,
  FR-006).
- [X] T010 [US2] In `backend/Ntfy.js` `pingCompletion_`, handle the send outcome: on a non-`ok`
  `postToNtfy_` result or a caught exception, append `ntfy failed (HTTP <code>)` /
  `ntfy failed (<error>)` and return normally — the completion is never affected (FR-007, FR-009,
  contract §2 step 6).
- [X] T011 [P] [US2] In `backend/SelfTest.js`, add cases proving `pingCompletion_` **returns
  without throwing and issues no POST** when (a) `ntfyEnabled=FALSE` and (b) the recipient topic
  is blank — verify by using Settings stubs whose blank/disabled state means the disabled/blank
  branches are taken (the paths that never reach `UrlFetchApp`), per the CLAUDE.md "exercise the
  entry point" rule.

**Checkpoint**: Both US1 and US2 behaviors verified by `selfTest()` ALL PASS; completion is
robust to every ntfy condition.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T012 Run `selfTest()` in the Apps Script editor and confirm **ALL PASS** (including the new
  T008/T011 cases). **Deferred post-merge at the user's direction (2026-07-09)** — run together
  with T014.
- [X] T013 Deploy: `cd backend && clasp push && clasp deploy -i <deploymentId>` (refresh the
  existing web-app URL), then run `setupDatabase()` once so `ntfyEnabled` is seeded. No new OAuth
  scope → no re-authorization needed. *(Pushed + redeployed as `@13`, same stable URL;
  `setupDatabase()` re-run pending with T012.)*
- [ ] T014 Execute [quickstart.md](quickstart.md) Scenarios A–F against the live deployment with
  real phone subscriptions, confirming pushes, silence-on-own-completion, no-duplicate, blank/off
  skips, and failure isolation; spot-check the `ntfy-ping` rows in ActivityLog. **Deferred
  post-merge at the user's direction (2026-07-09)** — needs topics chosen + phones subscribed.
- [X] T015 [P] Update [BACKLOG.md](../../BACKLOG.md) (stage → implemented/deployed) and note any
  spec deviations discovered during T014 back into `spec.md` (Principle VII — never ship a silent
  deviation). *(Deviation recorded: live validation deferred, tracked here and in BACKLOG.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 — create the file. No dependencies.
- **Foundational (Phase 2)**: T002–T003 depend on Setup. **Block US1/US2** (they need the base
  URL, the log verb, and the seed key).
- **US1 (Phase 3)**: depends on Foundational. The MVP slice.
- **US2 (Phase 4)**: depends on US1 — it extends the same `pingCompletion_` function with gates
  and failure handling; not independently deployable, but independently *testable*.
- **Polish (Phase 5)**: depends on US1 (+US2 for full validation).

### Within the feature (file-level ordering)

- T004 (pure helpers) → T005 (`postToNtfy_`) → T006 (`pingCompletion_` happy path) → T007
  (`Api.js` wiring). All four touch two files in sequence.
- T009/T010 modify the `pingCompletion_` body from T006, so they follow T006.
- T008 and T011 (`SelfTest.js`) are independent of each other only if edited carefully; both touch
  the same file, so treat as sequential unless splitting cleanly.

### Parallel Opportunities

- Limited — this is a small, tightly-coupled feature. T008 [P] can be written alongside the US1
  implementation (asserts helpers from T004). T015 [P] (docs) is independent of code once T014
  passes. Everything else is effectively sequential because it lives in `Ntfy.js`/`Api.js`.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001) + Phase 2 (T002–T003) → config ready.
2. Phase 3 (T004–T008) → completing a task pings the other person and logs it.
3. **STOP & VALIDATE**: quickstart Scenarios A–C. This alone is the shippable payoff (brief §10
   item 10).

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 → the instant ping (MVP) → validate → could deploy.
3. US2 → make it safe to leave on and hand-tunable → validate Scenarios D–F.
4. Polish → selfTest, deploy, live quickstart, BACKLOG/spec updates.

---

## Notes

- No frontend, no new HTTP API verb, no trigger, no new OAuth scope (`script.external_request`
  already granted).
- The one edit to existing logic is a single line in `completeTask_` (T007) — keep the notification
  concern out of the generic `setTaskLifecycle_` (which `reopen` also uses and must not ping).
- Best-effort is the whole contract: `pingCompletion_` must never throw and never affect the
  completion result; `muteHttpExceptions: true` + a top-level try/catch enforce it.
- Every ping attempt — sent, skipped, or failed — appends exactly one `ntfy-ping` ActivityLog row.
- Commit after each phase; stop at the US1 checkpoint to validate the MVP independently.
