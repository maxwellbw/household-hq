/**
 * Config.js — committed constants for the Household HQ backend.
 *
 * The repo is private, so IDs live here as plain constants (research D8): one config
 * file, no Script Properties, no hidden state. All other files read from these globals.
 */

// ---------------------------------------------------------------------------
// Spreadsheet + API identity
// ---------------------------------------------------------------------------

/**
 * The "Household HQ DB" Google Sheet ID (from its URL:
 * https://docs.google.com/spreadsheets/d/<THIS>/edit). Created in initial-setup.md
 * Phase 6. Paste the real ID before deploying (initial-setup.md Phase 7 / quickstart §1).
 */
var SPREADSHEET_ID = '1ypXomTO5s1PHlRMDBJ52kKuvrBzQDz0pXfWQcUBtHqE';

/** Bumped only for shape-level API changes (contracts/api.md §Versioning). */
var API_VERSION = '1.3.2';

/** Returned by the health ping so clients can identify the service. */
var SERVICE_NAME = 'household-hq';

/**
 * The app's Google **Web** OAuth client ID (feature 002; research A2). Every ID token's
 * `aud` must equal this exactly. Public value — client IDs are not secrets, so it lives
 * here as a committed constant like SPREADSHEET_ID (D8). Created once in the Cloud Console
 * (quickstart §1); reused by feature 006's sign-in. Empty ⇒ every token fails closed.
 */
var OAUTH_CLIENT_ID = '802775492061-kg5jrp6r84c6e4g1pech6m3q1fk1qi70.apps.googleusercontent.com';

/** Fallback when Settings has no timezone yet (FR-009). */
var DEFAULT_TIMEZONE = 'America/Los_Angeles';

/** Script-lock wait before returning BUSY (research D4). */
var LOCK_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// Tabs (tables) — the six-tab schema (FR-001)
// ---------------------------------------------------------------------------

var TABS = {
  EVENTS: 'Events',
  TASKS: 'Tasks',
  TEMPLATES: 'TaskTemplates',
  RECURRING: 'Recurring',
  ACTIVITY_LOG: 'ActivityLog',
  SETTINGS: 'Settings'
};

/**
 * Required header names per tab, in provisioned column order (data-model.md). The app
 * maps columns by name, never by position (research D3); a missing/renamed required
 * header raises SCHEMA_MISMATCH. Hand-added extra columns are ignored and preserved.
 */
var HEADERS = {
  Events: ['id', 'title', 'start', 'end', 'owner', 'type', 'templateId', 'notes', 'gcalEventId',
           'prepGeneratedFor'],
  Tasks: ['id', 'title', 'dueDate', 'owner', 'status', 'eventId', 'recurringId',
          'completedBy', 'completedAt', 'snoozeHistory', 'listItems', 'gcalEventId'],
  TaskTemplates: ['id', 'eventType', 'taskTitle', 'offsetDays', 'defaultOwner'],
  Recurring: ['id', 'title', 'cadence', 'anchorDate', 'defaultOwner', 'lastGenerated',
              'seasonStart', 'seasonEnd'],
  ActivityLog: ['timestamp', 'actor', 'action', 'targetId', 'detail'],
  Settings: ['key', 'value', 'notes']
};

/** Tabs whose rows carry a UUID `id` (eligible for blank-ID adoption, FR-022). */
var ID_TABS = [TABS.EVENTS, TABS.TASKS, TABS.TEMPLATES, TABS.RECURRING];

// ---------------------------------------------------------------------------
// Enumerations (FR-014)
// ---------------------------------------------------------------------------

var OWNERS = ['max', 'jaz', 'both'];
var STATUSES = ['open', 'done', 'snoozed'];
var CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

// ---------------------------------------------------------------------------
// Feature 003 — task slices + activity feed (contracts/api-003.md; research D4/D5)
// ---------------------------------------------------------------------------

/** Named task slices for `tasks.list`; resolved server-side from the verified caller. */
var TASK_FILTERS = ['mine', 'theirs', 'ours', 'all', 'default'];

/** Feed bound (research D5): a generous default covering weeks, a hard cap on payload size. */
var FEED_DEFAULT_LIMIT = 200;
var FEED_MAX_LIMIT = 500;

/**
 * Feed `summary` composition maps (research D5). An actor/action not listed here (e.g. a
 * hand-edited ActivityLog value) falls back to its raw string — the feed never crashes on
 * an unknown value (FR-013 Edge Cases).
 */
var ACTOR_DISPLAY_NAMES = { max: 'Max', jaz: 'Jaz', system: 'System' };
var ACTION_VERBS = {
  create: 'added', update: 'edited', complete: 'completed', reopen: 'reopened',
  delete: 'deleted', 'adopt-id': 'assigned an id to', provision: 'set up',
  'gcal-sync': 'synced to calendar', 'digest-weekly': 'emailed the week ahead',
  'digest-monthly': 'emailed the month ahead', 'ntfy-ping': 'sent a completion ping',
  snooze: 'snoozed', unsnooze: 'un-snoozed'
};

/** feature 009 — free, keyless push-notification host; a platform choice, not household data. */
var NTFY_BASE_URL = 'https://ntfy.sh';

/**
 * A write action mutates the Sheet. Shared-account callers must confirm an acting-person
 * on these (feature 002 FR-014/A5); reads and `auth.whoami` do not. Any `*.create`,
 * `*.update`, or `*.delete` counts.
 */
function isWriteAction_(action) {
  return /\.(create|update|delete|complete|reopen|snooze|unsnooze)$/.test(String(action));
}

/**
 * Typed fields per tab, driving both write validation (reject) and read warnings
 * (surface, don't drop — FR-020). Types: text | date | datetime | owner | status |
 * cadence | int | month. Untyped columns are free text.
 */
var FIELD_TYPES = {
  Events: { start: 'datetime', end: 'datetime', owner: 'owner' },
  Tasks: { dueDate: 'date', owner: 'owner', status: 'status', completedAt: 'datetime' },
  TaskTemplates: { offsetDays: 'int', defaultOwner: 'owner' },
  Recurring: { cadence: 'cadence', anchorDate: 'date', defaultOwner: 'owner',
               lastGenerated: 'date', seasonStart: 'month', seasonEnd: 'month' }
};

/** Fields required to create a record (only Events/Tasks are API-writable in 001). */
var REQUIRED_ON_CREATE = {
  Events: ['title', 'start', 'end', 'owner'],
  Tasks: ['title', 'owner'],
  Recurring: ['title', 'cadence', 'anchorDate', 'defaultOwner'],
  TaskTemplates: ['eventType', 'taskTitle', 'offsetDays', 'defaultOwner']
};

// ---------------------------------------------------------------------------
// Feature 004 — recurring chore engine (research D6/D7)
// ---------------------------------------------------------------------------

/** Fallback lookahead (days) when Settings' recurringLookaheadDays is blank/≤0 (FR-016). */
var RECURRING_LOOKAHEAD_DEFAULT_DAYS = 30;

/** Hour (household tz) the nightly generator trigger runs at (research D7). */
var RECURRING_TRIGGER_HOUR = 3;

// ---------------------------------------------------------------------------
// Feature 005 — events and prep templates (research D7)
// ---------------------------------------------------------------------------

/** Hour (household tz) the nightly prep-reconcile trigger runs at; offset from 004's
 *  RECURRING_TRIGGER_HOUR so the two nightly jobs don't contend (research D7). */
var PREP_TRIGGER_HOUR = 4;

// ---------------------------------------------------------------------------
// Feature 007 — Google Calendar sync (research D4/D8)
// ---------------------------------------------------------------------------

/** Hour (household tz) the nightly calendar-reconcile trigger runs at; offset from 004's
 *  and 005's hours so the three nightly jobs don't contend (research D8). */
var GCAL_TRIGGER_HOUR = 5;

/**
 * Owner → Google Calendar event color (research D4): the closest fixed `EventColor` to each
 * DESIGN.md owner hue. Google's per-event palette is a fixed set, so exact hex values aren't
 * reproducible — these are the nearest matches (Max: pine teal → Peacock/CYAN, Jaz: berry/plum
 * → Grape/MAUVE, Both: terracotta → Tangerine/ORANGE).
 */
var OWNER_EVENT_COLOR = {
  max: CalendarApp.EventColor.CYAN,
  jaz: CalendarApp.EventColor.MAUVE,
  both: CalendarApp.EventColor.ORANGE
};

// ---------------------------------------------------------------------------
// Feature 008 — email digests (research D1/D4)
// ---------------------------------------------------------------------------

/** Fallback hour (household tz) the daily digest gate runs at, if `digestHour` is
 *  blank/invalid; offset from 004/005/007's 3/4/5 so the nightly jobs don't contend. The
 *  seeded `digestHour` Settings value (below) is the normal source of truth. */
var DIGEST_TRIGGER_HOUR = 6;

/** Owner → inline HTML color for digest emails (DESIGN.md owner hues; email clients strip
 *  external CSS, so these are applied inline at render time — research D4). */
var OWNER_EMAIL_HUE = {
  max: '#3E6E68',
  jaz: '#7E4A5E',
  both: '#C6613F'
};

// ---------------------------------------------------------------------------
// Settings seed (data-model.md §Settings). [key, value, notes]; seeded only when the
// key is absent, so hand-filled values (e.g. maxEmail) are never overwritten.
// ---------------------------------------------------------------------------

var SETTINGS_SEED = [
  ['maxEmail', '', 'feature 002; Google email that maps to identity "max"'],
  ['jazEmail', '', 'feature 002; Google email that maps to identity "jaz"'],
  ['sharedEmails', '', 'feature 002; "; "-delimited shared account(s); auth ok, writes need actingPerson'],
  ['timezone', 'America/Los_Angeles', 'household timezone for all date handling'],
  ['householdCalendarId', '', 'feature 007'],
  ['gcalEventReminderMin', '30', 'feature 007; popup minutes before a timed event'],
  ['gcalTaskReminderTime', '09:00', 'feature 007; morning-of popup time for all-day task entries'],
  ['digestWeeklyEnabled', 'TRUE', 'feature 008; FALSE turns off the weekly "week ahead" email'],
  ['digestWeeklyDay', 'Sunday', 'feature 008; weekday the weekly digest sends (name or 0-6, Sun=0)'],
  ['digestMonthlyEnabled', 'TRUE', 'feature 008; FALSE turns off the monthly "next month" email'],
  ['digestMonthlyDay', 'last', 'feature 008; day-of-month the monthly digest sends ("last" or 1-28)'],
  ['digestHour', '7', 'feature 008; hour (household tz) the daily digest gate fires; re-run installDigestTrigger() after changing'],
  ['ntfyTopicMax', '', 'feature 009'],
  ['ntfyTopicJaz', '', 'feature 009'],
  ['ntfyEnabled', 'TRUE', 'feature 009; FALSE turns off completion pings'],
  ['workIcsUrlMax', '', 'feature 011'],
  ['workIcsUrlJaz', '', 'feature 011'],
  ['householdLat', '', 'feature 011'],
  ['householdLon', '', 'feature 011'],
  ['weatherHeatF', '80', 'feature 011'],
  ['weatherMorningCutoff', '10:00', 'feature 011'],
  ['weatherPrecipPct', '40', 'feature 011'],
  ['weatherColdFloorF', '25', 'feature 011'],
  ['recurringLookaheadDays', '30',
    'feature 004; days ahead the nightly generator materializes. Blank/≤0 falls back to 30']
];
