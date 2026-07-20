# Tasks: Dog-Walk Planner Rework, Dashboard↔Calendar Parity & Household Notifications

**Input**: Design documents from `/specs/033-walk-planner-parity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: included (project convention — every feature ships Vitest coverage for new
selectors/components and backend selfTest suites; definition of done in CLAUDE.md).

**Organization**: grouped by user story; phases sequenced so each story lands as an
independently testable increment. Chunk labels (A–G) mark the intended
separate-context-window work packages (see "Implementation strategy").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1–US9 from spec.md

## Phase 1: Setup

- [x] T001 Verify baseline: `cd frontend && npm test && npm run build` green on branch `033-walk-planner-parity` before any change (record test count in this file when done) — baseline: 64 test files, 575 tests passed; build clean (2026-07-19)

## Phase 2: Foundational (blocking US2–US6) — Chunk D starts here

**Purpose**: deep-link plumbing + app-level planner hosting that notifications (US2/US3
tap-through), walk parity (US4), planner rework (US5), and notices (US6) all sit on.

- [x] T002 Generalize `frontend/src/lib/deeplink.ts` from `onTaskId` to the `DeepLink` union (`task` | `walk` | `overdue`) per contracts/deeplink-urls.md — parse + strip `?task=`, `?walk=<YYYY-MM-DD>` (validate date shape), `?overdue=1`; update `frontend/src/lib/deeplink.test.ts` (create if absent) covering all three params, invalid walk date, param stripping, warm postMessage path
- [x] T003 New hook `frontend/src/hooks/useSheetHistory.ts` (+ `useSheetHistory.test.ts`): on open push `{hqSheet:'planner'}` history state, close on `popstate`, guard the cold-start-deep-link case (closing via ✕ calls `history.back()` only when our state is on top) — research R4, FR-013
- [x] T004 Lift planner hosting to `frontend/src/App.tsx`: `walkPlannerDate` state + `openWalkPlanner(dateKey)`; render `DogWalkPlanner` at App level (timezone from `useSettings`); route deep links — task → Tasks tab (unchanged), walk → `openWalkPlanner`, overdue → Home; remove `DashboardHome`'s local `plannerDateKey` and pass `onOpenWalkPlanner` down (also thread to Calendar via props); wire `useSheetHistory` into the App-level planner
- [x] T005 Fix F-04 in `frontend/src/App.tsx` + `frontend/src/components/calendar/CalendarHome.tsx`: replace the racy clear-on-tab-switch effect with the consume-on-mount callback pattern (`focusDate` + `onConsumedFocusDate`, mirroring MoreView's `onConsumedInitialSubscreen`); CalendarHome calls it from its mount effect after seeding `selectedDate`
- [x] T006 Tests for T004/T005 in `frontend/src/components/calendar/CalendarHome.test.tsx` + `frontend/src/components/dashboard/DashboardHome.test.tsx` + App-level deep-link test: future-date deep link lands on that date with lazy mount simulated; `?walk=` opens planner; 029's DOM-identity regression still green

**Checkpoint**: deep links land correctly; planner opens from App level; nothing else changed.

---

## Phase 3: US1 — Complete a task from the dashboard (P1) — Chunk A

**Goal**: mark done/reopen from the day card and from the tapped-open detail sheet.
**Independent test**: quickstart §A.

- [x] T007 [P] [US1] Add Mark done / Reopen action to `frontend/src/components/task/TaskDetailSheet.tsx` using existing `useCompleteTask`/`useReopenTask` (prominent primary action; done state shows Reopen; optimistic, toast on failure — FR-002/003)
- [x] T008 [P] [US1] Add the `TaskRow`-style complete toggle to task rows in `frontend/src/components/dashboard/DayPeekPanel.tsx` (`PeekTaskRow`: leading toggle button separate from the open-detail tap target; events/walks get no toggle — FR-001, edge case "events aren't completable")
- [x] T009 [US1] Tests: `TaskDetailSheet.test.tsx` (done + reopen actions call the right mutations, a11y labels) and `DayPeekPanel.test.tsx` (toggle completes without opening the sheet; row tap still opens detail; no toggle on event/walk rows) — 584 tests passing (was 575; +9 new)

**Checkpoint**: US1 shippable alone (SC-001).

---

## Phase 4: US2 — Morning overdue push (P1) — Chunk C starts here (backend)

**Goal**: one idempotent morning push to both people listing overdue items.
**Independent test**: quickstart §B 1–3, 5–6.

- [x] T010 [US2] Create `backend/Notify.js`: `sendMorningOverduePush()` per contracts/notify-triggers.md — overdue selector mirroring `lib/dashboard.ts` (open + dueDate < today, household tz; comment cross-references the frontend file), body `"N overdue: t1, t2, t3 +K more"`, empty→silent, ActivityLog `notify-overdue`/`<today>` dedupe under `LockService` (copy `Digests.sendOne_`'s check-log-send shape), fan-out via `sendPushToPerson_` to both people, url `?overdue=1`, tag `overdue-<date>`; include a send seam for tests (mirror digests' seam pattern)
- [x] T011 [US2] Add `morningOverduePushHour` (default 8) + `eveningWalkPushHour` (default 20) to `backend/Config.js` settings defaults and `EDITABLE_SETTINGS`; `installNotifyTriggers()` in `backend/Notify.js` (idempotent delete-then-create, both daily triggers); extend `Api.js`'s `settings.update` reinstall hook to cover the two new keys (digestHour precedent)
- [x] T012 [US2] Settings screen fields for the two hours in `frontend/src/components/more/` settings editor (follow 020's field pattern + `frontend/src/lib/settings.ts` types) + test update

## Phase 5: US3 — Night-before walk push (P1) — Chunk C continued

**Goal**: evening push with tomorrow's walk window or decision prompt.
**Independent test**: quickstart §B 4–6.

- [x] T013 [US3] `sendEveningWalkPush()` in `backend/Notify.js` per the contract: tomorrow's DogWalks rows — booked/suggested → window(s) body (two walks joined with " and "), needs-decision → decision prompt, none → silent; dedupe `notify-walk`/`<tomorrow>`; url `?walk=<tomorrow>`, tag `walk-<tomorrow>`
- [x] T014 [US3] Switch `sendDogWalkPush_` in `backend/DogWalk.js` to url `?walk=<ymd>` (F-33 backend half; message text unchanged)
- [x] T015 [US2] [US3] `selfTestNotify()` suites in `backend/SelfTest.js` (public runner, wired per research R10 into a chunk that stays under the 6-min cap): gate (empty→no send/no log), dedupe (second run silent), content (truncation, +K more, both-windows join, needs-decision body, exact url params), public-entry-point exercise of both handlers; scratch rows use the `selftest-` prefix conventions
- [x] T016 [US2] [US3] Backend deploy + live validation per quickstart §B (clasp push, `clasp deploy -i`, `installNotifyTriggers`, forced runs, ActivityLog rows, re-run silence) — record results inline here

  **Results (2026-07-19, deployment `@32` on the stable `/exec` URL):**
  - `clasp push` — 22 files pushed clean. `clasp deploy -i AKfycbzQAE3g…` → `@32`.
  - `clasp run installNotifyTriggers` → completed with no thrown error (same "No response." signature as the pre-existing `installDigestTrigger`, confirmed by direct comparison — a thrown `AppError_`/`Error` prints an `Exception:` line instead, verified against `clasp run selfTest`'s guard throw). Two daily triggers installed at hours 8 / 20 (current Settings defaults). Recommend a quick glance at the Apps Script editor's Triggers panel next time it's open, to eyeball the two new rows (browser-only step).
  - `clasp run selfTestNotify` → completed clean (no thrown assertion). Also re-ran as part of `clasp run selfTest5Comms` (chunk 5: `unitDigests_`, `liveSettingsUpdate_`, `unitPush_`, `selfTestNotify`) — clean.
  - Live read-only check (`tasks.list`/`dogwalks.list` via the deployed endpoint with a dev session token): 0 real overdue tasks; tomorrow (2026-07-20) has a real booked walk, 8:00–8:30 AM.
  - `clasp run sendMorningOverduePush` (0 real overdue) → no new ActivityLog rows — confirms the empty-set silent gate live (quickstart §B.3).
  - `clasp run sendEveningWalkPush` (real booked walk tomorrow, run **with Max's explicit go-ahead** since it sends a real push to both devices) → ActivityLog gained one `notify-walk` row (`targetId=2026-07-20`, detail `"Dog walk tomorrow · 8:00–8:30 AM"`) plus two `push-notify` fan-out rows: `pushed Jaz (1/1 devices)` and `pushed Max (2/2 devices)`, both with that exact body — content matches the real booked window precisely. Re-running `sendEveningWalkPush` immediately after produced **zero** new ActivityLog rows (re-run silence confirmed, FR-006).
  - The "≥1 overdue → real push sent" content path (quickstart §B.2) was validated at the unit level only (`selfTestNotify`'s exact-string assertions on `buildOverdueBody_`), not with a live scratch task — avoided creating fake overdue data that would trigger a second unsolicited push to both devices in the same session.
  - `npm test` (frontend, full suite): 591/591 passed. `npm run build`: type-clean.

**Checkpoint**: notifications complete end-to-end (SC-002/003).

---

## Phase 6: US4 — Reach the planner from anywhere a walk appears (P1) — Chunk D continued

**Goal**: walks visible in all calendar views, every walk surface opens the planner.
**Independent test**: quickstart §C.

- [x] T017 [US4] Include walk items (booked 🐾 + needs-decision ⚠️) in the bespoke view buckets consumed by `frontend/src/components/calendar/DayListView.tsx` and `DayColumn.tsx` (extend the shared bucketing in `CalendarHome.tsx`/`lib/calendarItems.ts` — research R5), rendered with the seven-day-strip vocabulary, tappable → `onOpenWalkPlanner(date)`
- [x] T018 [US4] Make desktop month walk pills clickable in `frontend/src/components/calendar/CalendarHome.tsx` (`onEventClick` `dogwalk-`/`dogwalk-flag-` ids → `onOpenWalkPlanner`) and `EventContent.tsx` walk chips visually urgent for needs-decision (F-02)
- [x] T019 [US4] Today-card walk line check in `frontend/src/components/dashboard/DayPeekPanel.tsx`: booked shows window + booked state, needs-decision urgent → planner (FR-012 — largely exists via PeekWalkRow; verify styling/urgency and cover with a test)
- [x] T020 [US4] Tests: `DayListView.test.tsx`/`DayColumn.test.tsx` walk rows render + tap-through; `CalendarHome.test.tsx` walk chip click opens planner (mock), needs-decision urgency class; `DayPeekPanel.test.tsx` walk line states

**Checkpoint**: SC-004 met (with T002–T006 already in).

---

## Phase 7: US5 — Book with confidence and flexibility (P2) — Chunk E

**Goal**: visible selection, pinned confirm, 15-min starts, durations, backup slot,
compact timeline, human status copy — all in `frontend/src/components/dashboard/DogWalkPlanner.tsx` (+ its test file). Backend untouched.
**Independent test**: quickstart §D 1–5.

- [x] T021 [US5] Selected-hour visible state + confirm bar `sticky bottom-0` inside the sheet scroll container (F-06/FR-014); a11y: selection announced via `aria-pressed`/label update
- [x] T022 [US5] Start ±15-min steppers + duration segmented control seeded from the day plan's `primaryDurationsMin`/`secondDurationMin`; client pre-validation against busy blocks + hourly gates (disable Confirm with reason); booking payload uses adjusted `windowStart/windowEnd/durationMin` (F-07/FR-015)
- [x] T023 [US5] Backup-slot booking: offer "Book backup" wiring `slot:'backup'` when the day plan carries a backup candidate (F-07/FR-016)
- [x] T024 [US5] Compressed timeline: fully-ineligible hour stretches collapse to a compact band with expand affordance; eligible hours keep `PX_PER_MIN` (F-22/FR-017; band still ends 17:00)
- [x] T025 [US5] Status copy: `"Live forecast · updated N min ago"` / cached fallback with time (F-21/FR-018)
- [x] T026 [US5] Tests in `DogWalkPlanner.test.tsx`: selection state, sticky confirm presence without scroll assumptions, stepper bounds (band edge + busy overlap disables), duration options from payload, backup booking payload, compressed-band rendering, status copy variants

**Checkpoint**: SC-005 met.

---

## Phase 8: US6 — Calm, accurate walk alerts (P2) — Chunk F starts here

**Goal**: date-aware, tiered, collapsible notices opening the planner.
**Independent test**: quickstart §D 6.

- [x] T027 [US6] Extend `dogWalkNotices` in `frontend/src/lib/dogwalks.ts` with urgency tier (today/tomorrow = urgent) + update `frontend/src/lib/dogwalks.test.ts` (tiering, ordering) — added `tier`/`dayPhrase` fields ('today'/'tomorrow'/'on Thu'), precomputed in the selector so the component never re-derives "today" itself
- [x] T028 [US6] Rework `frontend/src/components/dashboard/DogWalkNotice.tsx`: date-aware reason copy (kill hardcoded "today" in `REASON_LABEL` — templates with formatted day), ≥2 quiet notices collapse to one summary row expanding in place, alarm styling only for urgent tier, action "Open planner" → `onOpenWalkPlanner` (FR-019/020; F-10) + tests (wrong-copy regression: a 5-days-out notice must not contain "today") — `REASON_LABEL` now maps to functions of `dayPhrase`; urgent notices always render standalone with the alarm border, quiet notices collapse to "N upcoming walks need a decision" (expand-in-place) once ≥2 exist; live-verified via dev session token (Home showed "Dog walk — Tue, Jul 28: No good-weather window on Tue" and "Open planner" opened the planner sheet for that date)

## Phase 9: US7 — Readable, honest calendar items (P2) — Chunk F continued

**Goal**: F-05, F-11, F-12, F-16. **Independent test**: quickstart §E 1–5.

- [x] T029 [P] [US7] Title-priority layout in `frontend/src/components/calendar/EventContent.tsx`: badge drops/wraps before the title truncates; min title characters guaranteed at 320px (F-05/FR-021, SC-006) + tests — badges (Task/Overdue/dogwalk time) get `shrink-[9999] overflow-hidden whitespace-nowrap` vs. the title's default shrink-1, so flexbox's multi-pass shrink resolution freezes the badge at 0 width before the title loses any room; also raised `DayColumn`'s column floor from `min-w-0` to `min-w-[110px]` (matching the spec's own reference width) since flex-1 across 7 week-view columns on a 320px viewport was shrinking columns to ~35px — narrower than even an owner-circle, which no title-priority CSS can rescue; the parent's existing `overflow-x-auto` now does the intended horizontal scroll instead. Live-verified at 320px: titles read correctly ("Physical...", "Mow l...", "Contact...") instead of collapsing to icon-only chips.
- [x] T030 [P] [US7] Owner-colored month-grid day dots (cap 3 + overflow) via `frontend/src/components/calendar/calendar-theme.css` + owner class plumbing on event payloads in `CalendarHome.tsx` (F-12/FR-022, both themes) — implemented as a new `MonthAgendaDateDots` Schedule-X custom component (one dot per *owner present that day*, matching SevenDayStrip's own convention exactly, rather than one-per-event): registered in `CalendarHome`'s stable `CUSTOM_COMPONENTS`, fed by a bumped `monthAgendaOptions.nEventIndicatorsPerDay` (20) so the dedup sees the true day. Capped at 3 is inherent to the 3-member `Owner` type — no overflow affordance needed (dead code was deliberately not written, per the "don't build for scenarios that can't happen" rule). Live-verified: day 20 (Max/Jaz/Both items) showed 3 correctly colored dots in the real mobile month-agenda view.
- [x] T031 [P] [US7] Done tasks collapse behind "N done ✓" in `frontend/src/components/calendar/DayListView.tsx` (expand on demand; a day of only-done items shows the affordance, not a struck-through wall) (F-16/FR-023) + tests — implemented in `DayColumn.tsx` (the file `DayListView.tsx` delegates per-day rendering to); 2-way toggle (`aria-expanded`), matching `ListItemRow`'s existing expand pattern. Live-verified: "1 done ✓" rendered on days with only completed tasks.
- [x] T032 [P] [US7] `frontend/src/components/event/EventDetailSheet.tsx`: location URL renders as "Open map ↗" labeled action; Delete visually separated from Edit (F-16/FR-024) + tests — reused `lib/linkify.ts` (already used by `NotesText`) to detect a URL location; Delete moved out of the header button cluster into its own bordered, full-width section below Prep (harder to mis-tap than adjacent 44px buttons). Live-verified: Delete renders in its own separated section with a trash icon.
- [x] T033 [US7] Calendar header single-switcher cleanup: suppress Schedule-X's "View"/"Date" header controls via the `calendar-theme.css` override layer (restyle-not-hide if a control proves irreplaceable — research R8), keep `CalendarViewSwitcher` as the one switcher (F-11/FR-025); verify 029's DOM-identity test still green — hid `.sx__date-input-wrapper` and `.sx__view-selection` (both irreplaceable-chrome-free: prev/next arrows, "Today" button, and the month-title heading are untouched and stay themed). 029's flash-regression test (`CalendarHome.test.tsx`) still green. Live-verified: header now shows only Today/‹/›/"July 2026" plus our own Month/Week/Next-7-days switcher — exactly one view control.

**Results**: `npm test` 665/665 passed (chunk E baseline was 591; +74 new tests across `dogwalks.test.ts`, `DogWalkNotice.test.tsx`, `EventContent.test.tsx`, `MonthAgendaDateDots.test.tsx` (new file), `CalendarHome.test.tsx`, `DayListView.test.tsx`, `EventDetailSheet.test.tsx`). `npm run build` type-clean. All live-verified in the running dev server via a `clasp run mintDevSessionToken` dev session token against real household data (2026-07-20).

## Phase 10: US8 — List pills show needed counts (P2) — Chunk B starts here

- [x] T034 [P] [US8] `neededCountByList(items)` selector in `frontend/src/lib/lists.ts` + `lists.test.ts` (needed-only, per-list, zero-absent)
- [x] T035 [US8] Render counts in list pills in `frontend/src/components/lists/ListsView.tsx` (hidden at zero, applies to new lists, live via cached `useListItems`) + `ListsView.test.tsx` (FR-026, SC-008)

## Phase 11: US9 — No focus zoom (P2) — Chunk B continued

- [x] T036 [US9] Fix `frontend/src/index.css`: de-duplicate the two identical `@media (pointer: coarse)` 16px blocks into one with `font-size: 16px !important` (research R1); confirm `frontend/index.html` viewport keeps pinch-zoom enabled (FR-027)
- [x] T037 [US9] Sweep all `<input>/<select>/<textarea>` for `text-sm`/`text-xs` utilities (Lists add-item/search/new-list-name are the known offenders; audit Quick Add, task/event edit sheets, Settings, planner) — remove dead size utilities where the 16px rule governs touch; note surviving desktop-only sizing inline; add a test or lint-style check if cheap (SC-007)
  — swept every `<input>/<select>/<textarea>` app-wide (11 files carrying `text-sm`/`text-xs`
    anywhere). Removed the class from the actual form controls that had it: `ListItemRow.tsx`
    (section select, note input), `ListsView.tsx` (list-name, add-item, search inputs),
    `SettingsView.tsx`'s shared `selectClass` (3 selects + the reminder-minutes input),
    `SnoozeDialog.tsx` and `ScheduleTaskDialog.tsx` date inputs. `RecurringManager.tsx`,
    `TemplatesManager.tsx`, `RecurringEventsManager.tsx`, `QuickAddSheet.tsx`,
    `TaskEditSheet.tsx`, `EventEditSheet.tsx` matched the file-level grep only via `text-sm`/
    `text-xs` on labels/buttons/error text, not on their form controls — nothing to remove
    there. No control anywhere kept an intentional desktop-only `text-sm`/`text-xs` size, so
    there's no surviving case to flag.

---

## Phase 12: Polish & cross-cutting — Chunk G

- [ ] T038 Full frontend gate: `npm test` (record final count vs T001 baseline) + `npm run build` type-clean
- [ ] T039 Backend gate: all selfTest chunk runners + `selfTestNotify` + `selfTestDogWalk` via `clasp run` (watch chunk 4's 5m31s headroom; move suites per research R10 if it overruns)
- [ ] T040 `/impeccable audit` on every changed surface (planner, notices, calendar views, day card, detail sheet, lists pills) — fix real findings, both themes (constitution: definition of done)
- [ ] T041 Live quickstart pass §A–§E in the deployed app (dev session token); §F device-gated items recorded as the standing follow-up; update BACKLOG.md stage + this file's checkboxes
- [ ] T042 Write back any implementation deviations into spec.md/plan.md/research.md (constitution VII)

## Dependencies

- Phase 2 (T002–T006) blocks US4 (T017–T020), US5 (T021–T026), US6 (T027–T028), and the tap-through halves of US2/US3 (frontend routing is in T004)
- US2 backend (T010–T012) blocks US3 (T013–T016) — same new file/patterns
- US1 (T007–T009), US8/US9 (T034–T037) are independent of everything
- US7 tasks T029–T032 are mutually parallel; T033 last in its phase (touches CalendarHome)
- Phase 12 last

## Implementation strategy — chunked for separate context windows

| Chunk | Tasks | Scope | Depends on |
|---|---|---|---|
| A | T001, T007–T009 | Dashboard task completion (US1) | — |
| B | T034–T037 | Lists pills + focus-zoom fix (US8, US9) | — |
| C | T010–T016 | Backend notifications + settings + selfTest + deploy (US2, US3) | — |
| D | T002–T006, T017–T020 | Deep-link plumbing, planner hosting, walk parity (US4 + foundation) | — |
| E | T021–T026 | Planner booking rework (US5) | D |
| F | T027–T033 | Notices + calendar readability (US6, US7) | D |
| G | T038–T042 | Gates, audit, live validation, write-backs | A–F |

MVP = Chunk A alone (US1) is already user-visible value; A+C+D covers every P1 story.
