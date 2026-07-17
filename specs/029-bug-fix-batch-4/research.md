# Phase 0 Research — Bug-fix batch 4

Root cause + fix decision for each of the seven items. Investigated against the live codebase 2026-07-17. No open NEEDS CLARIFICATION.

---

## R1 — Walks in the Day Peek + times (US1, P1)

**Decision**: Pass the household's dog walks into `DayPeekPanel` and render a walk row per walk on the peeked day, showing its `windowStart–windowEnd` time; needs-decision walks get a warning treatment.

**Root cause / current state**: `DayPeekPanel` (`frontend/src/components/dashboard/DayPeekPanel.tsx`) renders only `events` and `tasks`; it has no walk concept. The dashboard already fetches walks via `useDogWalks()` (used by `CalendarHome`/7-day strip) and has selectors in `lib/dogwalks.ts` (`upcomingWalks`, `needsDecisionDays`). The Day Peek's membership currently comes from `itemsForDay()` in `lib/dashboard.ts`.

**Approach**: Add a small `walksForDay(walks, dateKey, timezone)` selector (in `lib/dogwalks.ts` or `lib/dashboard.ts`) returning that day's booked/suggested walks (and, if desired, needs-decision entries). Thread `useDogWalks().data` from the dashboard host down to `DayPeekPanel` and render a `PeekWalkRow` (🐾, owner-`both` dot, `windowStart–windowEnd` via existing `formatTime`, an "empty/needs-decision" affordance). Read-only — no booking from the peek (that is feature 031).

**Rationale**: Reuses existing walk data and time formatting; keeps the panel's "one selector drives counts and contents" invariant by extending the same day-membership logic.

**Alternatives considered**: Fold walks into `itemsForDay()` as a third list (rejected for now — walks aren't events/tasks and shouldn't inflate task/event counts elsewhere; a dedicated walk list keeps semantics clean).

---

## R2 — Done strikethrough everywhere (US2, P1)

**Decision**: Apply the existing `line-through text-ink-faint` done treatment to the two surfaces that lack it: `TaskDetailSheet` title and `EventContent` task chips.

**Root cause / current state audit**:
- `TaskRow.tsx:126` — ✅ already strikes done (`isDone ? 'text-ink-faint line-through' : …`).
- `DayPeekPanel.tsx:87` — ✅ already strikes done.
- `TaskDetailSheet.tsx:89` — ✗ title `<h2>` is always `text-ink`.
- `EventContent.tsx:95` — ✗ chip title always `text-ink`. Done standalone tasks with a `dueDate` do reach the calendar (`visibleStandaloneTasks` filters by owner + `dueDate`, not status), so a completed task shows an un-struck chip.
- `DayListView`/`DayColumn` render task chips via `EventContent`, so fixing `EventContent` covers the day/week/next-7 list views too.

**Approach**: In `EventContent`, when `_kind === 'task'` and the raw task `status === 'done'`, add `line-through text-ink-faint` to the title span (and optionally soften the chip). In `TaskDetailSheet`, conditionally strike the `<h2>` when `task.status === 'done'`. No behavior change for open/snoozed.

**Rationale**: Mirrors the already-shipped `TaskRow`/`DayPeek` pattern; purely presentational.

**Alternatives considered**: Excluding done tasks from the calendar entirely (rejected — a done task on its due day is still useful context; the ask is to *mark* it done, not hide it).

---

## R3 — Dismissed notices reappear on refetch (US3, P2)

**Decision**: Make both dashboard notices evaluate the **persisted** dismissal state (`isDismissed(key)`) on every render, merged with the in-memory session set. Keys must stay stable for an unchanged underlying item.

**Root cause**:
- `AckNotices` path is robust: `lib/ackNotices.ts` filters with `isDismissed(notice.key)` in the selector, so dismissal survives reload *and* refetch. (Its component-level `dismissedThisSession` is just an immediate-hide optimization.)
- `DogWalkNotice` path is **broken**: the component filters only against `dismissedThisSession` (a `useState(new Set())`) and **never** calls the `isDismissed()` it imports siblings of. `dismiss(key)` writes to `localStorage` but nothing reads it back. In-memory session state is lost whenever the component unmounts/remounts — which happens on a refetch that transiently empties `days` (the component `return null`s when `visible.length === 0`), and on reload. Result: a dismissed dog-walk notice pops back.

**Approach**: Either (preferred, symmetric with Ack) add a `dogWalkNotices(walks, timezone)` selector in `lib/dogwalks.ts` that maps needs-decision walks to `{key, …}` and filters by `isDismissed`, feeding `DogWalkNotice`; or, minimally, change `DogWalkNotice`'s filter to `!(isDismissed(key) || dismissedThisSession.has(key))`. Do the same defensive persisted-read in `AckNotices` for consistency. Keys already stable per unchanged item (`date:slot:reason`, `taskId:ackAt`).

**Rationale**: Persisted read on every render is the single source of truth and is inherently refetch/remount-proof; matches the pattern already proven for Ack.

**Alternatives considered**: Lifting dismissal state to a context/store (rejected — over-engineered for a per-device boolean; localStorage read is cheap and already the persistence layer).

---

## R4 — Scroll gets stuck after sheets/dialogs (US4, P2)

**Decision**: Add a **ref-counted body/main scroll lock** to the shared `useDialogA11y` hook: lock the scroll container when any sheet/dialog opens, and **guarantee restore** on cleanup, correct across nested sheets and rapid open/close.

**Root cause**: There is currently **no** scroll-lock anywhere (`useDialogA11y.ts` handles focus/Escape only; no code mutates `document.body`/`documentElement`/`overflow` dynamically — confirmed by grep). Sheets are bare `fixed inset-0` overlays. Two consequences: (a) the background `<main className="flex-1 overflow-y-auto …">` (AppShell) scrolls behind an open sheet — violating FR-006's "background must not scroll"; (b) the intermittent stuck-scroll Max reported (unrecoverable without reload) has no single culprit line to fix, so the robust remedy is to introduce a *correct* lock rather than patch a nonexistent one.

**Approach**: Add a module-level ref counter (or a tiny `useScrollLock` hook) invoked from `useDialogA11y`. On mount: increment; if going 0→1, record the scroll container's current state and set `overflow: hidden` (and, for iOS, guard against scroll position jump). On cleanup: decrement; if going 1→0, restore exactly the prior state. Ref-counting makes nested sheets safe (both must close before restore); cleanup-on-unmount guarantees restore even on rapid open/close or if a sheet unmounts abnormally. All sheets/dialogs already call `useDialogA11y`, so they inherit the fix; verify each does (`QuickAddSheet`, `TaskDetailSheet`, `TaskEditSheet`, `EventDetailSheet`, `EventEditSheet`, `SnoozeDialog`, `ConfirmDialog`, `ForceRankDialog`, `ScheduleTaskDialog`).

**Rationale**: A ref-counted lock with guaranteed cleanup is the standard, boring, debuggable fix and simultaneously satisfies "background must not scroll" and "scroll always restored."

**Alternatives considered**: Per-sheet local locks (rejected — nested sheets would fight over the single container's overflow); pulling in a library like `body-scroll-lock` (rejected — keep backend/frontend dep-light; the ref-counted hook is ~20 lines).

**Open detail for implementation**: confirm the lock target — the `<main>` scroll container vs. `document.body`. `AppShell` scrolls `<main>`, so lock that element (query by a stable selector/ref) or set `overflow:hidden` on it; verify on a phone-width preview.

---

## R5 — Prep-template picker on event create/edit (US5, P2)

**Decision**: Frontend-only. Add a prep-template `<select>` to the event create (`QuickAddSheet`) and edit (`EventEditSheet`) forms, populated from `useTemplates()`, sending the chosen `eventType` as `Event.templateId`.

**Root cause / current state**: The backend already fully supports this and is idempotent:
- `templates.list` action (`Api.js:112`).
- `Event.templateId` field (present in Sheet + `types/domain.ts:16,87`).
- `createEvent_` calls `syncPrepForEvent_(created, actor)` (`Api.js:337`) and `updateEvent_` calls it again on edit (`Api.js:354`) — reconciling prep tasks against the current `templateId`, keyed by `prepTaskId_(eventId, stepId)` so re-applying the same template never duplicates, and swapping templates removes not-yet-started prep and adds the new set (`PrepTasks.js:76`).
- Frontend already has a `useTemplates` hook (used by `TemplatesManager`).
The **only** gap: the event create/edit UI never surfaces `templateId`, so a one-off event can't pull in a saved checklist.

**Approach**: In `QuickAddSheet` (event branch) and `EventEditSheet`, add a labelled `<select>` of distinct `eventType` values from `useTemplates().data` (plus a "None" option), and include `templateId` in the `createEvent`/`updateEvent` mutation payload. Everything downstream (attach, idempotency, ActivityLog) is already handled server-side.

**Rationale**: Reuses complete, tested backend behavior; the change is a small additive form field on two forms.

**Alternatives considered**: A new "apply template" action/button post-create (rejected — redundant; `templateId` on the event already triggers `syncPrepForEvent_`).

---

## R6 — Dog-walk finder forecast fails under the trigger (US6, P3)

**Decision**: Make `fetchForecast_` resilient — retry a transient fetch failure with a small bounded backoff, and log the *distinct* failure mode — so trigger-driven runs obtain the forecast like manual runs do.

**Root cause**: `fetchForecast_` (`DogWalk.js:295`) returns a bare `null` for **every** failure mode — unset coords, non-200, malformed JSON, or a thrown exception (`catch (e) { return null; }`) — with no retry and no diagnostic logging. `runDogWalkFinder` (`DogWalk.js:680`) then logs the single ambiguous line `"forecast unavailable this run (fetch failed or coordinates unset); deferring all days."` and books nothing. Max confirmed: a **manual** `runDogWalkFinder()` succeeds, but the **installed nightly trigger** hits this line and defers everything — i.e. the `UrlFetchApp` call to Open-Meteo intermittently fails under the trigger's execution context, and the current code has no retry to ride over it and no logging to tell which mode failed.

**Approach**:
1. In `fetchForecast_`, wrap the `UrlFetchApp.fetch` in a small retry loop (e.g. up to 3 attempts with a short `Utilities.sleep` backoff) for transient failures (thrown exception or non-200), returning the parsed map on first success. Keep total time well under the 6-min cap.
2. Log the concrete failure mode distinctly: coords-unset (return early, log "coordinates unset") vs. non-200 (log the response code) vs. exception (log the message) vs. bad JSON — so the next incident is diagnosable from the execution log.
3. Preserve fail-closed semantics: if the forecast is *genuinely* unavailable after retries, still defer that run (book nothing) — a later successful run fills the days idempotently (existing `resolveSlot_`/one-row-per-slot behavior).

**Rationale**: A bounded retry is the standard fix for flaky `UrlFetchApp` under triggers and is free-tier/quota-safe; better logging turns a silent defer into a diagnosable event. Installer and finder scheduling are unchanged (already idempotent — installer dedupes by handler).

**Alternatives considered**: Caching the last good forecast to reuse on a failed fetch (rejected for this batch — adds a stored-forecast concept and staleness questions; retry is simpler and addresses the observed transient failure). If retries still fail live, diagnose whether coords are actually unset in the trigger context and fix that root cause instead — acceptance is trigger-driven runs producing walks.

**Validation note**: Exercisable from `clasp run` — `selfTestDogWalk` can add a case where the forecast fetch fails on the first attempt and succeeds on retry (inject via a seam) asserting the run still books; live confirmation by watching the next nightly trigger's execution log (should now book, or log a specific reason).

---

## R7 — Calendar flashes / fully re-renders on refetch (US7, P3)

**Decision**: Stop the full Schedule-X re-render on background refetch — keep the calendar app instance stable and only push events when the event set actually changed — confirmed by live reproduction in the browser preview.

**Root cause (characterized; exact line pinned live)**: `CalendarHome` (`frontend/src/components/calendar/CalendarHome.tsx`) re-renders on **every** background refetch because it reads `dataUpdatedAt` (the "Last synced" line, lines 63/269) which bumps on every refetch even when data is unchanged. On that re-render it (a) re-invokes `useCalendarApp({...})` with a fresh inline config object literal (lines 148–187), and (b) runs the `useEffect` that calls `calendarApp.events.set(scheduleXEvents)` (lines 192–195). React Query v5 structural sharing *should* keep `eventsQuery.data`/`tasksQuery.data` referentially stable when a refetch returns deep-equal data, which would keep `scheduleXEvents` stable and no-op the effect — so the visible flash points at the calendar app being re-seeded/re-instantiated on the re-render regardless. The precise mechanism (config-driven re-instantiation vs. `events.set` replacing the whole collection vs. structural sharing not holding for these shapes) is best confirmed by reproducing in-browser.

**Approach** (apply the minimal subset that removes the flash, verified live):
1. Ensure `useCalendarApp` gets a **stable** app — build it once (the hook seeds initial state; avoid handing it a churning config that triggers re-instantiation). Keep the existing `events.set` effect as the update path.
2. Gate the `events.set(scheduleXEvents)` effect behind an **actual content-change signature** (e.g. a memoized stable key of ids+times+owner+status), so an unchanged refetch does not replace the Schedule-X collection and re-render all chips.
3. Confirm React Query structural sharing is in effect for `useEvents`/`useTasks`/`useDogWalks` (default in v5) so deep-equal refetches keep `.data` stable; if a query maps data post-fetch and breaks referential stability, memoize it.
4. Consider decoupling the "Last synced" timestamp so it doesn't force a heavy calendar re-render (e.g. isolate it, or accept the cheap text re-render while the calendar subtree stays memoized).

**Rationale**: The flash is a re-render/re-seed problem, not a data problem; stabilizing the app instance + gating updates on real change is the boring, targeted fix. Live reproduction (now possible via the dev-session token) prevents a speculative change.

**Alternatives considered**: Disabling `refetchOnWindowFocus` (rejected — refetch-on-focus is desirable freshness; the fix should make refetch cheap, not remove it). Bumping `staleTime` very high (rejected — masks rather than fixes, and hurts freshness).
