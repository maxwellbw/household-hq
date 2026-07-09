# Household HQ — Project Brief

*Seed document for Spec Kit (`/speckit.constitution` and `/speckit.specify`). Working name: Household HQ (rename freely).*

## 1. Purpose

A lightweight, two-user household manager for Max and Jaz. The core goal is to reduce mental load — especially the invisible work of remembering — by making household events, chores, and prep work visible, assignable, and shared. Not a general-purpose product; optimized ruthlessly for exactly two known users.

## 2. Users & Identity

- Exactly two users, each signing in with their personal Google account.
- Allowlist of two email addresses stored in config; anyone else is rejected.
- The app always knows who is logged in and defaults views to "my stuff + our stuff."
- Every task and event has an owner: `max` | `jaz` | `both`.

## 3. Architecture (decided)

- **Database:** one Google Sheet (tabs = tables). Human-inspectable; either user can open the raw sheet.
- **Backend:** Google Apps Script deployed as a web app serving JSON (`doGet`/`doPost`). Handles auth verification (Google ID token → allowlist check), CRUD, recurrence materialization, calendar sync, and email digests via time-driven triggers.
- **Frontend:** static Vite + React + Tailwind + shadcn/ui app, hosted on GitHub Pages, installable as a PWA. Calendar view via FullCalendar or Schedule-X.
- **Why not pure Apps Script HTML Service:** it renders in a sandboxed iframe — no service workers, so no PWA and no push notifications, and a poor dev loop.
- **Repo:** single GitHub monorepo — `/frontend`, `/backend` (synced with clasp), `/specs` (Spec Kit artifacts), root-level `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`.
- **Deploys:** GitHub Action → GitHub Pages for frontend; manual `clasp push && clasp deploy` for backend (CI later if desired).

## 4. Data Model (Sheet tabs)

| Tab | Purpose | Key fields (draft) |
|---|---|---|
| Events | Calendar items | id, title, start, end, owner (max/jaz/both), type, templateId?, notes, gcalEventId? |
| Tasks | All actionable items | id, title, dueDate, owner, status (open/done/snoozed), eventId?, recurringId?, completedBy, completedAt, snoozeHistory, listItems? |
| TaskTemplates | Reusable prep checklists for event types | id, eventType, taskTitle, offsetDays (e.g. −2), defaultOwner |
| Recurring | Recurrence rules for chores | id, title, cadence (weekly/biweekly/monthly/quarterly/annually), anchorDate, defaultOwner, lastGenerated |
| ActivityLog | Feed of who did what, when | timestamp, actor, action, targetId, detail |
| Settings | Config | allowlisted emails, shared calendar id, digest schedule, ntfy topics, work calendar ICS URLs, household lat/lon, weather thresholds (heat, morning cutoff, precip %, cold floor) |

Design rule: the UI only ever renders Events and Tasks. Triggers do all generation (recurrence → task instances; event+template → dated prep tasks). Keeps the frontend dumb and the logic testable.

## 5. Features by Phase

### Phase 1 — Core (MVP)
1. Google sign-in + two-user allowlist.
2. Tasks: create/edit/complete/delete; assign to max/jaz/both; due dates; filter by "mine / theirs / ours / all."
3. Events: create/edit/delete with owner tagging (work trip = one person; concert = both).
4. Calendar view as the home screen — month + week, events and dated tasks together, color-coded by owner. This is the centerpiece; tasks visually associate with the events they lead up to.
5. Recurring chore engine: nightly trigger materializes upcoming instances (flea/tick meds monthly, mow lawn weekly in season, air filter quarterly, etc.).
6. Event prep templates: tag an event with a template ("guests visiting") → tasks auto-created at offsets (clean house T−2, groceries T−1).
7. Activity log + completion awareness: when one person completes a task, it appears in the other's feed.
8. Google Calendar sync: push events + dated tasks into a shared "Household" calendar → free native phone notifications from day one.

### Phase 2 — Comfort
9. Email digests: Sunday "week ahead" email; end-of-month "next month" email (MailApp + triggers), personalized per recipient.
10. Instant completion pings via ntfy.sh (each person subscribes to a private topic; Apps Script POSTs on completion).
11. Snooze/defer with visible history; guilt-free rescheduling.
12. Load-balance view: open tasks per person, completion counts — makes mental-load distribution visible.
13. Smart views: "Today," "This weekend," "Overdue."
14. Quick-add by email: forward/send to a monitored address; Gmail trigger parses into a task.

### Phase 3 — Stretch
15. Full PWA install + web push notifications (frontend is already PWA-ready).
16. Work calendar integration: read free/busy from work calendars (shared to personal accounts, or via private ICS URLs if corporate sharing is blocked) → "mutual free window" finder, e.g. midday dog-walk suggestions.
    - **Weather-aware:** fetch hourly forecast via Open-Meteo (free, no API key) for the household location. Filter candidate windows before intersecting with free/busy: if the daily high ≥ heat threshold (default 80°F), only suggest windows before a morning cutoff (default 10am); exclude hours with precipitation probability above threshold (default 40%); optional winter floor (default 25°F / icy conditions). Thresholds and lat/lon live in Settings. Each suggestion shows its forecast ("Thu 7:30–8:15am · 61°F · clear").
    - **Source calendars (decided for Max, TBD for Jaz):** Max's work account can share **full event details** (not just free/busy) and shares **directly to another Google account** — no private ICS URL needed. It shares to **`household@example.com`** (the shared household account that already owns the "Household" calendar and runs the Apps Script as "Execute as: Me"). So the Apps Script, running as that account, can read Max's work calendar via `CalendarApp.getCalendarById(...)`/`getEvents(...)` with no extra credentials. Jaz's work-calendar sharing capability is still TBD (may need the ICS fallback). Settings should therefore support **a list of source calendar IDs to read free/busy from** (per person), not only the ICS-URL field currently listed in §4.
    - **Busy/free classification (ignore-list):** certain event titles on a work calendar are *not really busy* and should count as **free** time for dog-walk scheduling. Match against a configurable, case-insensitive ignore-list in Settings (defaults e.g. `Focus time`, `Block`, `Busy`, `Hold`). An event whose title matches is treated as available. Keep the matching hand-editable in the Sheet.
    - **Auto-invite + auto-accept (dog-walk booking):** when a weather-good mutual-free window is found up to **3 weeks** into the future, the app should be able to **create a calendar event / send an invite** to both work calendars for the walk; each work calendar is expected to **auto-accept** invites (a rule the users configure on their own work calendars — Household HQ only sends the invite). This needs calendar **write** scope and event-creation with attendees, and must be **idempotent** (never double-book the same window; reuse a stored event id like the `gcalEventId` pattern from 007). Respect an on/off Setting so it can be run in suggest-only mode first.
    - **007 dependency note:** to avoid a re-authorization round-trip later, feature 007 should request a **broad enough Calendar OAuth scope** (`https://www.googleapis.com/auth/calendar` — read+write on all calendars the account can access) rather than a Household-calendar-only scope. Then 011 can read work calendars and create invites with no scope change / re-auth.
17. Streaks/history for recurring chores ("filter last changed 97 days ago").
18. Shopping/errand list items attached to tasks.

### Phase 4 — Someday (agent layer; keep data model compatible, build nothing yet)
19. Projects concept (e.g., "fence repair") grouping tasks and vendor threads.
20. Claude API-powered vendor outreach: draft quote-request emails via Gmail, parse replies into a comparison table, propose visit times from free/busy — human approves every send. (Phone calls: out of scope permanently.)

## 6. Design Direction (for DESIGN.md / Impeccable init)

- Inspiration: Claude desktop/web app. Warm cream/ivory background, terracotta/clay accent, high-contrast ink text, soft rounded cards, generous whitespace.
- Serif display headings, clean sans-serif UI text.
- Calendar-first layout; project-management features live in service of the calendar, not the other way around.
- Owner color coding: one hue for Max, one for Jaz, a blended/third treatment for Both — consistent across every view.
- Mobile-first (it's a phone app in practice), but comfortable on desktop.
- Tooling: Impeccable skill installed in Claude Code; run `/impeccable init` after repo setup, then use `/impeccable critique` and `/impeccable polish` per feature.

## 7. Constraints & Principles (feed into /speckit.constitution)

- Two users forever. No multi-tenant abstractions, no roles/permissions beyond the allowlist.
- The Sheet is the single source of truth and must remain human-readable/editable by hand without breaking the app.
- Free-tier only: GitHub Pages, Apps Script, ntfy.sh. No servers, no paid services (Claude API excepted, in Phase 4 only).
- Prefer boring, debuggable solutions; both users must be able to maintain it with Claude Code assistance.
- All generated tasks are idempotent — reruns of triggers never duplicate.
- Every state change is logged to ActivityLog.
- Spec-driven: no feature is built without a spec folder under /specs.

## 8. Open Questions (resolve before/during /speckit.clarify)

1. Can each work calendar be shared (even free/busy-only) to personal Google accounts, or do we need the ICS-URL fallback? → Each check with their employer.
2. Timezone handling: assume America/Los_Angeles everywhere, or store UTC? (Recommend: single configured household timezone.)
3. Should completing a "both" task require both to check it off, or does one completion close it? (Recommend: one completion closes it, log shows who.)
4. Seasonal recurrence (mow lawn: weekly, but April–October only) — supported in v1 or deferred?
5. Digest emails: one shared email vs. personalized per person? (Recommend: personalized.)
6. Name the app. (Household HQ is a placeholder.)

## 9. Setup Checklist (before first Claude Code session)

1. Create GitHub repo; add both users as collaborators.
2. `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` then `specify init . --ai claude` in the repo.
3. Write CLAUDE.md manually (Spec Kit doesn't generate it): point to constitution, /specs layout, clasp workflow, definition of done.
4. Create the Google Sheet; share with both accounts as editors.
5. Create Apps Script project bound to nothing (standalone), share with both accounts; `clasp clone` it into /backend.
6. Create the shared "Household" Google Calendar; share with both.
7. `npx impeccable install` in the repo; run `/impeccable init` in Claude Code.
8. Run `/speckit.constitution` using §7, then `/speckit.specify` per feature slice below.

## 10. Suggested Spec Kit Feature Slices

001 sheets-schema-and-api · 002 auth-allowlist · 003 tasks-crud-and-activity-log · 004 recurring-engine · 005 events-and-prep-templates · 006 calendar-ui · 007 gcal-sync · 008 email-digests · 009 ntfy-pings · 010 pwa-and-push · 011 weather-aware-walk-finder (free/busy ∩ Open-Meteo forecast)
