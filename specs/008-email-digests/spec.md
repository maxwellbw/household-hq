# Feature Specification: Email Digests (email-digests)

**Feature Branch**: `008-email-digests`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Email digests: a personalized-per-recipient Sunday 'week ahead' email and an end-of-month 'next month' email, sent via MailApp on time-driven triggers. Each recipient (Max, Jaz) gets their own email summarizing upcoming events and dated/assigned tasks relevant to them from the household Sheet. Schedule configurable in Settings."

## Clarifications

### Session 2026-07-09

- Q: Beyond a person's own + `both` items, should their digest also show the other person's solo items? → A: **Own + both only** — strictly relevant; the other person's solo items never appear in a recipient's digest.
- Q: How should the digest emails be formatted (owner color-coding is a core design principle)? → A: **HTML with owner colors** — rich HTML body carrying the Max/Jaz/Both identity hues and date grouping, with a plain-text fallback.
- Q: How much of the send schedule should Settings expose for hand-editing? → A: **Configurable day + time** — the household picks the weekly send weekday/time and the monthly send day-of-month as editable Settings values the triggers read (with sensible defaults if blank/invalid).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sunday "week ahead" email, personalized per person (Priority: P1)

Every Sunday, Max and Jaz each receive their own email that lays out the coming week: the events on the household calendar for the next seven days and the dated tasks due in that window, with each person's own responsibilities front and center. Max opens his and sees the concert Friday (owner: both), his dentist appointment Wednesday (owner: max), and the two chores due this week that are his. Jaz opens hers and sees the same shared events but her own tasks, not Max's solo ones. Neither has to open the app or ask the other "what's this week look like?" — the week arrives in their inbox.

**Why this priority**: This is the core of the feature and the brief's stated Phase 2 payoff — a low-effort weekly heads-up that makes the household's week legible without opening the app. Shipping just the weekly email is a complete, useful slice: the household gains a shared sense of the week ahead even if the monthly email is never built.

**Independent Test**: Populate the Sheet with events and dated tasks spanning the next week (a mix of max / jaz / both owners) plus some outside the window. Run the weekly digest. Confirm two emails are produced — one addressed to Max, one to Jaz — each listing the shared and own-owner items due in the next seven days, in date order, and excluding items outside the window and items owned solely by the other person.

**Acceptance Scenarios**:

1. **Given** events and dated tasks exist in the Sheet covering the next seven days, **When** the weekly digest runs, **Then** Max receives one email and Jaz receives one email, each at their own personal address from Settings.
2. **Given** an event owned by `both`, **When** the weekly digest runs, **Then** it appears in both Max's and Jaz's emails.
3. **Given** a task owned by `max`, **When** the weekly digest runs, **Then** it appears in Max's email and not in Jaz's.
4. **Given** an event dated more than seven days out, **When** the weekly digest runs, **Then** it does not appear in either weekly email.
5. **Given** items span several days, **When** the digest is composed, **Then** they are presented grouped/ordered by date so the reader scans the week top to bottom.
6. **Given** the digest run completes, **When** the activity log is inspected, **Then** the send of each person's weekly digest is recorded.

---

### User Story 2 - End-of-month "next month" email, personalized per person (Priority: P2)

Near the end of each month, Max and Jaz each receive their own email previewing the month ahead: the events scheduled and the dated tasks due across all of next calendar month, again with their own items emphasized. This gives a longer-horizon glance — the trip in three weeks, the quarterly air-filter change, the birthday — while there is still time to plan around it.

**Why this priority**: Adds a longer planning horizon on top of the weekly rhythm. It is additive and reuses the same per-person filtering and email machinery as Story 1, so it ships second; the household already has value from the weekly email alone.

**Independent Test**: Populate the Sheet with events and dated tasks across next calendar month (mixed owners) and some in the current month and the month after next. Run the monthly digest. Confirm each person receives one email covering exactly next calendar month's items relevant to them, excluding this month's and the following month's.

**Acceptance Scenarios**:

1. **Given** events and dated tasks exist across next calendar month, **When** the monthly digest runs, **Then** Max and Jaz each receive one email covering next month's items relevant to them.
2. **Given** an item dated in the current month or two months out, **When** the monthly digest runs, **Then** it is excluded from the "next month" email.
3. **Given** a `both`-owned item next month, **When** the monthly digest runs, **Then** it appears in both people's monthly emails.
4. **Given** the monthly digest run completes, **When** the activity log is inspected, **Then** each person's monthly digest send is recorded.

---

### User Story 3 - Digests run unattended, are configurable, and degrade gracefully (Priority: P3)

The digests fire on their own on a schedule the household can adjust or turn off from Settings, without touching code. If a person has nothing relevant in the window, their email says so plainly rather than breaking or sending a confusing blank. If a recipient's email address is missing from Settings, that person is simply skipped and the other still gets theirs. A scheduled run that fails does not double-send when the schedule fires again.

**Why this priority**: Makes the feature safe to leave running and adjustable by the users themselves, consistent with the project's hand-editable-Settings principle. It is a robustness/quality layer over the two email types, so it comes last.

**Independent Test**: With the schedule set in Settings, confirm the digest fires at the configured time. Set one person's email blank and confirm only the other is emailed. Run a weekly digest for a week with no relevant items for one person and confirm that person's email is a friendly "nothing on the calendar this week" note. Re-run the same period and confirm no duplicate email is sent.

**Acceptance Scenarios**:

1. **Given** the household changes the digest schedule value in Settings, **When** the schedule is next applied, **Then** the digests fire according to the new configuration.
2. **Given** a person has no relevant items in the window, **When** their digest is composed, **Then** they still receive an email that clearly states there is nothing scheduled, rather than an empty or broken message.
3. **Given** a person's personal email is blank in Settings, **When** the digest runs, **Then** that person is skipped without error and the other person still receives their email.
4. **Given** a weekly (or monthly) digest for a given period has already been sent, **When** the same period's digest is triggered again, **Then** the recipients are not emailed a duplicate for that period.
5. **Given** digests are turned off in Settings, **When** the schedule fires, **Then** no emails are sent.

---

### Edge Cases

- **Nothing in the window**: the email is still sent with a friendly empty-state message (per US3), not skipped silently, so the reader knows the system is alive and the week is genuinely clear.
- **Missing recipient email**: a blank `maxEmail`/`jazEmail` in Settings skips only that person; the run does not error.
- **Blank or invalid schedule**: if the schedule setting is unset, the feature falls back to a sensible default (Sunday morning weekly; last days of the month for the monthly) rather than never sending.
- **All-day vs. timed events**: timed events show their time; all-day events and dated tasks (which are date-only) show just the date, in the household timezone.
- **Completed / deleted tasks**: a task already completed or deleted before the digest runs does not appear.
- **Duplicate prevention across a long trigger window**: if the platform fires the schedule slightly more than once, or a run is retried, the same period is not emailed twice.
- **Item on the boundary date**: an item due exactly seven days out (weekly) or on the first/last day of next month (monthly) is included unambiguously per a stated inclusive/exclusive rule.
- **Timezone**: "this week" and "next month" boundaries are computed in the single household timezone from Settings, not the server's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST produce a weekly "week ahead" digest covering household events and dated tasks due within the next seven days from the day the digest runs.
- **FR-002**: The system MUST produce a monthly "next month" digest covering household events and dated tasks dated within the entirety of the next calendar month.
- **FR-003**: Each digest MUST be personalized per recipient: Max and Jaz each receive their own email containing the items relevant to them.
- **FR-004**: An item's relevance to a recipient MUST be determined by owner — an item owned by that person or by `both` is included; an item owned solely by the other person is excluded and MUST NOT appear anywhere in that recipient's digest.
- **FR-005**: Each digest MUST be sent to the recipient's own personal email address as recorded in Settings (not the shared household account).
- **FR-006**: Items within a digest MUST be presented ordered by date so the reader can scan the period chronologically.
- **FR-007**: Each item line MUST convey enough to be actionable at a glance: its title, its date (and time for timed events), and its owner.
- **FR-007a**: The email body MUST be formatted as HTML that carries the app's owner color coding (Max / Jaz / Both identity hues) and groups items by date, and MUST include a plain-text fallback for clients that do not render HTML.
- **FR-008**: The digest schedule MUST be configurable from Settings by hand: the weekly send weekday and time-of-day, and the monthly send day-of-month, are editable Settings values the triggers read; blank/invalid values fall back to sensible defaults. Settings MUST also allow digests (weekly and monthly independently) to be turned off, without editing code.
- **FR-009**: When a recipient has no relevant items in the window, the system MUST still send that recipient a clear empty-state email rather than skipping or sending a blank message.
- **FR-010**: When a recipient's personal email is missing from Settings, the system MUST skip that recipient without error and still deliver the other recipient's email.
- **FR-011**: The system MUST NOT send a recipient a duplicate digest for a period it has already sent for that recipient (safe to re-run / re-fire).
- **FR-012**: Every digest send MUST be appended to the activity log (timestamp, actor, action, target), consistent with the project's "every state change is logged" principle.
- **FR-013**: All date/window boundaries ("next seven days", "next calendar month") MUST be computed in the single household timezone from Settings.
- **FR-014**: Completed or deleted tasks, and past-dated items, MUST NOT appear in a digest window.
- **FR-015**: The digests MUST run unattended on time-driven schedules with no user action required to fire them.

### Key Entities *(include if feature involves data)*

- **Digest (weekly / monthly)**: a per-recipient, per-period composed summary. Derived at send time from current Sheet data — not stored as a table. Attributes: recipient (max/jaz), period type (weekly/monthly), window start/end, list of relevant events, list of relevant dated tasks.
- **Recipient**: one of the two people (Max, Jaz), each with a personal email address in Settings. The shared household account is never a digest recipient.
- **Settings (digest configuration)**: hand-editable configuration — the digest schedule / on-off control, plus the existing per-person emails and household timezone this feature reads.
- **Activity log entry**: a record appended per digest send, for auditability and completion awareness.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On any given Sunday, each of the two people receives exactly one weekly email addressed to them containing every relevant event and dated task due in the next seven days, and no items owned solely by the other person and no items outside the window.
- **SC-002**: Near month-end, each of the two people receives exactly one monthly email containing every relevant item dated in next calendar month and none dated outside it.
- **SC-003**: A reader can understand the entire period from the email alone — every listed item shows title, date/time, and owner — without opening the app.
- **SC-004**: Re-running or re-firing the same period's digest results in zero duplicate emails to any recipient.
- **SC-005**: With one person's email blank in Settings, the other person still receives their digest and the run completes without error.
- **SC-006**: A digest for a window with no relevant items still arrives as a clear "nothing scheduled" email 100% of the time (never a blank or errored send).
- **SC-007**: The household can change the send schedule, or turn digests off, entirely by editing the Sheet, with the change taking effect on the next scheduled evaluation and no code change.

## Assumptions

- **Personalization is strict owner-filtering.** Each person's digest includes only items owned by them or by `both`; the other person's solo items never appear (resolved in Clarifications).
- **Emails are HTML with owner colors + a plain-text fallback** (resolved in Clarifications), reusing the app's Max / Jaz / Both identity hues.
- **The send schedule is hand-editable in Settings** — weekly weekday + time, monthly day-of-month, and independent on/off for weekly and monthly (resolved in Clarifications) — with code-level defaults when a value is blank or invalid.
- **Recipients are the two personal emails** (`maxEmail`, `jazEmail`) already in Settings from feature 002; the shared account is never a recipient (consistent with [[allowlist-three-emails]] — shared is never an actor).
- **Weekly cadence is Sunday** (per the brief's "Sunday 'week ahead'"), and the weekly window is the seven days beginning the send day. Monthly cadence fires near the end of the current month and covers the whole next calendar month. Exact send times default sensibly (e.g. Sunday morning) and are adjustable via the Settings schedule.
- **Dated tasks only.** Tasks with no due date never appear in a digest (they have no date to place in a window), consistent with feature 007's calendar-sync treatment.
- **Content source is the live Sheet** (Events + Tasks tabs) read at send time; the digest stores no state of its own beyond whatever minimal marker is needed to prevent duplicate sends.
- **Reuses the existing owner model** (`max`/`jaz`/`both`) and the single household timezone from Settings; introduces no new owner or recipient concepts.
- **Volume is tiny** — two recipients, a handful of items per week — so there are no performance, batching, or rate-limit concerns beyond the platform's own quotas.
- **One-way, outbound only.** Digests are informational emails; there is no reply-parsing or inbound email handling in this feature (quick-add-by-email is a separate later feature).
