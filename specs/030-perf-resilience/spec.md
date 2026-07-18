# Feature Specification: Perf & Resilience

**Feature Branch**: `030-perf-resilience`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Perf & resilience: batch data.bootstrap on the backend so the frontend's initial load is a single request instead of N; add code splitting to the frontend bundle; extend optimistic-save UI patterns to the remaining screens/actions that still block on network round-trips; add fetch timeout + retry to the frontend's API client; harden boot-restore (the app's initial state hydration) against partial/failed responses."

## Overview

Household HQ works, but it feels sluggish and brittle at the edges. Opening the app fires roughly ten separate backend round-trips before the first screen is fully populated, several screens still freeze on a spinner while a save round-trips, a stalled request can hang forever with no recovery, and a returning user whose restore hits a momentary hiccup gets bounced all the way back to the sign-in wall. This feature makes the app **feel fast** (fewer, smaller, faster round-trips) and **behave predictably under bad conditions** (weak connectivity, slow server, partial failures) — without changing what any screen does or how the Sheet is shaped. It is a polish/hardening pass, not new product surface.

## Clarifications

### Session 2026-07-17

- Q: What should the single bootstrap response contain on cold load? → A: Core datasets (events, tasks, recurring, recurring events, lists, list items, templates, settings, dog-walks); **defer the activity feed** — it's only shown in the More tab, so it loads on demand when More opens.
- Q: When boot-restore hits a transient failure, how should the app recover? → A: Auto-retry a small bounded number of times with brief backoff, then fall back to a recoverable screen with a manual "Retry" (auto-heal common blips, manual escape hatch for sustained outages).
- Q: How should list items come back in the bootstrap? → A: All lists' items at once in the one response, so the Lists tab is instant with zero extra requests.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App opens in one round-trip (Priority: P1)

When Max or Jaz opens the app, all the data the home dashboard and primary tabs need arrives together in a single backend request, so the app becomes usable quickly instead of filling in piecemeal as a dozen independent requests each complete.

**Why this priority**: This is the single largest and most-felt slowness. The backend serializes requests and each round-trip carries fixed overhead, so collapsing ~10 sequential loads into one call is the biggest perceived-speed win and everything else is secondary polish on top of it.

**Independent Test**: Open the app cold (signed-in, warm session) and observe that the initial data population issues one bootstrap request rather than one-per-dataset, and that the home dashboard and the calendar, tasks, and lists tabs render their real data from that single response. Fully deliverable and testable on its own.

**Acceptance Scenarios**:

1. **Given** a returning signed-in user opens the app, **When** the initial data loads, **Then** a single bootstrap request returns every dataset the primary views need (events, tasks, recurring rules, recurring events, lists, all lists' list items, templates, settings, and dog-walks), and no separate per-dataset load requests are issued for that first render. The recent activity feed is intentionally excluded — it loads on demand when the More tab opens.
2. **Given** the bootstrap response has arrived, **When** the user navigates between the home, calendar, tasks, and lists tabs, **Then** each tab shows its real data immediately with no additional load request for data that the bootstrap already delivered; opening the More tab loads the activity feed on demand (its only additional request).
3. **Given** the bootstrap response, **When** any individual dataset is compared against what the old per-dataset load returned, **Then** the shape and values are identical (same records, same fields) — the batching changes only how many requests carry the data, never the data itself.
4. **Given** a user performs a change (e.g. completes a task) after load, **When** the change settles, **Then** refresh/refetch of just the affected dataset still works as before — bootstrap is the initial-load fast path, not a replacement for targeted refetches.

---

### User Story 2 - A returning user isn't bounced to sign-in over a hiccup (Priority: P2)

When a returning user opens the app and the initial restore/bootstrap hits a transient problem (offline, slow server, a partial or malformed response), the app keeps them in a recoverable "still loading / couldn't load — retry" state rather than discarding their session and dropping them at the sign-in wall.

**Why this priority**: Today a momentary blip during restore silently sends a validly-signed-in user back to sign-in, which reads as "the app logged me out" and is the most jarring failure a two-person daily-use tool can have. High resilience value, independent of the speed work.

**Independent Test**: Simulate a transient failure during boot (server unreachable or a partial/garbled response) with a still-valid stored session, and confirm the app shows a recoverable retry state and successfully recovers when connectivity returns — without forcing a fresh Google sign-in.

**Acceptance Scenarios**:

1. **Given** a stored, still-valid session, **When** boot restore fails transiently (network/offline/server error or a partial/malformed response), **Then** the app shows a clearly recoverable state (not the sign-in wall) that preserves the session and offers a way to retry.
2. **Given** the app is auto-retrying or showing the manual "Retry" screen, **When** connectivity is restored and a retry (automatic or user-tapped) succeeds, **Then** restore + bootstrap complete and the user lands in the app fully signed in, with no Google re-authentication required.
3. **Given** a stored session that the server explicitly rejects as forbidden or genuinely expired, **When** boot restore runs, **Then** the app still routes to the correct terminal state (forbidden notice or sign-in wall) — hardening must not mask a real auth rejection as a transient blip.
4. **Given** the bootstrap response is partial (some datasets present, some missing or malformed), **When** the app hydrates, **Then** it does not crash or render a blank screen; it surfaces that loading did not fully complete and offers recovery rather than presenting a silently incomplete app as if it were whole.

---

### User Story 3 - Requests don't hang, and blips self-heal (Priority: P2)

Every backend call gives up after a bounded wait instead of hanging indefinitely, and idempotent read calls automatically retry a small number of times before surfacing an error — so a single dropped packet or momentary server stall recovers on its own instead of showing a failure.

**Why this priority**: A hung request with no timeout is an indefinitely-stuck UI; automatic retry of safe reads turns most transient blips into invisible non-events. Broadly protective across the whole app, but layered on top of the load and restore work.

**Independent Test**: Force a request to stall past the timeout and confirm the call aborts and reports a clear, retryable error rather than hanging; force an intermittent read failure and confirm it recovers automatically within the retry budget.

**Acceptance Scenarios**:

1. **Given** any backend call, **When** it does not respond within a bounded timeout, **Then** the call is aborted and reported as a timeout/network-style error the UI can present and retry, rather than hanging indefinitely.
2. **Given** an idempotent read call fails transiently (network error or timeout), **When** the failure occurs, **Then** the client automatically retries up to a small bounded number of times (with a brief backoff) before surfacing the error.
3. **Given** a call that changes data (create/update/delete/toggle/complete), **When** it fails transiently, **Then** automatic retry does **not** silently re-issue it in a way that could double-apply the change; recovery for writes follows the optimistic-save revert path (Story 4), preserving the "safe to re-run" idempotence the backend already guarantees.
4. **Given** a genuine, non-transient error (validation failure, forbidden, unknown action), **When** it occurs, **Then** it is surfaced immediately without wasting the retry budget.

---

### User Story 4 - The rest of the app saves instantly too (Priority: P3)

The screens and one-tap actions that still freeze on a spinner while a save round-trips instead update the screen immediately and reconcile in the background — matching the instant-save behavior tasks and events already have — with a visible revert and error if the save ultimately fails.

**Why this priority**: A meaningful comfort improvement that extends an already-established pattern (feature 028) to the screens it didn't reach. Valuable but narrower than the load/resilience wins, and each screen is an independent slice.

**Independent Test**: On each still-blocking screen/action (e.g. list create/delete, list-item add/edit, recurring-rule and recurring-event create/edit/delete, template edits, settings changes, and any remaining dog-walk action), perform the change and confirm the UI updates immediately, reconciles on success, and cleanly reverts with an error message on failure.

**Acceptance Scenarios**:

1. **Given** a screen/action that currently waits for the backend before updating, **When** the user makes a change, **Then** the change appears in all relevant views immediately, before the backend confirms.
2. **Given** an optimistic change, **When** the backend confirms, **Then** the real server values replace the optimistic ones with no visible flicker and no duplicate row.
3. **Given** an optimistic change, **When** the backend save fails, **Then** the change is reverted in all views and a clear error message is shown.
4. **Given** the existing optimistic actions from feature 028 (task complete/reopen/snooze, event create/edit, list-item toggle), **When** this feature ships, **Then** they continue to work unchanged — this story only fills the gaps, it does not regress what already works.

---

### User Story 5 - The app downloads less up front (Priority: P3)

The app is split so that a first visit downloads only what the initial view needs, and heavier or less-frequently-used parts load on demand — reducing the amount fetched and parsed before the app becomes interactive, especially on a phone on cellular.

**Why this priority**: Improves first-load weight and time-to-interactive, but the dominant load cost is backend round-trips (Story 1), so bundle splitting is a real-but-secondary gain and safely last.

**Independent Test**: Build the app and confirm it emits multiple chunks (an initial chunk plus on-demand chunks) rather than one monolithic bundle, that the initial view renders without downloading the on-demand chunks, and that navigating to a deferred area loads its chunk and works correctly.

**Acceptance Scenarios**:

1. **Given** a production build, **When** the bundle is inspected, **Then** it is split into an initial chunk plus one or more on-demand chunks rather than a single monolithic file.
2. **Given** a first visit, **When** the initial view renders, **Then** the on-demand chunks for deferred areas are not required for that first render.
3. **Given** a user navigates to a deferred area, **When** its chunk loads, **Then** the area appears (with a brief, graceful loading indicator if needed) and functions identically to before splitting.
4. **Given** a deferred chunk fails to load, **When** the user navigates to that area, **Then** the app surfaces a retryable error rather than crashing the whole app.

---

### Edge Cases

- **Very first sign-in (no household data yet):** bootstrap returns empty collections cleanly and the app renders its normal empty states, not an error.
- **Bootstrap partially succeeds:** some datasets present, others missing/malformed — the app must not crash or render a misleadingly-empty screen; it surfaces incompleteness and offers recovery (ties to Story 2 AS4).
- **Slow-but-eventually-successful response near the timeout boundary:** a response arriving just before the timeout must not be double-counted or dropped by the retry logic.
- **Retry storm avoidance:** repeated transient failures must exhaust a small bounded budget and then stop, never loop indefinitely or hammer the backend.
- **Bootstrap payload size:** batching the core datasets (including all lists' items at once) into one response must stay within the backend's per-request execution and response-size limits; if the full set ever approaches those limits, the design must degrade safely rather than fail the whole load. Deferring the activity feed keeps the largest ever-growing list out of the cold payload.
- **Write retried after it actually succeeded:** a create/update whose response was lost but whose write landed must not double-apply on recovery (leans on existing backend idempotence).
- **Deferred chunk requested while offline:** navigating to an on-demand area with no connectivity shows a retryable error, not a white screen.
- **Stale data after long background:** bootstrap is initial-load only; returning to a tab after a long time still relies on the normal per-dataset refresh, which must keep working.

## Requirements *(mandatory)*

### Functional Requirements

**Single-request bootstrap (Story 1)**

- **FR-001**: The backend MUST expose a single bootstrap operation that returns, in one response, every dataset the primary views need for initial render: events, tasks, recurring rules, recurring events, lists, all lists' list items, templates, settings, and dog-walks. The recent activity feed is excluded (it loads on demand when the More tab opens).
- **FR-002**: Each dataset within the bootstrap response MUST be identical in shape and content to what the corresponding per-dataset load returns today, so consumers need no per-dataset reshaping.
- **FR-003**: The bootstrap operation MUST be subject to the same identity/allowlist gating and per-actor scoping as the individual load operations it composes (no data is exposed to bootstrap that the per-dataset calls would not have exposed to that actor).
- **FR-004**: On initial load, the frontend MUST populate its primary views from the single bootstrap response and MUST NOT additionally fire the individual per-dataset load requests for that first render.
- **FR-005**: Targeted per-dataset refresh/refetch after a change MUST continue to work unchanged; bootstrap replaces only the initial fan-out, not ongoing refreshes.
- **FR-006**: The individual per-dataset load operations MUST remain available (bootstrap is additive), so refetch, error-recovery, and any non-initial code paths keep functioning.

**Boot-restore hardening (Story 2)**

- **FR-007**: When boot restore/bootstrap fails **transiently** (offline, network error, timeout, server error, or a partial/malformed response) with a still-valid stored session, the app MUST first auto-retry a small bounded number of times with brief backoff; if it still fails, it MUST present a recoverable screen with a manual "Retry" that preserves the session — it MUST NOT discard the session or route to the sign-in wall.
- **FR-008**: Recovery — whether via an automatic retry or the manual "Retry" — MUST land the user in the fully signed-in app once the underlying condition clears, with no Google re-authentication.
- **FR-009**: The app MUST still route to the correct terminal state for **genuine** auth outcomes: an explicitly forbidden identity to the forbidden notice, and a genuinely expired/invalid session to the sign-in wall. Hardening MUST NOT mask a real rejection as a transient blip.
- **FR-010**: A partial or malformed bootstrap response MUST NOT crash the app or silently render an incomplete app as if it were complete; the app MUST surface that loading did not fully complete and offer recovery.

**Fetch timeout + retry (Story 3)**

- **FR-011**: Every backend call MUST enforce a bounded timeout, after which the call is aborted and reported as a timeout/network-style error the UI can present and retry.
- **FR-012**: Idempotent read calls MUST automatically retry a small, bounded number of times with brief backoff on transient failure (network error or timeout) before surfacing the error.
- **FR-013**: Data-changing calls MUST NOT be automatically retried in a way that risks double-applying a change; write recovery follows the optimistic-revert path (FR-016) and relies on the backend's existing idempotence.
- **FR-014**: Genuine non-transient errors (validation failed, forbidden, unknown action, and similar) MUST be surfaced immediately without consuming the retry budget.

**Remaining optimistic saves (Story 4)**

- **FR-015**: Screens and actions that still block the UI on a network round-trip MUST be converted to update all relevant views optimistically before the backend confirms. This covers at least: list create/delete, list-item create/edit, recurring-rule create/edit/delete, recurring-event create/edit/delete, template create/edit/delete, settings changes, and any remaining dog-walk action that still blocks.
- **FR-016**: A failed optimistic change MUST revert in all views and show a clear error message; a successful one MUST reconcile server values in place with no visible flicker and no duplicate entry.
- **FR-017**: The optimistic behaviors already delivered in feature 028 (task complete/reopen/snooze/unsnooze, event create/edit, list-item need⇄stocked toggle) MUST continue to work unchanged.

**Code splitting (Story 5)**

- **FR-018**: The production build MUST be split into an initial chunk plus one or more on-demand chunks, such that the first render does not require downloading the deferred chunks.
- **FR-019**: Deferred areas MUST load on demand with a graceful loading indicator when needed and function identically to before splitting.
- **FR-020**: Failure to load a deferred chunk MUST surface a retryable error scoped to that area rather than crashing the whole app.

**Cross-cutting (all stories)**

- **FR-021**: This feature MUST NOT change the Google Sheet schema, tab structure, or any record's fields — it changes how data is requested, delivered, and rendered, never what is stored.
- **FR-022**: No user-visible screen may change what it does or shows as a result of this feature; observable differences are limited to speed, resilience, and instant-save feel.
- **FR-023**: Any new backend read path MUST honor the project's read-once-per-request Sheet access pattern and MUST NOT introduce per-cell or per-record repeated reads.

### Key Entities *(include if feature involves data)*

- **Bootstrap payload**: An aggregate initial-load response composing the existing per-dataset collections (events, tasks, recurring, recurring events, lists, all lists' list items, templates, settings, dog-walks). The activity feed is deliberately excluded and stays a lazy per-tab load. It introduces no new stored entity — it is a transport-level bundle of data that already exists, each part unchanged in shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cold open of the signed-in app issues **exactly one** initial data request (down from ~10) that renders the home dashboard plus the calendar, tasks, and lists tabs; the only further load request is the activity feed, fired lazily the first time the More tab is opened.
- **SC-002**: Time from app-open to primary views showing real data is **noticeably faster** than before — at least halved under the household's normal conditions — because sequential per-dataset round-trips are eliminated.
- **SC-003**: A returning user whose boot restore hits a transient failure is **never** dropped at the sign-in wall; 100% of such cases land in a recoverable retry state and recover without Google re-authentication once connectivity returns.
- **SC-004**: No backend call can hang indefinitely — every call resolves, errors, or aborts within its bounded timeout — and transient read blips recover automatically within the retry budget without a user-visible failure.
- **SC-005**: Every previously-blocking screen/action in scope updates the UI in **under ~100 ms** of the user's action (perceived-instant), with correct revert-and-error on failure and no duplicate entries on success.
- **SC-006**: The production build ships as multiple chunks; the first render does not download the deferred chunks, and every deferred area still loads and works.
- **SC-007**: Zero regressions: all existing behaviors — including feature 028's optimistic actions, the Sheet's hand-editability, and per-dataset refresh — continue to pass their checks, and no record shape changes.

## Assumptions

- **Bootstrap fits one request.** The combined initial dataset for a two-person household is small enough to return within Apps Script's per-request execution-time and response-size limits; the edge-case plan covers safe degradation if it ever approaches them.
- **Feature 028 is the optimistic-save baseline.** The instant-save pattern, revert-on-error behavior, and the set of already-optimistic actions established in 028 are the reference; Story 4 fills the remaining gaps rather than redesigning the approach.
- **"Transient vs. genuine" is distinguishable.** The existing auth error signals (forbidden, expired/invalid, versus network/server/parse failures) are sufficient to tell a recoverable blip from a real rejection; hardening keys off those existing distinctions.
- **Reasonable defaults for timeout/retry.** Concrete timeout duration, retry count, and backoff are implementation tuning chosen to fit the household's typical connectivity; they are not user-configurable in this feature.
- **Two users, no scale concerns.** Nothing here introduces roles, tenancy, caching tiers, or multi-tenant concerns; it stays within the two-user constitution.
- **No Sheet or API-contract-breaking changes.** Existing per-dataset actions remain; bootstrap and the client changes are additive, keeping the Sheet human-readable and hand-editable.

## Implementation Notes

- **US4 (T017–T023)**: FR-015's "at least" list is a floor, not a ceiling — implementation
  also converted `tasks.delete` and `events.delete` (feature 022's `useDeleteTask`/
  `useDeleteEvent`) to the optimistic-revert pattern, superseding that feature's original
  "no optimistic removal: rare/destructive" stance now that revert-on-failure is this app's
  standard recovery path for every save, not just creates/updates. `listItems.create`'s
  reuse-and-flip ambiguity (research R3 — server may reuse-and-flip an existing same-name
  item instead of creating one) is resolved client-side by replicating the server's exact
  match rule against the cache before deciding whether to optimistically flip or insert,
  so FR-016's "no duplicate entry" holds for that path too. Full detail and rationale in
  `tasks.md`'s Notes section.
- **US5 (T024–T027)**: `vite.config.ts`'s `manualChunks` (FR-018) is a function rather than
  research.md R5's sketched object-of-package-arrays form — this repo's `vite@^8.1.1` bundles
  rolldown, whose `manualChunks` type only accepts a function. The resulting build is
  unchanged in substance (a `schedule-x` vendor chunk, a `react` vendor chunk, and separate
  `CalendarHome`/`MoreView` chunks, none referenced by the initial `dist/index.html`). Full
  detail, plus `LazyBoundary`'s retry mechanism and the live-verification gap, in `tasks.md`'s
  Notes section.
