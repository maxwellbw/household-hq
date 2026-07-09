# Feature Specification: Calendar UI (Home Screen)

**Feature Branch**: `006-calendar-ui`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Calendar UI (home screen) — the app's default view. A calendar-first React frontend (the project's first frontend feature; it bootstraps the Vite + React + TS + Tailwind + shadcn/ui app). Shows Events and their tasks from the backend, calendar is the home screen. Tasks visually tether to their events. Owner color coding (max/jaz/both) is identity. Signed in via Google (feature 002 auth). Read/display events and tasks; basic interactions per DESIGN.md and PRODUCT.md. This is feature 006 per brief §10."

## Clarifications

### Session 2026-07-08

- Q: Does feature 006 include write interactions, or is it read-only? → A: Include view + task check-off **and** a friction-free quick-add. Quick-add MUST let the user create an **event**, a **recurring chore**, or a **one-time task** from one entry point. Full edit/delete forms for existing items remain deferred. Guiding intent: adding something must feel effortless — the app is meant to reduce mental load, not become another thing to manage.
- Q: How should the owner filter behave (Max/Jaz/Both)? → A: Independent toggle chips — Max, Jaz, and Both are each independently on/off and combine freely (e.g., Max+Both, or just Both), not one exclusive selection. All on by default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what's coming up on the calendar (Priority: P1)

Max or Jaz opens the app and lands directly on a calendar showing the household's events for the current period. Each event is visible with its title, time, and owner color, so either person can see at a glance what is happening and who owns it — without holding the whole schedule in their head.

**Why this priority**: The calendar-as-home-screen is the organizing metaphor of the entire product (PRODUCT.md, brief §10). Without it there is no frontend and no product. This story alone — a signed-in user seeing real events from the backend on a calendar — is the minimum viable slice and everything else hangs off it.

**Independent Test**: Sign in as an allowlisted user, load the app, and confirm the calendar renders the real events returned by the backend for the visible date range, each showing title, time, and correct owner color. Fully testable and valuable on its own.

**Acceptance Scenarios**:

1. **Given** an allowlisted user with events in the household this month, **When** they open the app, **Then** the calendar view is the first thing shown and displays those events positioned on their correct dates/times.
2. **Given** an event owned by Max, **When** it renders on the calendar, **Then** it uses Max's pine-teal owner color and also carries a non-color signal (initial/label) identifying the owner.
3. **Given** a month/period with no events, **When** the user views it, **Then** a calm, warm empty state is shown (not a blank grid or a spinner).
4. **Given** the user is on the calendar, **When** they navigate to the next or previous period (and to "today"), **Then** the calendar loads and shows that period's events.

---

### User Story 2 - See an event's prep tasks tethered to it (Priority: P1)

When an event has prep tasks (from the recurring/prep-template engines of features 004–005), those tasks appear visually attached to their parent event on the calendar. Opening an event reveals its prep checklist, each item labeled with its owner and its due timing (e.g., "T−2 days"). This makes the invisible prep work visible and tied to the thing it's for.

**Why this priority**: "Tasks are tethered to their events" is the signature interaction the product is built to protect (PRODUCT.md, DESIGN.md). A calendar that shows events but hides their prep work would miss the core reason this app exists over a plain calendar.

**Independent Test**: Sign in, find an event that has prep tasks in the backend, and confirm the tasks render attached to that event (a chip/count on the event and a checklist when the event is opened), each showing owner color+initial and due timing.

**Acceptance Scenarios**:

1. **Given** an event with three prep tasks, **When** it renders on the calendar, **Then** the event shows an indicator that it has prep work (e.g., owner-colored chips and/or a count badge).
2. **Given** an event with prep tasks, **When** the user opens/taps the event, **Then** its prep checklist is shown with each task's title, owner (color + initial), completion state, and relative due timing.
3. **Given** a prep task owned by Jaz, **When** it renders in the checklist or as a chip, **Then** it uses Jaz's berry/plum owner color plus her initial — consistent with how she appears everywhere else.
4. **Given** a task with no linked event (a standalone chore or recurring task placed on a date), **When** it renders, **Then** it appears on its own date without a broken/dangling tether.

---

### User Story 3 - Sign in and be recognized as Max or Jaz (Priority: P1)

A person opens the app and signs in with their Google account. If their email is on the household allowlist they are admitted and recognized as Max or Jaz (with the shared account resolved to a person); if not, they are refused with a plain message. Only signed-in, allowlisted users see the calendar and its data.

**Why this priority**: Feature 002 established that every backend call requires a verified ID token checked against the allowlist. The frontend cannot read any events or tasks without first completing sign-in, so this is a hard dependency of Stories 1 and 2 and ships with them.

**Independent Test**: Open the app while signed out and confirm the calendar/data are not shown; complete Google sign-in with an allowlisted account and confirm admission and correct identity; attempt with a non-allowlisted account and confirm a clear refusal.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open the app, **Then** they are prompted to sign in with Google and no household data is shown until they do.
2. **Given** an allowlisted account, **When** sign-in completes, **Then** the app admits them, shows whose account it is (Max or Jaz), and loads the calendar.
3. **Given** a non-allowlisted Google account, **When** they attempt to sign in, **Then** they are refused with a calm, plain message and see no household data.
4. **Given** a signed-in session that later becomes invalid/expired, **When** the app detects it, **Then** it returns the user to the sign-in prompt rather than showing errors or stale-forever data.

---

### User Story 4 - Filter the calendar by owner (Priority: P2)

Either person can filter the calendar using independent owner toggle chips — Max, Jaz, Both — that combine freely, using the same owner colors as identity, so they can quickly answer "what's on my plate" or "what's Max got going on" by turning owners on and off.

**Why this priority**: Owner identity is a core product principle and the filter is a natural, low-cost extension of the color coding that makes the calendar answer personal questions. It's valuable but not required for the first usable slice.

**Independent Test**: With events/tasks owned by different people present, toggle owner chips on/off in combination and confirm the visible set is exactly the union of the enabled owners, with each chip using its consistent owner color.

**Acceptance Scenarios**:

1. **Given** a mix of Max, Jaz, and Both items with all chips on, **When** the user turns off the Jaz chip, **Then** Jaz-only items are hidden while Max and Both items remain visible.
2. **Given** the user has turned off Max and Jaz, leaving only Both on, **When** the calendar renders, **Then** only shared "Both" items are visible.
3. **Given** any chips turned off, **When** the user turns them all back on, **Then** all owners' items are shown again (default state).
4. **Given** the owner filter chips, **When** they render, **Then** each uses that owner's consistent color plus a name/initial (color is never the only signal) and clearly shows its on/off state.

---

### User Story 5 - Add something in seconds (quick-add) (Priority: P1)

From anywhere in the app, either person can tap one always-present "+" and quickly add an event, a recurring chore, or a one-time task — pick the type, type the what, set the when and the owner, done. It has to feel effortless, because the whole point is to reduce mental load: if adding something feels like a chore, people won't do it and the shared picture goes stale.

**Why this priority**: The product only works if things actually get into it. A calendar that can only display data someone else entered isn't a coordination tool. The user explicitly called this out as very important: adding must feel like help, not homework. It depends on the calendar shell (US1–3) but is core to the app being useful, not optional polish.

**Independent Test**: Sign in, tap quick-add, create one of each type (event, recurring chore, one-time task) with just title/when/owner, and confirm each is saved to the backend and appears immediately in the right place with the correct owner color.

**Acceptance Scenarios**:

1. **Given** a signed-in user anywhere in the app, **When** they invoke quick-add, **Then** a single entry point lets them choose to create an event, a recurring chore, or a one-time task.
2. **Given** the user is creating an event, **When** they provide a title, a date/time, and an owner, **Then** it saves and appears on the calendar on that date with the owner's color immediately.
3. **Given** the user is creating a recurring chore, **When** they provide a title, a cadence, and an owner, **Then** it is saved as a recurring rule (its instances materialize per the existing engine) without requiring extra fields.
4. **Given** the user is creating a one-time task, **When** they provide a title, a due date, and an owner, **Then** it saves and appears on that date.
5. **Given** the fast path, **When** the user fills only the minimum fields, **Then** the item saves successfully using sensible defaults for everything else (no required deep detail).
6. **Given** a save fails (backend error), **When** the user submits, **Then** they see a plain error and their input is not silently lost.

---

### User Story 6 - Mark a task done (Priority: P2)

When either person finishes a prep task or chore, they can check it off right from the calendar/event view. The completion is quiet and satisfying, and the other person sees it without being told.

**Why this priority**: Marking done closes the loop that makes shared work visible ("completions are seen by the other person without asking" — PRODUCT.md). It's high value but depends on the viewing stories and is slightly less foundational than getting items into the system, so it sits just below quick-add.

**Independent Test**: Sign in, open an event with prep tasks (or a standalone task), check one off, and confirm it shows done immediately, persists to the backend, and can be reopened.

**Acceptance Scenarios**:

1. **Given** an open task in a checklist, **When** the user checks it off, **Then** it shows a quiet check animation and settles into a done state without a full page reload.
2. **Given** a completed task, **When** the user reopens it, **Then** it returns to the open state and persists.
3. **Given** a check-off, **When** the write to the backend fails, **Then** the UI reverts the item and shows a plain error rather than falsely showing it done.

---

### Edge Cases

- **Backend unreachable / slow**: The app shows a graceful loading state and, on failure, a plain retry affordance and (where possible) the last-known data with a "last synced" note rather than an infinite spinner or a hard crash.
- **Malformed or partial data**: An event missing a time, an unknown owner value, or a task referencing a non-existent event does not break the calendar; the item degrades gracefully (e.g., all-day placement, neutral styling, no tether) and the rest still render.
- **All-day vs timed events**: Events without a specific time render as all-day; timed events render at their time.
- **Very dense day**: A day with many events/tasks remains readable (overflow handled, e.g., "+3 more") and horizontally scroll-free at 375px width.
- **Timezone**: All dates/times display in the single household timezone from Settings; a user in a different device timezone still sees household-local times.
- **Reduced motion**: Users with `prefers-reduced-motion` get instant/crossfade transitions, and no animation is required to perceive content.
- **Sign-in interrupted/cancelled**: Cancelling the Google prompt returns to the sign-in state cleanly, with no partial/broken session.

## Requirements *(mandatory)*

### Functional Requirements

**Application shell & entry**

- **FR-001**: The application MUST open to the calendar as its default/home view for a signed-in, allowlisted user.
- **FR-002**: The application MUST be a warm, calendar-first interface consistent with DESIGN.md and PRODUCT.md (warm paper-and-ink palette, owner color identity, quiet motion, WCAG 2.1 AA).
- **FR-003**: The interface MUST be usable and readable on a phone at 375px width (mobile-first) and on desktop, without horizontal page scrolling.

**Authentication (depends on feature 002)**

- **FR-004**: The application MUST require Google sign-in before showing any household data, and MUST send the verified identity with every backend request.
- **FR-005**: The application MUST admit only allowlisted accounts (Max, Jaz, or the shared household account) and MUST refuse others with a plain, calm message.
- **FR-006**: The application MUST recognize and display the signed-in person's identity (Max or Jaz, with the shared account resolved to a person), and MUST return the user to sign-in when the session is missing/expired/invalid.

**Calendar display**

- **FR-007**: The calendar MUST display the household's events for the visible period, each showing at minimum its title, time (or all-day), and owner via consistent owner color plus a non-color owner signal.
- **FR-008**: The user MUST be able to navigate between periods (previous, next, jump to today).
- **FR-009**: The calendar MUST render its default period appropriate to the device (e.g., a month-scale view on desktop and an agenda/week-scale view on mobile per DESIGN.md), landing on the current date.
- **FR-010**: The calendar MUST present a designed empty state (warm serif line + relevant affordance) when a period has no items, never a bare grid or a perpetual spinner.

**Tasks tethered to events**

- **FR-011**: Prep/recurring tasks that belong to an event MUST render visually attached to that event (e.g., owner-colored chips and/or a prep-count indicator on the event).
- **FR-012**: Opening an event MUST reveal its prep checklist, with each item showing title, owner (color + initial), completion state, and relative due timing (e.g., "T−2 days", "Tomorrow", overdue).
- **FR-013**: Tasks not linked to any event (standalone chores/recurring instances) MUST render on their own date without a broken tether.
- **FR-014**: Owner color coding for Max, Jaz, and Both MUST be identical to every other place owners appear, and MUST always be paired with an initial/name (color is never the only signal).

**Owner filtering**

- **FR-015**: The user MUST be able to filter the calendar by owner using independent toggle chips for Max, Jaz, and Both that combine freely (any subset can be on), each chip using its consistent owner color plus label. All chips are on by default; the visible set is the union of the enabled owners.

**Resilience & feedback**

- **FR-016**: The application MUST handle backend errors and slowness gracefully: loading states, a retry affordance on failure, and preferring stale data with a "last synced" note over indefinite spinners.
- **FR-017**: All dates and times MUST be displayed in the single household timezone from Settings, regardless of the viewer's device timezone.
- **FR-018**: Every state transition and interaction MUST respect `prefers-reduced-motion`.

**Task check-off**

- **FR-019**: The user MUST be able to mark a task complete (and reopen a completed task) directly from the calendar/event view, with quiet confirmation (subtle check animation + warm toast per DESIGN.md) and the item settling into a done state.
- **FR-020**: Completing or reopening a task MUST be reflected in the view without a full reload, and MUST persist via the backend (so the other person sees it) — treating a failed write gracefully (revert + plain error) rather than silently losing the change.

**Quick-add (create)**

- **FR-021**: The app MUST provide a single, always-reachable quick-add entry point (e.g., a floating "+" on mobile, thumb-reachable) that feels effortless — adding something MUST NOT feel like managing another task.
- **FR-022**: Quick-add MUST let the user create any of three item types from that one entry point: an **event**, a **recurring chore**, or a **one-time task**.
- **FR-023**: Quick-add MUST capture the minimum needed per type (at least: a title/what, a when — date/time or cadence, and an owner — Max/Jaz/Both), with sensible defaults so the fast path is few taps; deeper detail is optional, not required to save.
- **FR-024**: A newly created item MUST appear in the calendar/relevant view immediately on save and MUST persist via the backend; owner selection MUST use the same consistent owner colors + labels as everywhere else.
- **FR-025**: This feature's write surface is bounded to task check-off/reopen (FR-019) and quick-add creation (FR-021–024). Editing and deleting **existing** events and tasks (full edit forms) are explicitly out of scope for feature 006 and deferred to a later feature.

### Key Entities *(include if feature involves data)*

- **Event**: Something happening on a date/time in the household calendar. Has a title, a date/time (or all-day), an owner (max/jaz/both), and may have associated prep tasks. Sourced read-only from the backend for display.
- **Task**: A unit of work — a prep-checklist item tied to an event, or a standalone/recurring chore placed on a date. Has a title, owner, completion state, a due date/relative timing, and an optional link to a parent event. Displayed on the calendar, tethered to its event when linked.
- **Owner identity**: One of Max, Jaz, or Both — each with a single consistent color used everywhere, always paired with an initial/name. The signed-in shared account resolves to a person for attribution.
- **Signed-in person**: The authenticated, allowlisted user (Max or Jaz), whose verified identity gates all data access and personalizes the view.
- **Settings**: Household configuration read from the backend, including the timezone in which all dates/times are displayed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in, allowlisted user opening the app lands on the calendar with the current period's real events visible, with no manual navigation required.
- **SC-002**: For any event that has prep tasks, a user can see that it has prep work from the calendar and open it to view the full prep checklist — the event→task tether is visible in 100% of events with tasks.
- **SC-003**: Every event and task displays its owner using the correct, consistent owner color and a non-color signal; there are zero owner items shown without an identifying initial/name.
- **SC-004**: A non-allowlisted account is refused and shown no household data; an allowlisted account is admitted and correctly identified as Max or Jaz.
- **SC-005**: The calendar is fully readable and free of horizontal page scrolling at 375px width, and the primary view renders within a couple of seconds on a normal connection (loading state shown until then, never an indefinite spinner).
- **SC-006**: The interface passes an `/impeccable audit` with no unwaived findings and meets WCAG 2.1 AA (contrast ≥ 4.5:1 against actual backgrounds, focus rings, 44px touch targets, reduced-motion support) before merge.
- **SC-007**: From the calendar, a user can add any of the three item types (event, recurring chore, one-time task) and see it saved and reflected in the view — the minimum fast path requires only title, when, and owner (no deep-detail fields forced).
- **SC-008**: A user can mark a task done and reopen it from the calendar/event view; the change is reflected immediately and is visible to the other person on their next load (persisted), with failed writes reverting rather than showing a false state.

## Assumptions

- **Backend is complete and read-ready**: Events, Tasks, Templates, Settings, Activity, and auth (`whoami`) endpoints from features 001–005 already exist and return the data this UI displays; feature 006 builds the frontend against them and adds no new backend behavior.
- **First frontend feature**: No `frontend/` app exists yet; feature 006 bootstraps the Vite + React + TypeScript + Tailwind + shadcn/ui application per the decided stack, deployed to GitHub Pages as a PWA-capable static app (full PWA install/push is feature 010, not required here).
- **Auth reuse**: Google Identity Services sign-in + ID-token-per-request + allowlist check is exactly as designed in feature 002; feature 006 wires that flow into the frontend and does not invent new auth concepts.
- **Owner semantics**: Max, Jaz, Both are the only owner values; the shared account resolves to a person on the backend. Owner colors are the DESIGN.md tokens.
- **Bounded write surface** (resolved in Clarifications): feature 006 delivers viewing, task check-off/reopen, and a friction-free quick-add that can create an event, a recurring chore, or a one-time task. Editing and deleting **existing** items (full edit forms) are deferred to a later feature. Quick-add writes go through the existing backend create actions (`events.create`, `recurring.create`, `tasks.create`) and check-off through `tasks.complete`/`tasks.reopen` — no new backend behavior is added.
- **Timezone**: The household timezone comes from Settings (default `America/Los_Angeles`); all display honors it.
- **Two users forever**: No roles, tenancy, sharing, or multi-household concepts are introduced.
- **Calendar rendering approach** (month/agenda/week views, specific calendar component) is a planning/implementation decision recorded in plan.md, not fixed here; the spec only requires the capabilities above.

## Dependencies

- Feature 002 (auth allowlist) — sign-in and verified attribution.
- Features 001, 003, 004, 005 — the Events, Tasks, Templates, Recurring, Settings, and Activity data this UI reads.
