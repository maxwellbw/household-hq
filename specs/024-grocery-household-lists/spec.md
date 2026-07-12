# Feature Specification: Grocery & Household Lists

**Feature Branch**: `024-grocery-household-lists`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Grocery & household lists. Standalone persistent list(s) modeled on Jaz's Apple Notes flow — not task-attached listItems. Items live forever and toggle between "need" and "stocked" with one tap; buying something flips it back to stocked, ready for next time. Support multiple lists (groceries, Costco, hardware, pharmacy — same mechanics). Each item can have a staples flag; when enough staples are flagged "need," show a dashboard nudge signaling it's time to shop (replaces the current informal "we're out of key things" trigger). Items are grouped by store section (produce/dairy/frozen/etc.) so the "needed" view reads in aisle order. Each item supports an optional note/quantity field (e.g. "2 bags", "the good brand"). Needs a new Sheet tab (hand-editable like the rest of the data model) and a new Lists screen in the frontend. Must be extremely low-friction to add and flip items — this is a daily-use, fast-interaction feature."

## Clarifications

### Session 2026-07-12

- Q: What fixed set of store sections should items group into on the needed view? → A: Produce, Dairy, Frozen, Pantry, Household, Other
- Q: What staple-items-needed count should trigger the "time to shop" dashboard nudge? → A: Editable in Settings, default 3

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flip an item between need and stocked (Priority: P1)

Either Max or Jaz notices they're out of something (or just bought it) and wants to record that in a single tap, without opening a form or picking fields.

**Why this priority**: This is the core, highest-frequency interaction — the whole feature exists to make this faster than Apple Notes. If this isn't near-instant, the feature fails its own purpose.

**Independent Test**: Open a list, tap an item's status control, confirm it flips from "stocked" to "need" (or back) immediately and persists across a reload.

**Acceptance Scenarios**:

1. **Given** an item is marked "stocked", **When** either user taps its status control, **Then** it flips to "need" and the change is visible immediately (optimistic update) and persisted.
2. **Given** an item is marked "need", **When** either user taps its status control, **Then** it flips to "stocked".
3. **Given** the "needed" view is open, **When** an item is flipped to "stocked", **Then** it disappears from the needed view without a page reload.

---

### User Story 2 - Add a new item quickly (Priority: P1)

A user thinks of something to buy and wants to add it to the right list in a couple of seconds — a name is enough; section, staple flag, and note/quantity are optional and can be filled in later or skipped entirely.

**Why this priority**: Frictionless capture is as important as flipping status — if adding an item takes more than a couple of taps, people fall back to a notes app, and the list stops being the source of truth.

**Independent Test**: From a list screen, add an item by typing only a name and confirming; verify it appears in the list marked "need" (a newly added item is assumed needed) with no other fields required.

**Acceptance Scenarios**:

1. **Given** a list is open, **When** a user enters just a name and confirms, **Then** the item is created on that list, defaulted to "need" status, with no section, no staple flag, and no note/quantity.
2. **Given** a user is adding an item, **When** they optionally set a store section, staple flag, or note/quantity, **Then** those values are saved with the item.
3. **Given** an item name that already exists (case-insensitive) on the same list, **When** a user tries to add it again, **Then** the system reuses/flips the existing item to "need" rather than creating a duplicate.

---

### User Story 3 - View the needed list in aisle order (Priority: P2)

Before or during a shopping trip, a user opens a list and sees only what's needed, grouped by store section in a sensible walk-through order, so they don't backtrack around the store.

**Why this priority**: This is the payoff moment for the whole list — it's what replaces the mental math of "what do we need" with a ready-to-shop view. Lower priority than P1s because the list is still usable (just less organized) without it.

**Independent Test**: Populate a list with items across several sections, open the "needed" view, and confirm items are grouped and ordered by section, with unsectioned items grouped together (e.g., at the end).

**Acceptance Scenarios**:

1. **Given** a list has items needed across multiple store sections, **When** the needed view is opened, **Then** items are grouped under their section headings, and section headings appear in a consistent, sensible order.
2. **Given** some needed items have no section set, **When** the needed view is opened, **Then** those items appear together in an "unsectioned" group rather than being scattered.
3. **Given** a list also has "stocked" items, **When** the needed view is opened, **Then** stocked items are not shown (a separate view or toggle shows the full list including stocked items).

---

### User Story 4 - Manage multiple lists (Priority: P2)

A user switches between separate lists (e.g., Groceries, Costco, Hardware, Pharmacy) that each behave the same way but hold different items, and can create a new list when a new shopping context comes up.

**Why this priority**: Multiple lists are core to the request but the feature still delivers standalone value with just one list; this extends the same mechanics rather than introducing new ones.

**Independent Test**: Create a second list, add distinct items to it, and confirm switching between lists shows only that list's items with independent need/stocked state.

**Acceptance Scenarios**:

1. **Given** at least one list exists, **When** a user creates a new list with a name, **Then** it appears as a separate list with its own empty item set.
2. **Given** two or more lists exist, **When** a user switches between them, **Then** each shows only its own items and each item's status is independent per list.
3. **Given** a list is no longer needed, **When** a user deletes it, **Then** its items are removed and it no longer appears in the list selector.

---

### User Story 5 - Get nudged when it's time to shop (Priority: P3)

A user looks at the Home dashboard (not the Lists screen) and sees a signal that enough staple items are needed that it's worth planning a shopping trip, replacing the informal habit of noticing the fridge/pantry looks bare.

**Why this priority**: This is a valuable automation on top of the core list mechanics, but the list is fully useful via manual checking even without it — it's a convenience layer, not the foundation.

**Independent Test**: Flag several items as staples across one or more lists, mark enough of them "need" to cross the threshold, and confirm a nudge appears on the Home dashboard; unflag/restock below threshold and confirm the nudge disappears.

**Acceptance Scenarios**:

1. **Given** the count of staple items marked "need" (across all lists) reaches the nudge threshold, **When** the Home dashboard is viewed, **Then** a nudge is shown indicating it's time to shop.
2. **Given** the staple "need" count is below the threshold, **When** the Home dashboard is viewed, **Then** no nudge is shown.
3. **Given** a nudge is showing, **When** enough staple items are flipped back to "stocked" to drop below threshold, **Then** the nudge no longer appears.

---

### Edge Cases

- What happens when a user tries to add an item with an empty/whitespace-only name? System MUST reject or ignore the submission rather than create a blank item.
- What happens when two people flip the same item's status at nearly the same time from different devices? Last write wins; no conflict UI is required (consistent with the household's two-user, low-contention scale).
- What happens when a list has zero items, or zero needed items? The needed view shows an empty/positive state (e.g., "nothing needed") rather than an empty section or error.
- What happens when a store section is renamed or the section list changes? Existing items keep their previously assigned section value even if it no longer matches the current section list; they'd show under an "other"/unsectioned-style grouping if the section is no longer recognized.
- What happens when the last list is deleted? The user must still be able to create a new list; the Lists screen handles a zero-lists state gracefully rather than erroring.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support multiple independently-named lists (e.g., Groceries, Costco, Hardware, Pharmacy), each holding its own set of items.
- **FR-002**: System MUST allow creating a new list with a name, and deleting an existing list (with its items).
- **FR-003**: Users MUST be able to add an item to a list by supplying only a name; all other fields (store section, staples flag, note/quantity) are optional at creation time.
- **FR-004**: Every item MUST have a status of either "need" or "stocked", defaulting to "need" when first created.
- **FR-005**: Users MUST be able to toggle an item's status between "need" and "stocked" in a single interaction (e.g., one tap), with no confirmation step or intermediate form.
- **FR-006**: Items MUST persist indefinitely (not deleted or archived) as they cycle between "need" and "stocked", so a previously-bought item can be found and re-flagged rather than re-typed.
- **FR-007**: Adding an item whose name matches an existing item on the same list (case-insensitive, trimmed) MUST reuse the existing item (flipping it to "need") instead of creating a duplicate row.
- **FR-008**: Users MUST be able to optionally assign a store section (e.g., produce, dairy, frozen, pantry, household) to any item, and change it later.
- **FR-009**: Users MUST be able to optionally set a free-text note/quantity field on any item (e.g., "2 bags", "the good brand"), and edit or clear it later.
- **FR-010**: Users MUST be able to optionally flag any item as a "staple", and unflag it later.
- **FR-011**: System MUST provide a "needed" view per list showing only items currently marked "need", grouped and ordered by store section (a fixed, sensible section order), with unsectioned items grouped separately.
- **FR-012**: System MUST provide a way to view all items on a list (including "stocked" ones), for editing/management purposes distinct from the shopping-focused needed view.
- **FR-013**: System MUST track, across all lists combined, how many staple items are currently marked "need", and surface a nudge on the Home dashboard when that count reaches a threshold stored in Settings (default 3), editable there like other household settings.
- **FR-014**: The Home dashboard nudge MUST disappear once the staple "need" count drops back below the threshold.
- **FR-015**: All list/item changes MUST be reflected in the shared household data store and visible to both users without manual refresh workarounds (consistent with the rest of the app's data model).
- **FR-016**: Every create/update/delete on a list or item MUST append an entry to the household ActivityLog (timestamp, actor, action, target), consistent with the rest of the app.
- **FR-017**: The underlying data MUST remain hand-editable in the Sheet (human-readable tab/columns), consistent with the project's "Sheets is the DB" convention.

### Key Entities

- **List**: A named, standalone collection of items (e.g., "Groceries", "Costco", "Hardware", "Pharmacy"). Has a unique id and a display name. Can be created and deleted independently of other lists.
- **List Item**: A single line on a List. Attributes: id, parent list id, name, status ("need" or "stocked"), optional store section, optional staple flag (boolean), optional note/quantity (free text), created/updated metadata. Persists across need/stocked cycles rather than being deleted on purchase.
- **Store Section**: A fixed vocabulary — Produce, Dairy, Frozen, Pantry, Household, Other — used to group and order items within the needed view (in that order, with unsectioned items grouped under Other). Not user-creatable per this spec — a fixed list shared across all List Items regardless of which List they're on.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a new item to a list, from opening the app, in under 5 seconds, typing only the item name.
- **SC-002**: A user can flip an item's status (need ⇄ stocked) in a single tap/click with the change visibly reflected in under 1 second.
- **SC-003**: Given a list with items across at least 3 store sections, a user opening the needed view can identify the correct shopping order without needing to reorder items manually.
- **SC-004**: When staple items marked "need" cross the shopping threshold, a nudge appears on the Home dashboard without the user having to open the Lists screen first.
- **SC-005**: Both household members see the same list state (items, statuses) within one page load/refresh of each other making a change — no separate or conflicting copies of a list.
- **SC-006**: A previously-purchased item can be re-added to "need" status by flipping its existing entry, with zero re-typing of its name or lost note/quantity/section/staple metadata.

## Assumptions

- Non-grocery lists (Hardware, Pharmacy) reuse the same six-value section vocabulary loosely — most of their items are expected to land in "Other" rather than getting dedicated sections, which keeps the data model simple per the two-user, no-scale principle.
- Deleting a list deletes its items outright (no undo/trash), consistent with the app's existing low-ceremony delete patterns elsewhere.
- No barcode scanning, external product database, or shared/collaborative real-time cursors are in scope — this mirrors the existing lightweight, hand-editable data model.
- The Lists screen is a new top-level navigation destination alongside Dashboard/Calendar/Tasks, not nested under Tasks or Calendar, since lists are not task- or event-attached.
- Item ordering within a section (when multiple items share a section) is insertion order or alphabetical — a reasonable default, not user-sortable at launch.
