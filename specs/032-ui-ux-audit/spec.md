# Feature Specification: Theming & Systemic UI Hygiene

**Feature Branch**: `032-ui-ux-audit-theming`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Theming system and systemic UI hygiene for Household HQ. Add full dark mode (system-following with a per-device System/Light/Dark preference, dark theme-color and dark-scheme-aware app icon) and fix the 032-assigned findings from specs/032-ui-ux-audit/audit.md (F-01, F-08, F-09, F-13, F-14, F-15, F-17, F-18, F-19, F-20, F-23, F-24, F-25, F-27, F-28, F-29, F-30, F-31, F-34). Dog-walk planner and calendar-parity findings are out of scope (deferred to feature 033)."

> Companion document: [audit.md](audit.md) — every requirement below traces to an audit finding (F-NN). The audit holds the evidence and root-cause notes; this spec holds the behavior contract.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app respects the room's light (Priority: P1)

Max checks the app in bed with the lights off. His phone is in dark mode, so Household HQ opens in a dark version of its warm paper-and-ink identity — no white flash, no ivory glare, and the app icon on his home screen doesn't sit like a bright sticker on his dark wallpaper. Jaz prefers the light look even at night, so on her phone she sets the app to Light and it stays light regardless of her phone's setting. Neither of them ever thinks about it again.

**Why this priority**: It's the headline ask of the feature, it touches every view, and every other visual fix in this feature must be verified against both themes — so it lands first.

**Independent Test**: Toggle the OS between light and dark with the app open and closed; set each of the three in-app preference values; verify every view, sheet, toast, and dialog renders legibly in both themes and the preference survives relaunch on that device.

**Acceptance Scenarios**:

1. **Given** no preference has ever been set, **When** the device is in dark mode, **Then** the app renders fully in the dark theme (every view, dialog, sheet, toast, skeleton, and empty state), and in the light theme when the device is light.
2. **Given** the OS switches theme while the app is open, **When** the user is on any view, **Then** the app follows within a moment, without reload and without losing state.
3. **Given** a user picks Light or Dark explicitly, **When** the OS theme changes or the app is closed and reopened on that device, **Then** the explicit choice wins and persists; picking System returns to following the OS.
4. **Given** dark theme is active, **Then** all text meets the same contrast bar as light (body ≥ 4.5:1 against actual rendered backgrounds, including owner-soft tints), owner identity colors remain distinguishable as Max / Jaz / Both, and the browser/PWA chrome color matches the theme.
5. **Given** the device is in dark mode, **Then** the app icon shown in browser tabs adapts to the dark scheme; where the platform cannot switch the installed-app icon (a documented platform limit), the single icon is designed to sit acceptably on both light and dark home screens.

---

### User Story 2 - The dashboard reads in priority order (Priority: P1)

Jaz opens the app in the morning. The first thing she sees is anything overdue, then today — with today already selected in the seven-day strip, showing the day's events, walk status, and tasks due in one card. There is no second "Today" section repeating the same information below. If nothing is overdue and nothing is due, one warm line says so instead of two stacked empty sections. A short "Lately" strip shows the last few things Max completed, so she sees his completions without asking or digging into More → Feed. Tapping the "running low on staples" nudge takes her to the grocery list.

**Why this priority**: The dashboard is the landing view and the product's core promise ("see what's coming, know who owns it, trust the other person sees it") — its reading order is currently backwards (overdue below today, duplicate today surfaces, buried feed).

**Independent Test**: Load the dashboard in four data states (overdue+due, overdue only, due only, both empty) and verify order, single today surface, the merged card's contents, the Lately strip, and the nudge tap-through.

**Acceptance Scenarios**:

1. **Given** at least one overdue item exists, **When** the dashboard loads, **Then** overdue items are the first content section, visually urgent, above today.
2. **Given** the dashboard loads, **Then** today is pre-selected in the seven-day strip and its day card shows the union of what the old strip card and Today section showed (events, walk status line, tasks due today), and no standalone "Today" section exists.
3. **Given** nothing is overdue and nothing is due today, **Then** exactly one warm empty line renders in that region (not one per removed section).
4. **Given** the other person completed items recently, **Then** a "Lately" strip on the dashboard shows the most recent activity entries (small, quiet, capped), each readable as a plain sentence, with a way through to the full Feed.
5. **Given** the grocery nudge is showing, **When** tapped, **Then** the app navigates to the grocery list's "Needed" view.
6. **Given** one person leads the month's load balance, **Then** the leader is described in a plain sentence (no cryptic uppercase tag), and an all-zero week collapses to one quiet line instead of three zero rows.

---

### User Story 3 - Every dead end gets a next step (Priority: P2)

When the activity feed (or any view) fails to load, the message offers a Retry button that actually retries — not advice to "try again" with nothing to press. When Max completes a task or deletes a list item, a toast with Undo appears for a few seconds instead of a blocking "are you sure?" dialog. Timestamps about data freshness read as one consistent, relative phrase ("Synced 2 min ago") everywhere they appear.

**Why this priority**: These are the moments the app currently strands or interrupts its users; fixing them systemically (one shared pattern each) is cheap and touches every view.

**Independent Test**: Force a load failure on each view with an error state and press Retry; complete and delete items and exercise Undo within and after its window; compare freshness labels across views.

**Acceptance Scenarios**:

1. **Given** any data view fails to load, **Then** the error state includes a Retry action that re-requests, shows progress while retrying, and recovers into content on success.
2. **Given** a user completes a task (or deletes a list item / other idempotent action), **When** the action succeeds, **Then** a toast offers Undo for a short window; choosing Undo restores the prior state (including any activity entry), and letting it lapse changes nothing further. Blocking confirmation dialogs are removed for these actions; destructive actions with external side-effects (e.g., event delete synced to Google Calendar) keep a confirm.
3. **Given** any surface shows data freshness, **Then** it uses one relative format consistent across the app, and two surfaces visible in the same session never contradict each other's clock.
4. **Given** a day or list region has no items, **Then** it shows a quiet designed empty treatment rather than a bare "—".

---

### User Story 4 - Desktop behaves like desktop (Priority: P2)

On the laptop, Settings and other leaf views sit in a readable centered column instead of stretching labels and controls to opposite edges of the screen, and the floating "+" button never covers a form's Save button or list rows.

**Why this priority**: Desktop is the weekly-review surface; today its primary actions are literally covered.

**Independent Test**: At desktop width, open Settings, Lists, Tasks, and More leaf views; verify a content column, no occlusion of any interactive element by the floating action, and no full-bleed label/control gulf.

**Acceptance Scenarios**:

1. **Given** desktop width, **When** any leaf or form view renders, **Then** content sits in a bounded readable column and no interactive element is occluded by the quick-add affordance in any scroll position.
2. **Given** desktop width, **When** quick-add is available, **Then** it lives somewhere that cannot overlap content (or content reserves space for it).

---

### User Story 5 - Tasks and Lists without the noise (Priority: P2)

The Tasks view groups its open items by horizon (this week, next week, later) instead of one 34-row wall. The commitment affordance stops shouting from every row. The Someday list has one home. The owner filter Max sets on the calendar is the same filter he finds on Tasks. Lists has one obvious way to add.

**Why this priority**: Daily-use views; the fixes are de-duplication and grouping, no new capability.

**Independent Test**: Seed 30+ open tasks across horizons; verify grouping, calmer commitment affordance, single Someday location, one filter state across views, and a single primary add affordance per Lists screen.

**Acceptance Scenarios**:

1. **Given** open tasks spanning many due dates, **Then** the Tasks view groups them under horizon headings with counts, ordered soonest-first.
2. **Given** rows with and without the commitment state, **Then** rows align consistently and the un-committed affordance is visually quieter than task titles.
3. **Given** the Someday list, **Then** it appears in exactly one primary location, and any other surface at most links to it.
4. **Given** an owner filter applied on one view, **When** switching to the other filterable view, **Then** the same filter is in effect; it persists on that device across a relaunch.
5. **Given** the Lists view, **Then** one primary add affordance exists per screen context and the staple/star marker's meaning is discoverable in-product.

---

### User Story 6 - Account actions can't be mis-tapped (Priority: P3)

Tapping the avatar in the top bar shows who is signed in and offers Sign out as a deliberate second step — it never signs out in one tap. Sign out lives canonically in More → Account.

**Independent Test**: Tap the avatar once (nothing destructive happens), sign out via its menu and via More → Account.

**Acceptance Scenarios**:

1. **Given** any view, **When** the avatar is tapped once, **Then** the user is not signed out; sign-out requires a deliberate second interaction.

---

### Edge Cases

- OS theme changes while a sheet/dialog/toast is open — everything on screen re-themes together, no mixed-theme frames.
- Theme preference is per device (Settings tab in the Sheet is household-shared; a shared row must not force Jaz's phone to Max's choice) — persistence is local to the device.
- Print/very old browsers with no dark-scheme support fall back to light.
- Retry pressed repeatedly while offline: no stacking requests; the state stays honest ("still couldn't load").
- Undo tapped after the underlying sync already propagated: restore still works (idempotent writes) and produces a corrective activity entry rather than silently rewriting history.
- Undo window expiring mid-tap (race): whichever wins, state matches what the user last saw.
- All owner-filter chips deselected: define the behavior (treat as "everyone" rather than an empty view).
- Overdue section with a large backlog: capped with a "view all" path, never pushing today below the fold entirely.
- Lately strip when the feed request fails: strip hides quietly (dashboard never shows an error for a secondary surface).
- Empty grocery "Needed" view reached from the nudge: nudge and list state must not contradict (stale nudge tap lands on an honest empty state).

## Requirements *(mandatory)*

### Functional Requirements

**Theming (F-01, F-17, F-24)**

- **FR-001**: The app MUST provide a complete dark theme covering every surface (views, sheets, dialogs, toasts, skeletons, empty/error states, and third-party calendar chrome), derived from the existing warm palette identity.
- **FR-002**: With no stored preference, the app MUST follow the device's color-scheme, including live changes while open.
- **FR-003**: Users MUST be able to set System / Light / Dark in Settings (new Appearance area); the choice persists per device and an explicit choice overrides the OS.
- **FR-004**: Browser/PWA chrome color MUST match the active theme; the browser-tab icon MUST adapt to dark scheme; the installed-app icon limitation (cannot follow theme) MUST be documented and the shipped icon acceptable on both backgrounds.
- **FR-005**: Both themes MUST pass the accessibility bar: body text ≥ 4.5:1 on actual rendered backgrounds (including owner-soft tints and warning-on-background combinations flagged in F-20), owner colors distinguishable and never the only signal.
- **FR-006**: DESIGN.md MUST be updated in the same change: dark token set, the shipped ink token values, current navigation structure, and removal of the "dark mode deferred" instruction (F-24).

**Dashboard (F-27, F-18, F-19, F-31, F-32-adjacent boundary: walk status *line* content comes from existing data; planner interactions remain 033)**

- **FR-007**: Dashboard content order MUST be: notices, then overdue (only when non-empty), then the merged today card (strip with today pre-selected: events, walk status line, tasks due), then weekend/load-balance/coming-up; the standalone Today section is removed.
- **FR-008**: When overdue and today are both empty, exactly one warm empty line renders for that region.
- **FR-009**: A "Lately" strip MUST show the most recent activity entries (capped, quiet) with a path to the full Feed; it hides itself on load failure.
- **FR-010**: The grocery nudge MUST navigate to the grocery list's Needed view when tapped.
- **FR-011**: Load-balance MUST describe the leader in a plain sentence and collapse all-zero periods to a single line.

**States & feedback (F-09, F-23, F-25, F-34)**

- **FR-012**: Every data view's error state MUST include a working Retry with busy feedback; the pattern is shared, not per-view bespoke.
- **FR-013**: Idempotent actions (task complete, list-item delete and equivalents) MUST use a short-window Undo toast instead of blocking confirms; actions with external side-effects keep a confirm. Undo restores prior state and the activity log reflects the net result.
- **FR-014**: Data-freshness labels MUST use one relative format app-wide from a single source.
- **FR-015**: Empty regions MUST use a designed quiet treatment; bare "—" markers are removed.

**Layout (F-08, F-13)**

- **FR-016**: At desktop widths, leaf/form views MUST render in a bounded content column, and the quick-add affordance MUST never occlude interactive content in any scroll position.

**Tasks & Lists (F-14, F-15, F-29, F-30)**

- **FR-017**: The Tasks view MUST group open tasks by time horizon with headings and counts.
- **FR-018**: The commitment affordance MUST be visually subordinate to task titles while remaining one tap.
- **FR-019**: The Someday list MUST have exactly one primary home; other surfaces may link, not embed.
- **FR-020**: Owner filtering MUST be one shared state across filterable views, persisted per device; all-deselected behaves as all-selected.
- **FR-021**: Each Lists screen context MUST present a single primary add affordance; the staple marker's meaning MUST be discoverable in-product.

**Account (F-28)**

- **FR-022**: Single-tap of the avatar MUST NOT sign out; sign-out is reachable via a deliberate second step there and canonically in More → Account.

**Accessibility sweep (F-20)**

- **FR-023**: All interactive elements MUST expose correct accessible names (calendar item buttons and More-menu rows verified with tooling, not only tree reads); the settings toggle and disabled primary button MUST be restyled to be visibly stateful in both themes.

### Key Entities

- **Theme preference**: per-device value (System / Light / Dark); never synced through the household Settings store.
- **Owner filter state**: per-device set of visible owners shared by all filterable views.
- **Undoable action**: an action, its inverse, and a short expiry; net outcome is what the activity log records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In dark mode, 100% of app surfaces render themed (audited view-by-view; zero light-theme remnants), and all text samples measured in both themes meet ≥ 4.5:1 (≥ 3:1 for large text).
- **SC-002**: Theme follows an OS change in under 1 second without reload; an explicit preference survives relaunch on that device 100% of the time.
- **SC-003**: A first-time-tonight dark-mode user can read the dashboard without adjusting brightness — verified by the household's two users signing off after a real evening of use.
- **SC-004**: Overdue-to-eyes time: with an overdue item present, it is the first content section on load, and the dashboard renders exactly one "today" surface (verified across the four data states).
- **SC-005**: Every error state in the app offers Retry; recovery after connectivity returns requires ≤ 1 tap from the stranded view.
- **SC-006**: Completing a task requires zero confirmation taps, and a mistaken completion is reversible within the Undo window in ≤ 1 tap.
- **SC-007**: At desktop width, zero interactive elements are occluded at any scroll position across Settings, Tasks, Lists, and More leaf views.
- **SC-008**: Both users can state where Someday lives and what the star on a list item means without being told (informal two-person test — the bar PRODUCT.md sets).
- **SC-009**: Feed activity is visible on the dashboard within one glance (no navigation) whenever recent activity exists.

## Assumptions

- The dark theme is a *variant of the existing identity* (warm, paper-and-ink, owner colors recognizably Max/Jaz/Both), not a new visual language; exact dark token values are a design-time decision validated against FR-005.
- Theme preference and owner-filter persistence are per device by design (household Settings stay shared); losing them on a cleared browser is acceptable.
- The Lately strip reuses existing activity data; no new backend capability is required for it beyond what the Feed already uses.
- Undo is implemented over the existing idempotent write model; no schema change is expected. If any action's inverse proves non-idempotent, that action keeps its confirm instead (documented deviation).
- The horizon grouping boundaries (this week / next week / later) follow the household week already used by digests; empty groups are hidden.
- 033 (planner + calendar parity) is explicitly out of scope: F-02..07, F-10..12, F-16, F-21, F-22, F-26, F-32 (planner interactions), F-33. The merged today card includes the walk status *line* only if it can reuse data the dashboard already has; making it open the planner is 033.
- No new dependencies; everything ships within the decided stack (constitution III/IV).
