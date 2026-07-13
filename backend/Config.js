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
var API_VERSION = '1.4.0';

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
  SETTINGS: 'Settings',
  LISTS: 'Lists',
  LIST_ITEMS: 'ListItems',
  // Feature 025 — recurring events.
  RECURRING_EVENTS: 'RecurringEvents'
};

/**
 * Required header names per tab, in provisioned column order (data-model.md). The app
 * maps columns by name, never by position (research D3); a missing/renamed required
 * header raises SCHEMA_MISMATCH. Hand-added extra columns are ignored and preserved.
 */
var HEADERS = {
  Events: ['id', 'title', 'start', 'end', 'owner', 'type', 'templateId', 'notes', 'gcalEventId',
           'prepGeneratedFor', 'location', 'recurringEventId'],
  Tasks: ['id', 'title', 'dueDate', 'owner', 'status', 'eventId', 'recurringId',
          'completedBy', 'completedAt', 'snoozeHistory', 'listItems', 'gcalEventId',
          'notes', 'ackBy', 'ackAt', 'somedayRank'],
  // Feature 027: seedKey added for idempotent household seeding (data-model.md §1).
  TaskTemplates: ['id', 'eventType', 'taskTitle', 'offsetDays', 'defaultOwner', 'seedKey'],
  Recurring: ['id', 'title', 'cadence', 'anchorDate', 'defaultOwner', 'lastGenerated',
              'seasonStart', 'seasonEnd', 'seedKey'],
  ActivityLog: ['timestamp', 'actor', 'action', 'targetId', 'detail'],
  Settings: ['key', 'value', 'notes'],
  // Feature 024 — Grocery & household lists (data-model.md). seedKey added feature 027.
  Lists: ['id', 'name', 'seedKey'],
  ListItems: ['id', 'listId', 'name', 'status', 'section', 'staple', 'note', 'seedKey'],
  // Feature 025 — Recurring events (data-model.md). seedKey added feature 027.
  RecurringEvents: ['id', 'title', 'cadence', 'anchorDate', 'startTime', 'durationMinutes',
                     'defaultOwner', 'templateId', 'location', 'notes', 'seasonStart',
                     'seasonEnd', 'lastGenerated', 'seedKey']
};

/** Tabs whose rows carry a UUID `id` (eligible for blank-ID adoption, FR-022). */
var ID_TABS = [TABS.EVENTS, TABS.TASKS, TABS.TEMPLATES, TABS.RECURRING, TABS.LISTS,
               TABS.LIST_ITEMS, TABS.RECURRING_EVENTS];

// ---------------------------------------------------------------------------
// Enumerations (FR-014)
// ---------------------------------------------------------------------------

var OWNERS = ['max', 'jaz', 'both'];
var STATUSES = ['open', 'done', 'snoozed'];
/** Feature 027: `semiannually` mirrors sixweekly/eightweekly's fixed-step precedent (023).
 *  `thanksgiving-sat` is special-cased in `occurrencesInWindow_` (Recurring.js) to compute
 *  the Saturday before that year's US Thanksgiving instead of a fixed step. */
var CADENCES = ['weekly', 'biweekly', 'monthly', 'sixweekly', 'eightweekly', 'quarterly',
                 'annually', 'semiannually', 'thanksgiving-sat'];

/** Feature 024 — Grocery & household lists (data-model.md). */
var LIST_ITEM_STATUSES = ['need', 'stocked'];
/** Fixed order also drives the needed view's section grouping (FR-011). */
var LIST_SECTIONS = ['produce', 'dairy', 'frozen', 'pantry', 'household', 'other'];

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
  snooze: 'snoozed', unsnooze: 'un-snoozed', acknowledge: 'committed to',
  'settings-update': 'updated settings', 'rank-someday': 'ranked',
  'list-item-need': 'marked needed', 'list-item-stocked': 'marked stocked'
};

/** feature 009 — free, keyless push-notification host; a platform choice, not household data. */
var NTFY_BASE_URL = 'https://ntfy.sh';

/**
 * A write action mutates the Sheet. Shared-account callers must confirm an acting-person
 * on these (feature 002 FR-014/A5); reads and `auth.whoami` do not. Any `*.create`,
 * `*.update`, or `*.delete` counts.
 */
function isWriteAction_(action) {
  return /\.(create|update|delete|complete|reopen|snooze|unsnooze|acknowledge|rank|toggle)$/.test(String(action));
}

/**
 * Typed fields per tab, driving both write validation (reject) and read warnings
 * (surface, don't drop — FR-020). Types: text | date | datetime | datetimeOrDate | owner |
 * status | cadence | int | posint | month | time. Untyped columns are free text.
 */
var FIELD_TYPES = {
  // Feature 025: start/end accept a full datetime OR a date-only (all-day) value.
  Events: { start: 'datetimeOrDate', end: 'datetimeOrDate', owner: 'owner' },
  Tasks: { dueDate: 'date', owner: 'owner', status: 'status', completedAt: 'datetime',
           somedayRank: 'posint' },
  TaskTemplates: { offsetDays: 'int', defaultOwner: 'owner' },
  Recurring: { cadence: 'cadence', anchorDate: 'date', defaultOwner: 'owner',
               lastGenerated: 'date', seasonStart: 'month', seasonEnd: 'month' },
  ListItems: { status: 'listItemStatus', section: 'listSection', staple: 'bool' },
  // Feature 025 — recurring events (data-model.md).
  RecurringEvents: { cadence: 'cadence', anchorDate: 'date', startTime: 'time',
                      durationMinutes: 'posint', defaultOwner: 'owner',
                      seasonStart: 'month', seasonEnd: 'month', lastGenerated: 'date' }
};

/** Fields required to create a record (only Events/Tasks are API-writable in 001). */
var REQUIRED_ON_CREATE = {
  Events: ['title', 'start', 'end', 'owner'],
  Tasks: ['title', 'owner'],
  Recurring: ['title', 'cadence', 'anchorDate', 'defaultOwner'],
  TaskTemplates: ['eventType', 'taskTitle', 'offsetDays', 'defaultOwner'],
  Lists: ['name'],
  ListItems: ['listId', 'name'],
  RecurringEvents: ['title', 'cadence', 'anchorDate', 'defaultOwner']
};

// ---------------------------------------------------------------------------
// Feature 025 — recurring events (research D5/D6)
// ---------------------------------------------------------------------------

/** Fallback lookahead (days) when Settings' recurringEventsLookaheadDays is blank/≤0. */
var RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS = 60;

/** Hour (household tz) the nightly recurring-events generator trigger runs at; ahead of
 *  004's/005's hours so occurrences (and their prep) exist before every downstream job. */
var RECURRING_EVENTS_TRIGGER_HOUR = 2;

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
    'feature 004; days ahead the nightly generator materializes. Blank/≤0 falls back to 30'],
  ['recurringSeedApplied', '',
    'feature 015; "; "-delimited seed keys already applied by seedRecurringPack(); enables ' +
    'never-resurrect. Clear a key (and delete its row) by hand to re-enable seeding of that chore.'],
  ['groceryStapleNudgeThreshold', '3',
    'feature 024; count of staple ListItems marked "need" (across all lists) that triggers ' +
    'the Home dashboard shopping nudge'],
  ['recurringEventsLookaheadDays', '60',
    'feature 025; days ahead the nightly recurring-events generator materializes. Blank/≤0 falls back to 60'],
  ['listSeedApplied', '',
    'feature 027; "; "-delimited seed keys already applied by seedLists(); enables never-resurrect.'],
  ['templateSeedApplied', '',
    'feature 027; "; "-delimited seed keys already applied by seedTemplates(); enables never-resurrect.'],
  ['eventSeedApplied', '',
    'feature 027; "; "-delimited seed keys already applied by seedEvents(); enables never-resurrect.']
];

// ---------------------------------------------------------------------------
// Feature 020 — curated Settings editor: the only Settings keys writable via
// settings.update (emails, ntfy topics, calendar/weather keys stay Sheet-only).
// ---------------------------------------------------------------------------

var EDITABLE_SETTINGS = [
  'digestWeeklyEnabled', 'digestWeeklyDay', 'digestMonthlyEnabled', 'digestMonthlyDay',
  'digestHour', 'ntfyEnabled', 'gcalEventReminderMin', 'timezone',
  'groceryStapleNudgeThreshold'
];

/** Curated timezone choices for the editor (and the backend's allow-set for `timezone`). */
var SETTINGS_TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago',
  'America/New_York', 'America/Phoenix', 'Pacific/Honolulu'
];

// ---------------------------------------------------------------------------
// Feature 015 — recurring seed pack (research R1/R2/R4): starter home-maintenance chores
// plus alternating-week bin collection, seeded once by seedRecurringPack() (Seed.js).
// Anchors are placeholders computed relative to the seed run date; the household corrects
// them afterward. anchorRule ∈ 'today' | 'today+7' | 'fall-oct15' | 'fall-nov1'
// (see Seed.js `computeSeedAnchor_`).
// ---------------------------------------------------------------------------

var SEED_PACK = [
  { seedKey: 'trash', title: 'Trash', cadence: 'weekly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'recycling', title: 'Recycling', cadence: 'biweekly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'yardwaste', title: 'Yard waste', cadence: 'biweekly', anchorRule: 'today+7', defaultOwner: 'both' },
  { seedKey: 'hvac-filter', title: 'Change HVAC air filter', cadence: 'quarterly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'dishwasher-filter', title: 'Clean dishwasher filter', cadence: 'monthly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'gutters', title: 'Clean gutters', cadence: 'annually', anchorRule: 'fall-oct15', defaultOwner: 'both' },
  { seedKey: 'detector-batteries', title: 'Replace smoke/CO detector batteries', cadence: 'annually', anchorRule: 'fall-nov1', defaultOwner: 'both' },
  { seedKey: 'mow-lawn', title: 'Mow lawn', cadence: 'weekly', anchorRule: 'today', defaultOwner: 'both', seasonStart: 4, seasonEnd: 10 },
  // feature 023 — dog-care routine; year-round, all owned by both. Annual vet + vaccines
  // are out of scope (deferred to feature 025's yearly-recurrence work).
  { seedKey: 'flea-tick', title: 'Flea/tick meds', cadence: 'monthly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'heartworm', title: 'Heartworm meds', cadence: 'monthly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'nail-trim', title: 'Nail trim', cadence: 'sixweekly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'grooming', title: 'Grooming', cadence: 'eightweekly', anchorRule: 'today', defaultOwner: 'both' },
  // feature 027 — six-month cleans, staggered so no two land in the same calendar month
  // (docs/seed-data.md §4); dishwasher owned by Max, washing machine by Jaz, rest both.
  { seedKey: 'water-filter', title: 'Replace water filter', cadence: 'semiannually', anchorRule: 'today+2mo', defaultOwner: 'both' },
  { seedKey: 'clean-dishwasher', title: 'Clean dishwasher', cadence: 'semiannually', anchorRule: 'today+3mo', defaultOwner: 'max' },
  { seedKey: 'deep-clean', title: 'Deep clean', cadence: 'semiannually', anchorRule: 'today+4mo', defaultOwner: 'both' },
  { seedKey: 'clean-fridge', title: 'Clean fridge', cadence: 'semiannually', anchorRule: 'today+5mo', defaultOwner: 'both' },
  { seedKey: 'clean-oven', title: 'Clean oven', cadence: 'semiannually', anchorRule: 'today+6mo', defaultOwner: 'both' },
  { seedKey: 'clean-washing-machine', title: 'Clean washing machine', cadence: 'semiannually', anchorRule: 'today+7mo', defaultOwner: 'jaz' },
  // feature 027 — yard maintenance (docs/seed-data.md §5).
  { seedKey: 'leaf-cleanup', title: 'Leaf cleanup', cadence: 'biweekly', anchorRule: 'monthday-10-25', defaultOwner: 'both', seasonStart: 10, seasonEnd: 12 },
  { seedKey: 'rake-dirt-fence', title: 'Rake dirt away from fence', cadence: 'monthly', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'tree-trim-winter', title: 'Tree/shrub trim', cadence: 'annually', anchorRule: 'monthday-12-01', defaultOwner: 'both' },
  { seedKey: 'tree-trim-spring', title: 'Tree/shrub trim', cadence: 'annually', anchorRule: 'monthday-04-01', defaultOwner: 'both' },
  // feature 027 — holiday/seasonal + vet (docs/seed-data.md §6-§7).
  { seedKey: 'holiday-shopping', title: 'Start holiday shopping', cadence: 'annually', anchorRule: 'fall-nov1', defaultOwner: 'both' },
  { seedKey: 'christmas-lights', title: 'Put up Christmas lights', cadence: 'thanksgiving-sat', anchorRule: 'today', defaultOwner: 'both' },
  { seedKey: 'vet-annual', title: 'Call vet — schedule annual visit + vaccines', cadence: 'annually', anchorRule: 'monthday-10-01', defaultOwner: 'max' }
];

// ---------------------------------------------------------------------------
// Feature 027 — household seed data (docs/seed-data.md; data-model.md §5d): shopping
// lists + items, seeded once by seedLists() (Seed.js). Items carry explicit `status`
// (need/stocked) — seedLists() writes directly via createRecord_, bypassing
// createListItem_'s force-to-"need" + name-dedupe (those rules are for user-initiated
// adds, not a one-time historical load).
// ---------------------------------------------------------------------------

var LIST_SEED_PACK = {
  lists: [
    { seedKey: 'list-groceries', name: 'Groceries' },
    { seedKey: 'list-notgrocery', name: 'Not grocery' }
  ],
  items: [
    { seedKey: 'item-coffee', listSeedKey: 'list-groceries', name: 'Coffee', section: 'pantry', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-yasso-bars', listSeedKey: 'list-groceries', name: 'Yasso bars', section: 'frozen', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-popcorn', listSeedKey: 'list-groceries', name: 'Popcorn', section: 'pantry', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-tea', listSeedKey: 'list-groceries', name: 'Tea', section: 'pantry', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-pup-veggies', listSeedKey: 'list-groceries', name: 'Pup veggies', section: 'frozen', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-ice', listSeedKey: 'list-groceries', name: 'Ice', section: 'frozen', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-bubbly-water', listSeedKey: 'list-groceries', name: 'Bubbly water', section: 'pantry', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-eggs', listSeedKey: 'list-groceries', name: 'Eggs', section: 'dairy', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-yogurt', listSeedKey: 'list-groceries', name: 'Yogurt', section: 'dairy', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-frozen-berries', listSeedKey: 'list-groceries', name: 'Frozen berries', section: 'frozen', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-sweet-potato', listSeedKey: 'list-groceries', name: 'Sweet potato', section: 'produce', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-protein-pastry', listSeedKey: 'list-groceries', name: 'Protein pastry', section: 'pantry', staple: 'FALSE', status: 'need' },
    { seedKey: 'item-avocado', listSeedKey: 'list-groceries', name: 'Avocado', section: 'produce', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-pumpkin', listSeedKey: 'list-groceries', name: 'Pumpkin (canned, for pup)', section: 'pantry', staple: 'TRUE', status: 'need' },
    { seedKey: 'item-windex', listSeedKey: 'list-groceries', name: 'Windex', section: 'household', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-carrots', listSeedKey: 'list-groceries', name: 'Carrots', section: 'produce', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-jaz-protein-bars', listSeedKey: 'list-groceries', name: 'Jaz protein bars', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-pepper', listSeedKey: 'list-groceries', name: 'Pepper', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-face-lotion', listSeedKey: 'list-groceries', name: 'Face lotion', section: 'household', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-paper-towels', listSeedKey: 'list-groceries', name: 'Paper towels', section: 'household', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-toilet-paper', listSeedKey: 'list-groceries', name: 'Toilet paper', section: 'household', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-eggos', listSeedKey: 'list-groceries', name: 'Eggos', section: 'frozen', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-rice', listSeedKey: 'list-groceries', name: 'Rice', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-bachan-bbq', listSeedKey: 'list-groceries', name: 'Hot & spicy Bachan BBQ', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-dish-soap', listSeedKey: 'list-groceries', name: 'Dish soap', section: 'household', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-peanut-butter', listSeedKey: 'list-groceries', name: 'Peanut butter', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-oatmeal', listSeedKey: 'list-groceries', name: 'Oatmeal', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-orange', listSeedKey: 'list-groceries', name: 'Orange', section: 'produce', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-pears', listSeedKey: 'list-groceries', name: 'Pears', section: 'produce', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-body-wash', listSeedKey: 'list-groceries', name: 'Body wash', section: 'household', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-ziploc-sandwich', listSeedKey: 'list-groceries', name: 'Ziploc sandwich', section: 'household', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-hot-sauce-valentina', listSeedKey: 'list-groceries', name: 'Hot sauce (Valentina black label)', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-hand-soap-refill', listSeedKey: 'list-groceries', name: 'Hand soap refill', section: 'household', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-king-arthur-flour', listSeedKey: 'list-groceries', name: 'King Arthur all-purpose flour', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-tin-fish', listSeedKey: 'list-groceries', name: 'Tin fish', section: 'pantry', staple: 'FALSE', status: 'stocked' },
    { seedKey: 'item-laundry-detergent', listSeedKey: 'list-groceries', name: 'Laundry detergent', section: 'household', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-butter', listSeedKey: 'list-groceries', name: 'Butter', section: 'dairy', staple: 'TRUE', status: 'stocked' },
    { seedKey: 'item-dog-food', listSeedKey: 'list-notgrocery', name: 'Dog food', section: 'other', staple: 'TRUE', status: 'stocked' }
  ]
};

// ---------------------------------------------------------------------------
// Feature 027 — birthdays + anniversaries (docs/seed-data.md §2-§3), seeded once by
// seedEvents() (Seed.js) into RecurringEvents. Each entry carries either a literal
// historical `anchorDate` (anniversaries — the ordinal base year matters) or an
// `anchorRule` resolved the same way SEED_PACK's chores are (birthdays — the next future
// month/day). Birthdays' `templateId` names their own per-person prep row below (research
// R6); anniversary titles carry the `{nth}` ordinal token (research R4).
// ---------------------------------------------------------------------------

var EVENT_SEED_PACK = [
  { seedKey: 'bday-jazmine', title: "Jaz's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-jazmine' },
  { seedKey: 'bday-jaz-mom', title: "Jaz's Mom's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-jaz-mom' },
  { seedKey: 'bday-max', title: "Max's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-max' },
  { seedKey: 'bday-max-dad', title: "Max's Dad's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-max-dad' },
  { seedKey: 'bday-jaz-dad', title: "Jaz's Dad's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-jaz-dad' },
  { seedKey: 'bday-uncle-joe', title: "Jaz's Uncle's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-uncle-joe' },
  { seedKey: 'bday-wyatt', title: "Nephew's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-wyatt' },
  { seedKey: 'bday-max-mom', title: "Max's Mom's birthday", cadence: 'annually', anchorRule: 'monthday-XX-XX', defaultOwner: 'both', templateId: 'bday-max-mom' },
  { seedKey: 'anniv-dating', title: '{nth} dating anniversary', cadence: 'annually', anchorDate: '2020-01-01', defaultOwner: 'both' },
  { seedKey: 'anniv-engaged', title: '{nth} engagement anniversary', cadence: 'annually', anchorDate: '2022-01-01', defaultOwner: 'both' },
  { seedKey: 'anniv-married', title: '{nth} wedding anniversary', cadence: 'annually', anchorDate: '2025-01-01', defaultOwner: 'both' },
  { seedKey: 'anniv-rufus-gotcha', title: "Rufus's {nth} gotcha day", cadence: 'annually', anchorDate: '2022-07-10', defaultOwner: 'both' },
  { seedKey: 'anniv-cleo-gotcha', title: "Cleo's {nth} gotcha day", cadence: 'annually', anchorDate: '2020-09-27', defaultOwner: 'both' }
];

// ---------------------------------------------------------------------------
// Feature 027 — prep templates (docs/seed-data.md §2 prep, §8), seeded once by
// seedTemplates() (Seed.js) into TaskTemplates. The eight `bday-*` rows are each their own
// single-row eventType so owner + lead time vary per person (research R6) — matched by the
// `templateId` on the corresponding EVENT_SEED_PACK row above. `guests-arriving` and
// `leaving-trip` are ordinary multi-row eventTypes for one-off events the household creates.
// ---------------------------------------------------------------------------

var TEMPLATE_SEED_PACK = [
  { seedKey: 'tmpl-bday-jazmine', eventType: 'bday-jazmine', taskTitle: "Buy Jaz's birthday gift", offsetDays: -14, defaultOwner: 'max' },
  { seedKey: 'tmpl-bday-jaz-mom', eventType: 'bday-jaz-mom', taskTitle: "Buy Jaz's Mom's birthday gift", offsetDays: -21, defaultOwner: 'jaz' },
  { seedKey: 'tmpl-bday-max', eventType: 'bday-max', taskTitle: "Buy Max's birthday gift", offsetDays: -14, defaultOwner: 'jaz' },
  { seedKey: 'tmpl-bday-max-dad', eventType: 'bday-max-dad', taskTitle: "Make dinner/wine reservations for Max's Dad's birthday", offsetDays: -14, defaultOwner: 'max' },
  { seedKey: 'tmpl-bday-jaz-dad', eventType: 'bday-jaz-dad', taskTitle: "Buy Jaz's Dad's birthday gift", offsetDays: -14, defaultOwner: 'jaz' },
  { seedKey: 'tmpl-bday-uncle-joe', eventType: 'bday-uncle-joe', taskTitle: 'Text Uncle in the family group chat', offsetDays: 0, defaultOwner: 'both' },
  { seedKey: 'tmpl-bday-wyatt', eventType: 'bday-wyatt', taskTitle: "Buy Nephew's birthday gift", offsetDays: -7, defaultOwner: 'max' },
  { seedKey: 'tmpl-bday-max-mom', eventType: 'bday-max-mom', taskTitle: "Buy Max's Mom's birthday gift", offsetDays: -21, defaultOwner: 'max' },
  // "Guests arrive" — attach to a one-off event for a household visitor.
  { seedKey: 'tmpl-guests-sheets', eventType: 'guests-arriving', taskTitle: 'Fresh sheets', offsetDays: -2, defaultOwner: 'jaz' },
  { seedKey: 'tmpl-guests-bathroom', eventType: 'guests-arriving', taskTitle: 'Clean guest bathroom', offsetDays: -1, defaultOwner: 'max' },
  { seedKey: 'tmpl-guests-snacks', eventType: 'guests-arriving', taskTitle: 'Get snacks', offsetDays: -1, defaultOwner: 'max' },
  { seedKey: 'tmpl-guests-vacuum', eventType: 'guests-arriving', taskTitle: 'Vacuum', offsetDays: 0, defaultOwner: 'jaz' },
  // "Leaving for a trip" — attach to a one-off event for household travel.
  { seedKey: 'tmpl-trip-pumpkin', eventType: 'leaving-trip', taskTitle: 'Get enough pumpkin & pup veggies', offsetDays: -1, defaultOwner: 'max' },
  { seedKey: 'tmpl-trip-plants', eventType: 'leaving-trip', taskTitle: 'Water plants', offsetDays: -1, defaultOwner: 'jaz' },
  { seedKey: 'tmpl-trip-trash', eventType: 'leaving-trip', taskTitle: 'Take trash out', offsetDays: -1, defaultOwner: 'max' },
  { seedKey: 'tmpl-trip-pup-instructions', eventType: 'leaving-trip', taskTitle: 'Set out pup instructions', offsetDays: 0, defaultOwner: 'max' },
  { seedKey: 'tmpl-trip-key', eventType: 'leaving-trip', taskTitle: 'Key under mat for dog sitter', offsetDays: 0, defaultOwner: 'both' }
];
