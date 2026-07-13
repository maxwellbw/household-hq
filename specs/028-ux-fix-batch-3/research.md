# Research — 028 UX Fix Batch 3

All eight items were pre-clarified with Jaz (2026-07-13); this file resolves the *how*
questions against the actual codebase. No NEEDS CLARIFICATION markers remained in the
spec.

## R1 — Why the seeded birthdays are missing, and the per-cadence window

**Decision**: In `generateRecurringEvents()` (backend/RecurringEvents.js), compute the
window end **per rule**: annual-class cadences (`annually`, `thanksgiving-sat`) get a
366-day window (new Settings key `recurringEventsYearlyLookaheadDays`, default 366, new
Config fallback `RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS = 366`); every other
cadence keeps the existing `recurringEventsLookaheadDays` (60) window. No change to
`generateForEventRule_`'s signature beyond passing the right `windowEnd`; no change to
recurring **tasks** (Recurring.js, 30-day window).

**Rationale**: Root cause confirmed: `generateRecurringEvents()` uses one
`recurringEventsLookaheadDays` window (default 60, Config.js:178) for all rules, so
yearly occurrences more than ~60 days out simply haven't materialized — the seeded rows
are fine and the nightly trigger is installed (Jaz confirmed the full 027 follow-up ran).
Note the cadence value is **`annually`**, not "yearly" (Config.js `CADENCES`);
`thanksgiving-sat` is also annual-class and must not drift into the short window if an
event rule ever uses it.

**Idempotency**: free. Occurrence ids are deterministic
(`recurringEventOccurrenceId_(ruleId, date)`), `createRecord_` replays on existing id,
and the `lastGenerated` watermark only ever advances. Widening the window is safe on
re-run and on overlap with the nightly trigger. One subtlety: the watermark advances to
the furthest generated occurrence, so an annual rule's watermark may sit ~a year out —
harmless, since `occurrencesInWindow_` starts from the watermark and future runs extend
the window as today advances.

**Backfill**: no new code needed — run `generateRecurringEvents()` once from the editor
after deploy (quickstart §B).

**Google Calendar volume**: `syncCalendar()` mirrors with **no far cap** (only the
orphan-*sweep* scan is bounded, at 730 days — CalendarSync.js `ORPHAN_SWEEP_DAYS_AHEAD`),
so the ~13 extra all-day events mirror fine and stay inside the sweep bound.

**Alternatives rejected**: bumping `recurringEventsLookaheadDays` to 366 for everything
(floods weekly/monthly rules — up to ~52 occurrences each — into the app and the gcal
mirror); a per-rule override column (schema change for no expressed need).

## R2 — Optimistic creates: client-supplied UUIDs kill the temp-id problem

**Decision**: The frontend mints the record id (`crypto.randomUUID()`) and sends it in
the create payload. Optimistic cache insert uses that same id, so the optimistic row *is*
the real row — no temp-id reconciliation, and immediate follow-up edits target a valid
id even before the server confirms.

**Rationale**: Verified in the backend: `id` is a known header, so
`rejectUnknownFields_` accepts it on create, and `createRecord_` (Sheets.js) honors a
non-empty client id — with **idempotent replay** (an existing id returns the existing
row), so a retried create can never duplicate. This is existing 001-era behavior, not a
backend change; the API contract just starts exercising it. `crypto.randomUUID()` is
available in all target browsers (iOS 15.4+/modern Chrome) and matches the
`Utilities.getUuid()` format.

**Pattern**: extend the exact `onMutate`/`onError`/`onSettled` shape already used by
`useSetTaskStatus` (useMutations.ts:97–109) to `useCreateOneTimeTask`, `useCreateEvent`,
`useUpdateEvent`, and the task edit mutation: cancel queries, snapshot `previous`,
optimistically insert/patch `['tasks']` / `['events']`, revert + toast on error,
invalidate on settle. Sheets close on `mutate()` (not on `await`). Failure surfacing
reuses the existing toast mechanism (`useToast`).

**Scope**: tasks + events create/edit only (Quick Add's three modes minus recurring —
see below — plus `TaskEditSheet`/event edit). Recurring-rule creates (`recurring.create`
from Quick Add) stay awaited: they're low-frequency, and their visible effect (generated
occurrences) is server-computed so there's nothing honest to render optimistically.
Lists/templates/settings screens unchanged (spec assumption).

**Edge cases**: navigation away mid-flight — React Query mutations outlive unmount
(the QueryClientProvider holds them), and the idempotent id means even an app-close race
resolves to at-most-once creation; rapid double-edit — second `onMutate` snapshot chains
on the first's optimistic state, last write wins, matching server order.

## R3 — Mobile zoom lock: what iOS actually honors

**Decision**: Three layers: (1) viewport meta becomes
`width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`;
(2) global CSS `touch-action: manipulation` on interactive elements (kills double-tap
zoom); (3) form controls get 16px font-size on touch screens (a small `index.css` rule
targeting `input, select, textarea` under a `@media (pointer: coarse)` guard — visual
size elsewhere unchanged).

**Rationale**: iOS Safari **ignores** `user-scalable=no` for pinch (deliberate Apple
accessibility override) but **honors `maximum-scale=1` for input-focus auto-zoom** — and
focus auto-zoom is the complaint that actually bites (inputs are `text-sm` = 14px today,
under the 16px threshold). The 16px rule is belt-and-braces so focus zoom stays dead even
if the meta is ever loosened. Full pinch lock arrives for free in standalone PWA mode
(feature 010). System text-size (Dynamic Type / page zoom) is unaffected — spec FR-007's
accessibility carve-out holds.

**Alternatives rejected**: JS `touchmove`/`gesturestart` preventDefault hacks (fight the
browser, break scrolling, unmaintainable).

## R4 — Safe-area bottom nav

**Decision**: With `viewport-fit=cover` in place (R3), the mobile bottom nav
(AppShell.tsx:93, `fixed inset-x-0 bottom-0`) gets
`padding-bottom: env(safe-area-inset-bottom, 0px)` so the 44px-tall tab row sits above
the home indicator while the nav background runs to the physical edge. The three
dependent offsets move in lockstep: `<main>`'s `pb-16` clearance and the FAB's
`bottom-20` gain the same inset (`calc(...+ env(safe-area-inset-bottom))` via Tailwind
arbitrary values or two utility classes in index.css).

**Rationale**: `env()` resolves to `0px` on devices without an indicator, satisfying the
no-dead-space scenario with zero conditionals. Nothing else in the app is bottom-fixed
(verified: only the nav and the FAB).

## R5 — Inline day panel under the 7-day strip

**Decision**: New `DayPeekPanel` component in `components/dashboard/`, owned by
`DashboardHome` state (`peekDateKey: string | null`). Tile tap toggles/switches the
panel instead of calling `onOpenDate` directly; the panel renders that day's events +
tasks (reusing the existing selection logic and item presentation patterns from the
calendar's day list), an "Open in calendar" link that calls the existing
`onOpenDate(dateKey)` prop (unchanged wiring in App.tsx), and an explicit empty state.
Item taps open the same `TaskDetailSheet` / event detail sheet used everywhere.

**Rationale**: `DashboardHome` already receives `onOpenDate` and all data; the change is
contained to the dashboard. A new pure selector in `lib/dashboard.ts`
(`itemsForDay(tasks, events, dateKey, timezone)`) keeps the day-membership rules (event
span, task dueDate, snoozed inclusion per R6) unit-testable and shared with the strip's
counting so counts and panel contents can't disagree (spec SC-006).

**A11y**: tiles become `aria-expanded` toggles; the panel is a region labelled by the
day; focus is not stolen on open (panel appears below; tile keeps focus).

## R6 — Snoozed tasks on the strip

**Decision**: In `sevenDayTiles()` (lib/dashboard.ts:87) and the new `itemsForDay`
selector, the task filter becomes `(t.status === 'open' || t.status === 'snoozed') &&
t.dueDate` — everything else unchanged. No styling delta anywhere (clarified: identical
presentation).

**Rationale**: Snooze stores the wake date in `dueDate` (`tasks.snooze { id, dueDate }`),
so day placement needs no new data. The exclusion is currently deliberate (tested at
dashboard.test.ts:336) — those test expectations flip; the *other* dashboard suites
(smart views, load balance) keep excluding snoozed, per spec FR-010.

## R7 — Acknowledge UI redesign

**Decision**: Redesign the presentation in the three places it renders: `TaskRow` (the
card badge + inline "I've got it"), `TaskDetailSheet` (the ack block), and the
dashboard's `AckNotices`. Mechanics (`useAcknowledgeTask`, `ackBy/ackAt`, ntfy ping,
dismissible notice) untouched. Concrete direction, refined with `/impeccable critique`
during implement: the card-level treatment shrinks to a single quiet owner-colored
outline chip ("Not committed" state + tap-to-commit in one control) instead of today's
stacked badge-plus-button, with the full-width action preserved in the detail sheet;
44px touch floor and AA contrast are gates.

**Rationale**: Jaz chose "keep it, redesign it." The pain is presentational crowding on
phone-width cards; collapsing state+action into one control removes a whole row from the
card. Exact visual treatment is an implement-time design task under DESIGN.md — the
plan pins scope (three surfaces, zero mechanics changes) not pixels.

**Implementation addendum (deviations, `/impeccable critique` findings)**:
- The card-level chip is genuinely a single control only for the assignee (tappable,
  labelled "I've got it"); the assigner still sees a same-styled but non-interactive twin
  labelled "Not yet committed" — dropping it for the assigner would have removed the only
  signal they get that the task isn't committed yet, which no other surface provides.
- `TaskDetailSheet` no longer shows the small status badge when the viewer can act (the
  full-width button already states it) — only the assigner sees the badge there.
- Chip/button copy is action-oriented ("I've got it") rather than restating the state
  ("Not yet committed") as the tappable label, so the control never asks the user to tap a
  sentence describing the problem.

## R8 — Splitting selfTest under the 6-minute limit

**Decision**: Replace the `selfTest()` monolith with four public chunked runners, split
by dependency cluster and expected runtime (the Calendar suites make real Calendar API
calls and dominate wall-time):

- `selfTest1Core()` — unitValidators, unitAuth, unitSessionTokens, liveCrudRoundTrip,
  liveTaskSlices, liveActivityFeed, liveErrorCases, liveHandEditResilience,
  liveEventCrud, liveTemplateCrud, liveSnooze, liveTaskNotes, liveAcknowledge,
  liveTasksRank.
- `selfTest2Recurring()` — unitOccurrenceMath, unitThanksgivingAndOrdinals,
  liveRecurringGeneration, liveRecurringCrud, liveRecurringCatchUp,
  unitRecurringEventMath, liveRecurringEventGeneration, liveRecurringEventPrep,
  liveRecurringEventCrud, unitPrepMath, livePrepGeneration, livePrepLifecycle.
- `selfTest3SeedAndLists()` — unitSeedPack, liveSeedPack, unitAlternatingBins,
  liveSeedEventsAndTemplates, liveSeedTripTemplateOnEvent, liveListsCrud,
  liveListItemsCrud, liveSeedLists.
- `selfTest4CalendarAndComms()` — unitCalendarSync, liveCalendarEventSync,
  liveCalendarTaskSync, liveCalendarReconcile, liveCalendarLocationSync, unitDigests,
  liveSettingsUpdate, unitNtfy.

`selfTest()` itself becomes a thin guard that logs "suite exceeds the 6-minute limit —
run selfTest1Core() … selfTest4CalendarAndComms() in order" and throws, so nobody
silently trusts a partial run again. Each chunk ends with its own distinct
`Logger.log('SELFTEST n/4 (name): ALL PASS')`. `selfTestSeedPack()` and
`selfTestSessionTokens()` stay as-is. A coverage comment at the top of SelfTest.js lists
the four chunks' membership so "union == old monolith" is reviewable at a glance.

**Rationale**: The suite-call list is a flat sequence (SelfTest.js:12–56), so chunking is
a pure regrouping — zero changes inside any suite. Four chunks put the slow live-Calendar
block alone-ish in chunk 4 and target ≤~4 minutes each (spec assumption), with headroom
for growth. Names avoid the trailing-underscore trap (must be editor-runnable — CLAUDE.md
gotcha) and sort in run order in the editor's Run menu.

**Alternatives rejected**: a time-checking resumable runner persisting progress in
Script Properties (clever, stateful, violates Boring and Debuggable for zero benefit);
keeping `selfTest()` running chunk 1 only (silently misleading).

**Implementation addendum (deviation)**: the prose above lists chunk 3 as `unitSeedPack_,
liveSeedPack_, unitAlternatingBins_, liveSeedEventsAndTemplates_, ...` and puts
`liveCalendarLocationSync_` in the middle of chunk 4 — neither matches the actual monolith's
call order (`liveSeedEventsAndTemplates_` runs *before* the seed-pack trio;
`liveCalendarLocationSync_` runs last, after `unitNtfy_`). tasks.md T022 requires the four
chunks to preserve the monolith's *original relative order* within each chunk, which the
implementation does — only this file's prose ordering was inaccurate. Chunk *membership*
(which suite belongs to which chunk) is unchanged and matches exactly.
