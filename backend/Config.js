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
var API_VERSION = '1.0.0';

/** Returned by the health ping so clients can identify the service. */
var SERVICE_NAME = 'household-hq';

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
  Events: ['id', 'title', 'start', 'end', 'owner', 'type', 'templateId', 'notes', 'gcalEventId'],
  Tasks: ['id', 'title', 'dueDate', 'owner', 'status', 'eventId', 'recurringId',
          'completedBy', 'completedAt', 'snoozeHistory', 'listItems'],
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
  Tasks: ['title', 'owner']
};

// ---------------------------------------------------------------------------
// Settings seed (data-model.md §Settings). [key, value, notes]; seeded only when the
// key is absent, so hand-filled values (e.g. allowedEmails) are never overwritten.
// ---------------------------------------------------------------------------

var SETTINGS_SEED = [
  ['allowedEmails', '', 'feature 002; "; "-delimited pair of allowed Google emails'],
  ['timezone', 'America/Los_Angeles', 'household timezone for all date handling'],
  ['householdCalendarId', '', 'feature 007'],
  ['digestSchedule', '', 'feature 008'],
  ['ntfyTopicMax', '', 'feature 009'],
  ['ntfyTopicJaz', '', 'feature 009'],
  ['workIcsUrlMax', '', 'feature 011'],
  ['workIcsUrlJaz', '', 'feature 011'],
  ['householdLat', '', 'feature 011'],
  ['householdLon', '', 'feature 011'],
  ['weatherHeatF', '80', 'feature 011'],
  ['weatherMorningCutoff', '10:00', 'feature 011'],
  ['weatherPrecipPct', '40', 'feature 011'],
  ['weatherColdFloorF', '25', 'feature 011']
];
