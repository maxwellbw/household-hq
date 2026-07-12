---
description: "Task list for feature 020 — Settings Editor under More"
---

# Tasks: Settings Editor under More

**Input**: Design documents from `/specs/020-settings-editor/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/settings-update.md](contracts/settings-update.md),
[quickstart.md](quickstart.md)

**Tests**: Included — this repo's Definition of Done requires `selfTest()` green and
`npm run build`/tests passing. Tests are proportionate (validation + whitelist + logging on
the backend; hook + form behavior on the frontend), not TDD-strict.

**Organization**: Grouped by the three user stories. US1 (digest schedule) is P1 and is the
MVP; US2 (pings + reminder minutes) is P2; US3 (timezone) is P3. All three stories are served
by the **same** `settings.update` action and the **same** `SettingsView` form, so most of the
work is shared foundation (Phase 2); the per-story phases are thin slices that add/verify each
field group and its validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (digest schedule), US2 (pings + reminder), US3 (timezone)

---

## Phase 1: Setup (shared constants)

- [X] T001 Add `EDITABLE_SETTINGS` whitelist array (the eight editable keys) and
  `ACTION_VERBS['settings-update'] = 'updated settings'` to `backend/Config.js`.
- [X] T002 [P] Add curated timezone options + editable-settings field metadata (labels,
  control type, accepted values) and pure client-side validators in a new
  `frontend/src/lib/settings.ts`.

---

## Phase 2: Foundational (blocking — the shared action, handler, and form shell)

**⚠️ Everything in Phase 2 blocks all three user stories (they all flow through one action and
one form).**

### Backend — `settings.update` action

- [X] T003 Implement `updateSettings_(payload, actor)` in `backend/Api.js`: reject any payload
  key not in `EDITABLE_SETTINGS` (`BAD_REQUEST`, `field`=key); validate every provided value
  first (no partial writes); diff against `readSettingsMap_()` and `setSettingValue_` only the
  changed whitelisted keys inside the lock; append one `settings-update` ActivityLog row
  (`appendLog_(actor, 'settings-update', 'settings', <summary>)`); return
  `{ settings, changed, digestTriggerReinstalled }` per
  [contracts/settings-update.md](contracts/settings-update.md).
- [X] T004 Add per-key value validation used by T003 (hour 0–23; reminder minutes integer ≥ 0;
  weekly day ∈ Sunday…Saturday; monthly day `last` or 1–28; booleans `TRUE`/`FALSE`; timezone
  ∈ curated set) in `backend/Api.js` (or a small helper), aligned with the accepted formats in
  `resolveWeekday_`/`resolveMonthlyDay_`/`resolveHour_` (`backend/Digests.js`).
- [X] T005 In `updateSettings_`, when `digestHour` is among the changed keys, call
  `installDigestTrigger()` (`backend/Digests.js`) after the write and set
  `digestTriggerReinstalled: true`; let a failure propagate so the save reports an error
  (Edge Case "Digest hour vs. trigger", FR-010a).
- [X] T006 Register `'settings.update': function (p, actor) { return updateSettings_(p, actor) }`
  in the `HANDLERS` map in `backend/Api.js` (write-gated by the existing auth path).

### Frontend — data flow + form shell

- [X] T007 [P] Add `useUpdateSettings()` to `frontend/src/hooks/useSettings.ts`: a
  `useMutation` calling `authedCall('settings.update', payload)` that invalidates the
  `['settings']` query on success and surfaces errors via `handleAuthError`/toast.
- [X] T008 Create `frontend/src/components/more/SettingsView.tsx`: seed local form state from
  the existing `useSettings()` query (loading/error states), render the curated form skeleton
  (section headers + a single **Save** button wired to `useUpdateSettings`), show
  saving/success/error feedback, and only submit changed fields.
- [X] T009 Add a **Settings** row to the **Manage** section in
  `frontend/src/components/more/MoreView.tsx` and a `'settings'` subscreen (back header +
  `<SettingsView />`), mirroring the existing `recurring`/`templates` subscreen pattern.

**Checkpoint**: After Phase 2, the action exists and the Settings screen opens with a working
Save; per-story phases add and verify each field group.

---

## Phase 3: User Story 1 — Adjust digest schedule (Priority: P1) 🎯 MVP

**Goal**: Edit weekly on/off + day, monthly on/off + day, and digest hour; saving persists and
moves the digest trigger.

**Independent test**: Toggle weekly off, set monthly day `last`, set hour `8`, Save, reload →
values persist; Sheet unchanged elsewhere; `sendDigests` trigger now at hour 8; one activity
entry.

- [X] T010 [US1] Add the digest controls to `SettingsView.tsx`: weekly enabled toggle +
  weekday select; monthly enabled toggle + day select (`last` + 1–28); digest hour select
  (0–23). Day controls may disable (but still submit the retained value) when the digest is off
  (data-model cross-field rule).
- [X] T011 [P] [US1] Backend self-test in `backend/SelfTest.js`: `settings.update` with digest
  fields writes only those keys, rejects `digestHour=25` (`BAD_REQUEST`) with no write, and
  re-installs the digest trigger when the hour changes (assert `digestTriggerReinstalled`).
- [X] T012 [P] [US1] Frontend test `frontend/src/components/more/SettingsView.test.tsx`: seeds
  from settings, editing a digest field enables Save, Save calls the mutation with only changed
  keys, and success feedback shows.

---

## Phase 4: User Story 2 — Toggle pings + reminder minutes (Priority: P2)

**Goal**: Turn ntfy pings on/off and set the default calendar reminder lead time.

**Independent test**: Toggle pings off, set reminder minutes `15`, Save, reload → both persist;
completing a task sends no ping.

- [X] T013 [US2] Add the `ntfyEnabled` toggle and `gcalEventReminderMin` number input to
  `SettingsView.tsx` (non-negative integer, inline validation message on bad input).
- [X] T014 [P] [US2] Extend `backend/SelfTest.js`: `settings.update` rejects
  `gcalEventReminderMin=-5` (`BAD_REQUEST`, no write) and accepts a valid toggle+minutes change,
  logging exactly one row.

---

## Phase 5: User Story 3 — Change household timezone (Priority: P3)

**Goal**: Change the household timezone from a curated dropdown.

**Independent test**: Change timezone via dropdown, Save, reload → persists and date displays
reflect the new zone; only the six curated zones are offered.

- [X] T015 [US3] Add the timezone `<select>` (six curated US zones from `lib/settings.ts`) to
  `SettingsView.tsx`; no free-text entry.
- [X] T016 [P] [US3] Extend `backend/SelfTest.js`: `settings.update` accepts a curated timezone
  and rejects an off-list timezone string (`BAD_REQUEST`, field `timezone`, no write).

---

## Phase 6: Polish & cross-cutting

- [X] T017 [P] Add a non-whitelisted-key rejection self-test in `backend/SelfTest.js`
  (payload with `maxEmail` → `BAD_REQUEST`; the email row is unchanged) proving FR-013/SC-004.
- [ ] T018 [P] Run `/impeccable audit` on `SettingsView.tsx` (labels/`aria`, 44px targets,
  focus rings, owner-color neutrality, warm palette per DESIGN.md) and fix findings.
- [ ] T019 Verify `npm run build` (type-check) and the frontend test suite pass; `clasp push`
  + `clasp deploy` and run `selfTest()` in the Apps Script editor green.
- [ ] T020 Walk the [quickstart.md](quickstart.md) scenarios end-to-end on the live deployment
  (persistence across reload, Sheet non-interference, trigger hour moved, no-op save = empty
  `changed`).

---

## Dependencies & ordering

- **Phase 1 → Phase 2 → Phases 3–5 → Phase 6.** Phase 2 is the hard gate: the action (T003–T006)
  and the form shell (T007–T009) must exist before any story slice.
- **Shared-file coupling** — `SettingsView.tsx` is touched by T008, T010, T013, T015 and
  `backend/SelfTest.js` by T011, T014, T016, T017; those tasks on the **same file are not
  parallel with each other**. The `[P]` self-test tasks are marked parallel relative to the UI
  tasks (different files), but serialize among themselves.
- T004 supports T003; T005 depends on T003. T009 depends on T008. Story UI tasks (T010/T013/T015)
  depend on the T008 shell.
- Within a story, the `[P]` test tasks can run alongside that story's UI task.

## Parallel execution examples

- **Setup**: T002 (frontend `lib/settings.ts`) ∥ T001 (backend Config) — different files.
- **After Phase 2**: T011 (backend self-test) ∥ T012 (frontend test) while T010 (UI) proceeds.
- **Story tests**: T011, T014, T016, T017 each edit `SelfTest.js` → run **sequentially**, but
  each is parallel to the corresponding frontend UI work.

## Implementation strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1).** That delivers a working, persistent, logged
  Settings editor for the highest-value fields (digest schedule) with the trigger-reinstall
  behavior. US2 and US3 are additive field groups on the same form/action and can ship in the
  same PR (they're small) or immediately after.
- Build backend action first (T003–T006) so the form has a real endpoint; then the shell
  (T007–T009); then layer field groups per story.
