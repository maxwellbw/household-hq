# Feature Specification: Someday Force-Rank + Tasks-Tab Someday Section (someday-force-rank)

**Feature Branch**: `021-someday-force-rank`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Someday force-rank + Tasks-tab Someday section. Two connected pieces: (1) A 'This or that?' pairwise force-ranking session that walks the user through the Someday list two tasks at a time producing ONE shared household ranking (not per-owner), persisted, driving the render order everywhere, using efficient insertion (merge-sort / binary-insertion style), resumable. (2) Undated tasks currently hide at the bottom of the 'Open' section via a 9999-99-99 sort sentinel in frontend/src/lib/tasks.ts — split them out into their own labeled, collapsible 'Someday' section at the bottom of the Tasks tab, rendered in the shared ranking order. Primarily frontend; backend already supports undated tasks but persisting the shared ranking needs a storage decision. Someday = standalone open tasks with no due date (event-attached undated tasks excluded, per feature 013)."

## Clarifications

### Session 2026-07-11

- Q: Where should the shared Someday ranking be persisted in the Sheet? → A: **A per-task `somedayRank` column on the Tasks tab** — one numeric value per row; the task title sits right beside its rank so it stays hand-editable, and it reconciles naturally since the Tasks tab is already read whole per request. Blank `somedayRank` = unranked.
- Q: How should an interrupted force-rank session resume? → A: **Same device (local)** — in-progress comparison state lives in the browser (e.g., localStorage); only the *final* shared ranking is written to the Sheet. No new backend session state; cross-device / other-user resume is out of scope.
- Q: Where do new / never-ranked Someday tasks appear relative to ranked ones? → A: **Bottom** — ranked items render first in priority order; never-ranked (blank `somedayRank`) tasks append below them.
- Q: Should the Someday section start collapsed or expanded? → A: **Expanded by default** — the section is visible on load; the user can collapse it to tuck the parking lot away.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A dedicated Someday section on the Tasks tab (Priority: P1)

Today, undated "someday" tasks are technically visible on the Tasks tab, but they're crammed at the bottom of the **Open** section — sorted there only by a hidden `9999-99-99` sentinel — so they read as ordinary open work that just happens to have no date. Jaz wants her parking-lot items to feel distinct from the things she's actually committed to this week. After this story, standalone undated open tasks are pulled out of Open into their own clearly-labelled **Someday** section at the bottom of the Tasks tab. The section is collapsible from the moment it ships, so it can be tucked away when she's focused on dated work and opened when she wants to browse the parking lot. It respects the same owner filter as the rest of the tab, and shows a calm empty state when there's nothing parked.

**Why this priority**: This is the visible, always-on payoff. Even with no ranking session ever run, simply separating Someday from Open makes the Tasks tab honest about what's committed vs. parked. It's independently valuable and is a prerequisite surface for Story 2 (the ranking has to render *somewhere*).

**Independent Test**: On the Tasks tab, create a couple of open tasks with no due date and confirm they appear under a labelled **Someday** section at the bottom (not mixed into Open); collapse and expand the section; change the owner filter and confirm the section respects it; remove all undated tasks and confirm a calm empty state rather than a vanished section.

**Acceptance Scenarios**:

1. **Given** open tasks exist both with and without due dates, **When** the user views the Tasks tab, **Then** dated open tasks appear under **Open** and standalone undated open tasks appear under a separate **Someday** section at the bottom of the tab.
2. **Given** the Someday section is expanded, **When** the user collapses it, **Then** its tasks are hidden and the collapsed/expanded state persists consistently with the tab's other collapsible sections.
3. **Given** someday tasks exist for different owners, **When** the user changes the owner filter (Max / Jaz / Both), **Then** the Someday section shows only matching tasks.
4. **Given** an undated task is attached to an event, **When** the user views the Someday section, **Then** that task does **not** appear there (event-attached tasks surface inside their event, per feature 013).
5. **Given** there are no standalone undated open tasks for the current filter, **When** the user views the Tasks tab, **Then** the Someday section shows a calm empty state rather than disappearing without explanation.
6. **Given** a someday task in the section, **When** the user completes it, **Then** it leaves the Someday section (moves to Done), and the existing schedule action still opens the same date+owner dialog used elsewhere.

---

### User Story 2 - Force-rank the Someday list with "This or that?" (Priority: P1)

The household's someday list grows into a jumble where nothing signals what actually matters more. Max wants to impose an honest priority order without agonising over a big drag-and-drop reshuffle. He starts a **force-rank** session. The app shows him two someday tasks at a time and asks a single simple question — *"This or that?"* — and he taps the one that matters more. It repeats with new pairs, asking as few questions as it can get away with, until every task has a place. The result is **one shared household ranking** (there is no separate Max-order and Jaz-order) that immediately drives the order the Someday section renders in — for both users. If he gets interrupted partway through, he can leave and come back and pick up where he left off without redoing comparisons.

**Why this priority**: Ordering is the whole reason to force-rank. Rendering someday tasks in a meaningful shared priority order (Story 1 renders them *somewhere*; Story 2 makes that order *mean something*) is the core deliverable the feature is named for. It ships alongside Story 1 because the persisted order is what the section renders by.

**Independent Test**: With several someday tasks present, start a force-rank session and answer the "this or that?" comparisons; confirm the number of questions is far fewer than every-pair (roughly proportional to n·log n, not n²); confirm the resulting order is reflected in the Someday section for the same user and for the other user; start a session, answer a few comparisons, leave, return, and confirm it resumes rather than restarting.

**Acceptance Scenarios**:

1. **Given** two or more someday tasks, **When** the user starts a force-rank session, **Then** the app presents exactly two tasks at a time and asks which is more important, with no third option required to proceed.
2. **Given** an in-progress session, **When** the user answers each "this or that?", **Then** the app uses each answer to place tasks with an efficient number of comparisons (merge/binary-insertion style — not comparing every possible pair).
3. **Given** the user finishes a session, **When** it completes, **Then** every someday task has a definite position in a single shared ranking, and the Someday section immediately renders in that order.
4. **Given** one user completed a ranking, **When** the other user views the Someday section, **Then** they see the **same** order (the ranking is shared household-wide, not per-owner).
5. **Given** an in-progress session, **When** the user leaves the session (navigates away, closes the app) and returns, **Then** the session resumes from where it left off without discarding already-answered comparisons.
6. **Given** fewer than two someday tasks exist, **When** the user looks for the force-rank action, **Then** ranking is unavailable or a no-op (nothing to compare), communicated calmly rather than as an error.
7. **Given** the ranking save fails (e.g., network error) at the end of a session, **When** the user finishes, **Then** the user is told it did not save and the existing order is preserved (no partial/corrupt order is shown as final).

---

### User Story 3 - The ranking absorbs everyday changes gracefully (Priority: P2)

The someday list is not frozen between ranking sessions — new parking-lot items get added, someday tasks get scheduled (they gain a date and leave Someday) or completed, and the other user is doing the same things concurrently. Jaz adds "reseal the deck" as a new someday task the week after Max ran a ranking. She doesn't want the whole ranking invalidated or a forced re-rank just because one item appeared. After this story, newly-added or newly-unscheduled someday tasks that have never been ranked appear in a predictable place relative to the ranked ones (so they're never lost), and removing a task from Someday (by scheduling or completing it) doesn't scramble the positions of the tasks that remain.

**Why this priority**: Without this, the ranking is brittle — usable exactly once and stale the moment anything changes. It's essential for the feature to survive real use, but it layers on top of the core rank-and-render loop (Stories 1–2), so it's P2.

**Independent Test**: Rank a set of someday tasks; then add a new undated task and confirm it appears in a predictable, documented position (e.g., at the end/unranked bucket) without breaking the existing order; schedule one ranked task away and confirm the remaining tasks keep their relative order; complete a ranked task and confirm the same.

**Acceptance Scenarios**:

1. **Given** an existing shared ranking, **When** a new standalone undated task is created, **Then** it appears in the Someday section in a predictable, documented position (unranked items grouped consistently) without altering the relative order of already-ranked tasks.
2. **Given** an existing shared ranking, **When** a ranked someday task is scheduled (gains a date) or completed, **Then** it leaves the Someday section and the remaining ranked tasks keep their relative order.
3. **Given** an existing shared ranking, **When** a previously-scheduled task loses its date again (returns to Someday), **Then** it reappears in the Someday section in a predictable position rather than silently vanishing.
4. **Given** both users act concurrently, **When** the section is refreshed, **Then** it reflects the current set of someday tasks in the persisted shared order without resurrecting stale entries or duplicating tasks.

---

### Edge Cases

- **One or zero someday tasks**: Ranking needs at least two items to compare; with fewer, the force-rank action is unavailable/no-op and the single task (if any) still renders normally.
- **Ties / indifference**: The comparison asks for a single winner per pair; there is no explicit "they're equal" outcome — the user must pick one (documented in Assumptions). Accidental mis-taps are acceptable within a session; a full re-rank is always available.
- **List changed mid-session**: If a someday task is scheduled, completed, or deleted by the other user while a ranking session is open, the session must not crash or place a task that no longer exists; stale items drop out and the produced order covers only tasks that still qualify.
- **Never-ranked items**: Tasks that have never been through any session still need a defined render position (they can't be invisible); they group consistently relative to ranked items.
- **Event-attached undated tasks**: Excluded from Someday entirely (per feature 013) — they are neither rankable nor shown in the section.
- **Completing vs. scheduling**: Both remove a task from the Someday section, but by different exits (Done vs. dated on the calendar); neither should reorder the survivors.
- **Long lists**: The section and the comparison flow stay readable and quick even with many someday tasks; the number of comparisons must grow gently (n·log n), never every-pair.
- **Collapsed section during ranking**: Running a ranking updates the order regardless of whether the section is currently collapsed; expanding it later shows the new order.

## Requirements *(mandatory)*

### Functional Requirements

**Someday section (Story 1)**

- **FR-001**: The Tasks tab MUST render standalone open tasks with no due date in a distinct, labelled **Someday** section positioned at the bottom of the tab, separate from the **Open** section.
- **FR-002**: Undated open tasks MUST NOT appear within the Open section (the `9999-99-99` bottom-of-Open placement is replaced by the dedicated Someday section).
- **FR-003**: Event-attached undated tasks MUST be excluded from the Someday section (consistent with feature 013 — they surface inside their event).
- **FR-004**: The Someday section MUST be collapsible from initial release and MUST start **expanded** by default, with collapse/expand behaviour and persistence consistent with the tab's other collapsible sections (Open/Done, feature 022).
- **FR-005**: The Someday section MUST respect the active owner filter (Max / Jaz / Both), showing only matching tasks.
- **FR-006**: When there are no qualifying someday tasks for the current filter, the Someday section MUST show a calm empty state rather than disappearing.
- **FR-007**: Task actions available elsewhere on a someday task (complete/reopen, and the existing tap-to-schedule date+owner dialog from feature 013) MUST remain available from the Someday section.

**Force-rank session (Story 2)**

- **FR-008**: The system MUST provide a force-rank session that presents someday tasks **two at a time** and asks the user which is more important ("this or that?"), requiring exactly one selection per pair to advance.
- **FR-009**: The session MUST determine positions using an **efficient comparison strategy** (merge-sort / binary-insertion style) so the number of comparisons grows on the order of n·log n, not n² (never every possible pair).
- **FR-010**: A completed session MUST produce **one shared household ranking** over the someday tasks — a single order, not a per-owner order.
- **FR-011**: The shared ranking MUST be **persisted** as a per-task `somedayRank` value on the Tasks tab so it survives reloads and is the source of truth for the Someday section's render order for **both** users. Only the final ranking of a completed session is written back; in-progress session state is not persisted server-side.
- **FR-012**: The Someday section MUST render its tasks in the persisted shared ranking order for every user.
- **FR-013**: An in-progress session MUST be **resumable on the same device** — leaving and returning (on the device where the session started) MUST NOT discard already-answered comparisons; the session continues from where it stopped. Session progress is held locally on that device; resuming on a different device or as the other user is out of scope.
- **FR-014**: When fewer than two qualifying someday tasks exist, the force-rank action MUST be unavailable or a no-op, communicated calmly (not an error).
- **FR-015**: The user MUST be able to re-run a full force-rank session at any time to replace the existing order (mis-taps and drift are corrected by re-ranking, not by requiring per-comparison undo).
- **FR-016**: If persisting the final ranking fails, the system MUST inform the user it did not save and MUST NOT present a partial or corrupt order as the saved result; the previous order is preserved.

**Change resilience (Story 3)**

- **FR-017**: Someday tasks that have never been ranked (blank `somedayRank`) MUST still have a defined, predictable render position — they render **below** all ranked tasks (the unranked group at the bottom) — so they are never invisible.
- **FR-018**: Adding a new standalone undated task MUST NOT alter the relative order of already-ranked tasks; the new task takes a predictable, documented position — appended to the unranked group at the **bottom** of the section.
- **FR-019**: Removing a task from Someday (by scheduling it with a date or completing it) MUST leave the relative order of the remaining ranked tasks unchanged.
- **FR-020**: A task returning to Someday (losing its date again) MUST reappear in the section in a predictable position rather than silently vanishing.
- **FR-021**: The section MUST reflect the current set of someday tasks in the persisted shared order under concurrent changes, without resurrecting stale entries or duplicating tasks.

**Consistency / logging**

- **FR-022**: Persisting a new shared ranking MUST be recorded to the household activity log consistent with other state changes (actor, action, target), so a completed re-rank is auditable.
- **FR-023**: The stored ranking MUST remain human-readable and hand-editable in the underlying data store (constitution: the Sheet stays hand-editable without breaking the app).

### Key Entities *(include if data involved)*

- **Someday task**: Not a new entity — an existing household **Task** whose due date is empty, status is open, and which is not attached to an event. "Someday" remains a *view* over tasks defined by the absence of a due date.
- **Shared ranking**: The household-wide priority order over someday tasks. Persisted as a per-task `somedayRank` value on the Tasks tab — a numeric position per ranked task (blank = unranked). A single order (not per-owner); source of truth for render order. Ranked tasks render first in ascending `somedayRank`; unranked tasks (blank) render below them.
- **Force-rank session**: The transient, resumable state of an in-progress comparison run — which tasks are being ordered and which comparisons have been answered so far — held **locally on the device** where the session runs, enabling same-device resume without redoing work. It is not persisted to the Sheet; only the final ranking is written back.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standalone open undated tasks appear in the labelled Someday section for the appropriate owner filter (no someday task is mixed into Open or invisible).
- **SC-002**: Ranking N someday tasks requires no more than roughly N·log₂(N) "this or that?" comparisons (e.g., ~10 tasks resolvable in well under 40 comparisons), and never approaches N·(N−1)/2.
- **SC-003**: After one user completes a ranking, the other user sees the identical Someday order on their next view (a single shared order, verifiable by comparing both screens).
- **SC-004**: A user can leave a partially-completed ranking session and resume it later with zero previously-answered comparisons repeated.
- **SC-005**: Adding, scheduling, or completing a someday task after a ranking never reorders the tasks that remain ranked (their relative order is preserved 100% of the time).
- **SC-006**: The Someday section can be collapsed and expanded, and a user can locate and read their parked items in the collapsed-by-default state within two interactions.

## Assumptions

- **Storage stays in the Sheet**: The shared ranking is persisted as a per-task `somedayRank` column on the Tasks tab (per the constitution), kept human-readable and hand-editable — the rank sits beside the task title and can be adjusted by hand.
- **Backend already supports the data**: Undated tasks and task updates already exist (feature 013); this feature adds the ranking's persistence and the Someday-section UI, not new task CRUD.
- **Someday definition inherited from 013**: "Someday" = standalone (non-event) open task with no due date. This feature does not change that definition.
- **Single winner per comparison**: Each "this or that?" yields exactly one winner; there is no "equal/skip" outcome. Indifference is resolved by the user picking either; correcting mistakes is done by re-ranking, not per-pair undo (no undo control is required for v1).
- **Order is intentional, not derived**: The shared ranking is a human-authored priority order, independent of due dates or owners; it is not auto-computed from other task fields.
- **Collapsible mechanics shared with 022**: The Someday section reuses whatever collapsible section pattern feature 022 establishes for Open/Done; if 021 lands first, it introduces a minimal collapsible pattern that 022 can adopt.
- **Two users, one household**: Consistent with the project's two-user model — one shared ranking is correct; there is deliberately no per-user ordering.
- **Re-rank replaces**: Running a new session replaces the prior order wholesale (the session's output is authoritative); there is no incremental "insert one item into the existing order" mode required for v1 beyond the predictable unranked-append behaviour of FR-018.
