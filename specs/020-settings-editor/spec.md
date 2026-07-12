# Feature Specification: Settings Editor under More

**Feature Branch**: `020-settings-editor`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Settings editor under More. A curated settings form (not a raw key-value editor) accessible from the More section of the app, letting Max and Jaz edit household preferences: digest schedule (weekly or monthly, day and hour), ntfy instant-ping notifications on/off, default calendar reminder minutes, and household timezone. Allowlist emails and ntfy topic names stay Sheet-only and are NOT editable here for safety. Changes persist to the Settings tab via a new settings.update backend action. Every change appends to ActivityLog."

## Clarifications

### Session 2026-07-11

- Q: How should the household timezone field work? → A: Curated dropdown of a short list of relevant US timezones (Pacific/Mountain/Central/Eastern/Arizona/Hawaii), so an invalid zone can't be produced.
- Q: When the digest hour changes, how should `settings.update` handle the digest trigger (which fires at a fixed hour set at install time)? → A: `settings.update` auto-re-installs the digest trigger to the new hour so the change fully takes effect with no manual step.
- Q: What save model should the form use? → A: Single "Save" button that persists all in-scope settings in one `settings.update` call and one ActivityLog entry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adjust digest schedule (Priority: P1)

Max or Jaz opens **More → Settings** and changes when the household digest emails go out — turning the weekly and monthly digests on or off, and choosing the day and hour they send. The change sticks and the next digest respects the new schedule.

**Why this priority**: The digest schedule is the setting most likely to need tuning after living with the defaults, and today it can only be changed by hand-editing the Sheet. It is the clearest payoff for a curated editor.

**Independent Test**: Open the Settings screen, toggle the weekly digest off, change the monthly digest day, save, reload the app, and confirm the values persisted; confirm an ActivityLog entry was appended.

**Acceptance Scenarios**:

1. **Given** the Settings screen is open with weekly digest enabled, **When** the user turns the weekly digest off and saves, **Then** the change persists and no weekly digest is sent on the previously scheduled day.
2. **Given** the Settings screen is open, **When** the user sets the weekly digest day to "Wednesday" and the digest hour to 8, **Then** those values are saved and reflected on reload.
3. **Given** the monthly digest is enabled, **When** the user sets the monthly digest day to "last", **Then** the value persists and the monthly digest sends on the last day of the month.

---

### User Story 2 - Toggle instant pings and reminder lead time (Priority: P2)

Max or Jaz turns ntfy completion pings on or off and adjusts how many minutes before a timed event the calendar reminder pops, without touching the Sheet.

**Why this priority**: These are simple, high-value toggles/values that round out the everyday preferences, but they change less often than the digest schedule.

**Independent Test**: Toggle ntfy pings off, change the reminder minutes to 15, save, reload, and confirm both values persisted and were logged.

**Acceptance Scenarios**:

1. **Given** ntfy pings are enabled, **When** the user turns them off and saves, **Then** completing a task no longer sends a ping.
2. **Given** the reminder lead time is 30 minutes, **When** the user changes it to 15 and saves, **Then** newly synced timed events use a 15-minute reminder.

---

### User Story 3 - Change household timezone (Priority: P3)

Max or Jaz changes the household timezone from the Settings screen; all date handling across the app follows the new zone.

**Why this priority**: Timezone almost never changes (one household, one locale) but must be editable somewhere other than the raw Sheet, and it is the highest-blast-radius setting so it belongs behind the same curated form.

**Independent Test**: Change the timezone to a different valid zone, save, reload, and confirm dates render in the new zone and the value persisted with a log entry.

**Acceptance Scenarios**:

1. **Given** the timezone is `America/Los_Angeles`, **When** the user selects a different valid timezone and saves, **Then** the value persists and subsequent date displays use the new zone.

---

### Edge Cases

- **Invalid input**: A reminder-minutes value that is negative or non-numeric, a digest hour outside 0–23, or a monthly day outside the allowed set MUST be rejected with a clear message and MUST NOT be written to the Sheet.
- **Unsupported timezone**: An unrecognized timezone string MUST be rejected rather than silently accepted (which would break all date handling).
- **Digest hour vs. trigger**: Changing the digest hour moves the daily digest trigger to the new hour as part of the same save (FR-010a), so the change takes full effect with no manual step. If trigger re-installation fails (e.g. transient scope/quota error), the save MUST report the failure rather than silently leaving the trigger at the old hour.
- **Concurrent edits**: If Max and Jaz save overlapping changes near-simultaneously, the last write wins per field and neither save corrupts the Settings tab (writes are serialized).
- **Partial save failure**: If the save request fails (network/backend), the form surfaces the error and does not falsely report success; on-screen values reflect what is actually persisted after a reload.
- **Non-curated keys untouched**: Saving from this form MUST NOT alter or clear any Settings key that is not one of the curated, in-scope fields (e.g. emails, topics, calendar IDs, weather/work-calendar keys).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a Settings screen reached from the More section, presented as a curated form (labeled fields with appropriate controls), not a raw key–value editor.
- **FR-002**: The Settings screen MUST load and display the current values of the in-scope settings on open.
- **FR-003**: Users MUST be able to enable/disable the weekly digest and set its send day (a weekday).
- **FR-004**: Users MUST be able to enable/disable the monthly digest and set its send day-of-month (a day 1–28 or "last").
- **FR-005**: Users MUST be able to set the digest send hour (0–23 in the household timezone).
- **FR-006**: Users MUST be able to enable/disable ntfy instant completion pings.
- **FR-007**: Users MUST be able to set the default calendar event reminder lead time in minutes (non-negative integer).
- **FR-008**: Users MUST be able to set the household timezone by choosing from a curated dropdown of relevant US timezones (Pacific, Mountain, Central, Eastern, Arizona, Hawaii); the control cannot produce an invalid zone.
- **FR-009**: The system MUST validate every field before persisting and reject invalid values with a field-level message, leaving the stored value unchanged.
- **FR-010**: Saving MUST persist the accepted values to the Settings tab via a single backend update action (`settings.update`) triggered by one "Save" button; the call writes only the in-scope keys and leaves all other Settings keys untouched.
- **FR-010a**: When the saved digest hour differs from the currently installed value, `settings.update` MUST re-install the daily digest trigger to the new hour so the schedule change takes full effect with no manual step.
- **FR-011**: The `settings.update` action MUST be idempotent (re-saving identical values is safe) and safe under concurrent writes.
- **FR-012**: Every successful settings change MUST append an entry to ActivityLog (timestamp, actor, action, target) identifying that settings were updated.
- **FR-013**: The editor MUST NOT expose or allow editing of allowlist emails (`maxEmail`, `jazEmail`, `sharedEmails`) or ntfy topic names (`ntfyTopicMax`, `ntfyTopicJaz`); these remain Sheet-only.
- **FR-014**: The editor MUST reflect saved values after a reload (persistence is real, not local-only), and MUST show whether a save succeeded or failed.
- **FR-015**: Only allowlisted, authenticated users (Max, Jaz, or the shared account resolved to a person) may perform `settings.update`; the same auth/allowlist gate as all other writes applies.

### Key Entities *(include if feature involves data)*

- **Household Settings (in-scope subset)**: The curated preferences editable here — weekly digest on/off + day, monthly digest on/off + day, digest hour, ntfy pings on/off, calendar reminder minutes, timezone. Each maps to an existing Settings-tab key. All other Settings keys are out of scope and untouched.
- **ActivityLog entry**: A record of the change (when, who, what action, which target) appended on every successful save.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change any in-scope setting and confirm it persisted (survives reload) without ever opening the Google Sheet.
- **SC-002**: 100% of successful saves append exactly one corresponding ActivityLog entry.
- **SC-003**: Invalid input is rejected 100% of the time before it reaches the Sheet, with no partial or corrupt writes.
- **SC-004**: Saving in-scope settings never changes any out-of-scope Settings key (verified by comparing the full Settings tab before/after a save).
- **SC-005**: A user can complete a typical settings change (open → edit one field → save → confirmation) in under 30 seconds.

## Assumptions

- **In-scope keys** map to existing Settings-tab keys: `digestWeeklyEnabled`, `digestWeeklyDay`, `digestMonthlyEnabled`, `digestMonthlyDay`, `digestHour`, `ntfyEnabled`, `gcalEventReminderMin`, and `timezone`. No new Settings keys are introduced.
- **Out of scope / Sheet-only for safety**: emails (`maxEmail`, `jazEmail`, `sharedEmails`), ntfy topics (`ntfyTopicMax`, `ntfyTopicJaz`), calendar IDs, and weather/work-calendar keys (feature 011). These are not shown in the editor.
- **Digest-hour trigger**: The digest is gated by a daily time-driven trigger installed at a fixed hour. `settings.update` re-installs that trigger to the new hour whenever `digestHour` changes (FR-010a), so no manual re-install is needed.
- **Timezone** is chosen from a curated dropdown of relevant US zones (Pacific/Mountain/Central/Eastern/Arizona/Hawaii) rather than free-typed, so an invalid identifier that would break date handling cannot be entered.
- **Two users only**: no roles or per-user settings scopes — these are shared household settings; either user edits the same values.
- The change appends a single ActivityLog entry per save (a save may update multiple fields at once and still logs as one settings-update action), consistent with existing write conventions.
