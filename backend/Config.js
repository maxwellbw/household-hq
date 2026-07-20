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
  RECURRING_EVENTS: 'RecurringEvents',
  // Feature 010 — web push subscriptions.
  PUSH_SUBSCRIPTIONS: 'PushSubscriptions',
  // Feature 011 — weather-aware dog-walk finder ledger.
  DOG_WALKS: 'DogWalks'
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
                     'seasonEnd', 'lastGenerated', 'seedKey'],
  // Feature 010 — one row per device enabled for web push (data-model.md).
  PushSubscriptions: ['id', 'person', 'endpoint', 'p256dh', 'auth', 'deviceLabel',
                       'createdAt', 'lastUsedAt'],
  // Feature 011 — dog-walk ledger: one row per (date, slot) (data-model.md). Feature 031
  // adds decidedBy: max/jaz/blank — who made this decision by hand; blank means the finder
  // owns the row (data-model.md §1).
  DogWalks: ['id', 'date', 'slot', 'status', 'windowStart', 'windowEnd', 'durationMin',
             'maxGcalEventId', 'jazGcalEventId', 'reason', 'notifiedAt', 'updatedAt', 'decidedBy']
};

/** Tabs whose rows carry a UUID `id` (eligible for blank-ID adoption, FR-022). */
var ID_TABS = [TABS.EVENTS, TABS.TASKS, TABS.TEMPLATES, TABS.RECURRING, TABS.LISTS,
               TABS.LIST_ITEMS, TABS.RECURRING_EVENTS, TABS.PUSH_SUBSCRIPTIONS, TABS.DOG_WALKS];

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
  'digest-monthly': 'emailed the month ahead',
  snooze: 'snoozed', unsnooze: 'un-snoozed', acknowledge: 'committed to',
  'settings-update': 'updated settings', 'rank-someday': 'ranked',
  'list-item-need': 'marked needed', 'list-item-stocked': 'marked stocked',
  // Feature 010 — web push (retires feature 009's ntfy-ping).
  'push-subscribe': 'enabled push on a device', 'push-unsubscribe': 'disabled push on a device',
  'push-notify': 'sent a push notification',
  // Feature 011 — weather-aware dog-walk finder.
  'dogwalk-book': 'booked a dog walk', 'dogwalk-move': 'moved a dog walk',
  'dogwalk-suggest': 'suggested a dog-walk window', 'dogwalk-needs-decision': 'flagged a dog walk for a decision',
  // Feature 031 US3: manual actions from the planner — distinct verbs from the automatic
  // finder's above, so the activity feed can tell "a human decided" from "the finder decided".
  'dogwalk.book': 'booked a dog walk', 'dogwalk.unbook': 'removed a dog walk',
  'dogwalk.release': 'returned a dog walk to automatic scheduling'
};

/**
 * A write action mutates the Sheet. Shared-account callers must confirm an acting-person
 * on these (feature 002 FR-014/A5); reads and `auth.whoami` do not. Any `*.create`,
 * `*.update`, or `*.delete` counts. Feature 031: `book`/`unbook`/`release` added — without
 * this, a shared-account caller would reach `bookWalkManually_`/etc. with `actor === null`
 * instead of being asked to confirm Max or Jaz (FR-020's ActivityLog attribution depends on
 * a real actor).
 */
function isWriteAction_(action) {
  return /\.(create|update|delete|complete|reopen|snooze|unsnooze|acknowledge|rank|toggle|subscribe|unsubscribe|book|unbook|release)$/.test(String(action));
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

/** Fallback lookahead (days) when Settings' recurringEventsYearlyLookaheadDays is
 *  blank/≤0. Applies only to annual-class cadences (`annually`, `thanksgiving-sat`) —
 *  feature 028, so birthdays/anniversaries materialize a full year ahead. */
var RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS = 366;

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

// ---------------------------------------------------------------------------
// Feature 011 — weather-aware dog-walk finder (research R8)
// ---------------------------------------------------------------------------

/** Hour (household tz) the nightly dog-walk finder trigger runs at. Moved 1 -> 3 (feature
 *  031 research R1/R3): hour 1 sits in the extremely congested top-of-hour band where a huge
 *  cohort of scheduled scripts fires, and Open-Meteo rate-limits per source IP — the
 *  2026-07-18 incident. Hour 3 is less congested and doubles as the R1 discriminating
 *  experiment: if it stops seeing 429s, that supports the shared-egress hypothesis. */
var DOG_WALK_TRIGGER_HOUR = 3;

/** Hour (household tz) the forecast warm-up trigger (`warmForecastCache`) runs at (feature
 *  031 research R3) — deliberately far from `DOG_WALK_TRIGGER_HOUR` so the two triggers are
 *  an independent draw against rate-limit congestion, not both stuck at the same top-of-hour
 *  window. A rate-limited hour-3 finder run then falls back to a cache at most ~6h old. */
var DOG_WALK_WARM_HOUR = 21;

/** Discretization step (minutes) for scanning a free interval's candidate start times in
 *  `selectWindow_`/`secondWalkPlan_` — fine enough to find the real best window, coarse
 *  enough to keep the 6-minute budget (research R8/R9). */
var DOG_WALK_STEP_MIN = 15;

/** WMO weather codes treated as snow/ice/freezing (research R5): snow (71,73,75,77), snow
 *  showers (85,86), freezing rain (66,67), freezing drizzle (56,57). */
var DOG_WALK_WMO_SNOW_ICE = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86];

// ---------------------------------------------------------------------------
// Feature 031 — forecast cache + retry backoff (research R2/R4)
// ---------------------------------------------------------------------------

/** Script-property key for the durable forecast cache (data-model.md §2). Not a Sheet tab —
 *  disposable machine data, never a source of truth (Principle II). */
var DOG_WALK_FORECAST_CACHE_KEY = 'hq.dogwalk.forecastCache';

/** A cached forecast older than this is unusable for booking decisions, though it may still
 *  be displayed with its age (FR-006). */
var DOG_WALK_CACHE_MAX_AGE_MIN = 1440; // 24h

/** Safety ceiling for the encoded cache value, comfortably under the ~9KB script-property
 *  cap (research R2). The writer sheds furthest-out days first if it would exceed this. */
var DOG_WALK_CACHE_MAX_BYTES = 8000;

/** Cache encoding version, checked on read; a mismatch (or any malformed payload) decodes
 *  to `null` rather than throwing — a corrupt cache degrades to "no cache" (data-model §2). */
var DOG_WALK_CACHE_VERSION = 'v1';

/** Escalating backoff (ms) between fetch attempts when Open-Meteo responds 429 — spans
 *  ~3.5 minutes to cross a per-minute limiter and let a top-of-hour burst drain (research R4). */
var DOG_WALK_BACKOFF_RATELIMIT_MS = [45000, 150000];

/** Escalating backoff (ms) between fetch attempts for a generic transient failure (non-429
 *  non-200, or a thrown exception) — no benefit to waiting minutes for these (research R4). */
var DOG_WALK_BACKOFF_TRANSIENT_MS = [2000, 8000];

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
  ['pushEnabled', 'TRUE', 'feature 010; FALSE turns off web push (retires feature 009 ntfyEnabled)'],
  ['morningOverduePushHour', '8', 'feature 033; hour (household tz) the morning overdue push fires; re-run installNotifyTriggers() after changing'],
  ['eveningWalkPushHour', '20', 'feature 033; hour (household tz) the night-before dog-walk push fires; re-run installNotifyTriggers() after changing'],
  ['vapidPublicKey', '', 'feature 010; generated once by setupPush(); Sheet-only, not in the Settings editor'],
  ['vapidPrivateKey', '', 'feature 010; generated once by setupPush(); Sheet-only, not in the Settings editor'],
  ['vapidSubject', 'mailto:CHANGE_ME@example.com', 'feature 010; VAPID JWT "sub" contact'],
  ['householdLat', '', 'feature 011'],
  ['householdLon', '', 'feature 011'],
  ['weatherHeatF', '80', 'feature 011; heat ceiling °F (hour fails above)'],
  ['weatherPrecipPct', '50', 'feature 011; precip-probability ceiling % (hour fails at/above)'],
  ['weatherColdFloorF', '20', 'feature 011; cold floor °F (hour fails below)'],
  ['dogWalkAutoBook', 'TRUE', 'feature 011; FALSE = suggest-only (compute + show, no invite)'],
  ['maxWorkCalId', '', 'feature 011; Max\'s work calendar id in the household account. Google-native, or an Outlook/Exchange ICS subscribed via Google Calendar "From URL" (research R4)'],
  ['jazWorkCalId', '', 'feature 011; Jaz\'s work calendar id in the household account (Google-native, or a subscribed ICS like maxWorkCalId)'],
  ['maxWorkEmail', '', 'feature 011; guest email invited for Max\'s work calendar'],
  ['jazWorkEmail', '', 'feature 011; guest email invited for Jaz\'s work calendar'],
  ['dogWalkIgnoreList', 'Focus time; Block; Hold', 'feature 011; ";"-delimited, case-insensitive titles that count as free. NOTE: do NOT add "Busy" — a free/busy-only shared calendar (e.g. Jaz\'s) surfaces every real meeting titled "Busy", so ignoring it would book walks over real meetings (research R4)'],
  ['dogWalkTitle', 'Booked', 'feature 011; visible title on the invite'],
  ['dogWalkEarliestStart', '08:00', 'feature 011; earliest walk start (HH:MM, household tz)'],
  ['dogWalkLatestStart', '16:00', 'feature 011; latest walk start'],
  ['dogWalkDurationsMin', '60,45,30', 'feature 011; duration preference order, longest first'],
  ['dogWalkMiddayBandStart', '09:00', 'feature 011; preferred window-selection band start'],
  ['dogWalkMiddayBandEnd', '12:00', 'feature 011; preferred window-selection band end'],
  ['dogWalkSecondTriggerBefore', '09:00', 'feature 011; if the primary starts before this, attempt a second walk'],
  ['dogWalkSecondAfter', '13:00', 'feature 011; earliest start for the second (afternoon) walk'],
  ['dogWalkSecondDurationMin', '30', 'feature 011; fixed duration of the second walk'],
  ['dogWalkReliableDays', '14', 'feature 011; firm auto-book horizon (days from today)'],
  ['dogWalkOuterDays', '21', 'feature 011; outer sliding horizon ("3 weeks")'],
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
  ['recurringEventsYearlyLookaheadDays', '366',
    'feature 028; days ahead the generator materializes annual-class rules (annually, thanksgiving-sat). Blank/≤0 falls back to 366'],
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
  'digestHour', 'pushEnabled', 'gcalEventReminderMin', 'timezone',
  'groceryStapleNudgeThreshold', 'morningOverduePushHour', 'eveningWalkPushHour'
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
// Feature 027 — household seed data shape (docs/seed-data.md; data-model.md §5d):
// shopping lists + items, seeded once by seedLists() (Seed.js). Items carry explicit
// `status` (need/stocked) — seedLists() writes directly via createRecord_, bypassing
// createListItem_'s force-to-"need" + name-dedupe (those rules are for user-initiated
// adds, not a one-time historical load).
//
// Production was seeded 2026-07-12 and is ledgered (`listSeedApplied` in SETTINGS_SEED
// above), so never-resurrect means this pack won't re-apply. The rows below are a
// generic example of the shape, not real data — the household's actual lists/items
// live only in the Sheet and are hand-edited there.
// ---------------------------------------------------------------------------

var LIST_SEED_PACK = {
  lists: [
    { seedKey: 'example-list-groceries', name: 'Groceries' }
  ],
  items: [
    { seedKey: 'example-item-milk', listSeedKey: 'example-list-groceries', name: 'Milk', section: 'dairy', staple: 'TRUE', status: 'need' },
    { seedKey: 'example-item-paper-towels', listSeedKey: 'example-list-groceries', name: 'Paper towels', section: 'household', staple: 'TRUE', status: 'stocked' }
  ]
};

// ---------------------------------------------------------------------------
// Feature 027 — birthdays + anniversaries shape (docs/seed-data.md §2-§3), seeded once
// by seedEvents() (Seed.js) into RecurringEvents. Each entry carries either a literal
// historical `anchorDate` (anniversaries — the ordinal base year matters) or an
// `anchorRule` resolved the same way SEED_PACK's chores are (birthdays — the next future
// month/day). Birthdays' `templateId` names their own per-person prep row below (research
// R6); anniversary titles carry the `{nth}` ordinal token (research R4).
//
// Production was seeded 2026-07-12 and is ledgered (`eventSeedApplied` in SETTINGS_SEED
// above), so never-resurrect means this pack won't re-apply. The rows below are a
// generic example of the shape, not real data — the household's actual birthdays/
// anniversaries live only in the Sheet and are hand-edited there.
// ---------------------------------------------------------------------------

var EVENT_SEED_PACK = [
  { seedKey: 'example-bday', title: "Example's birthday", cadence: 'annually', anchorRule: 'monthday-01-15', defaultOwner: 'both', templateId: 'example-bday' },
  { seedKey: 'example-anniv', title: '{nth} anniversary', cadence: 'annually', anchorDate: '2020-01-01', defaultOwner: 'both' }
];

// ---------------------------------------------------------------------------
// Feature 027 — prep templates shape (docs/seed-data.md §2 prep, §8), seeded once by
// seedTemplates() (Seed.js) into TaskTemplates. Birthday-type rows are each their own
// single-row eventType so owner + lead time vary per person (research R6) — matched by
// the `templateId` on the corresponding EVENT_SEED_PACK row above. `guests-arriving` and
// `leaving-trip` are ordinary multi-row eventTypes for one-off events the household
// creates.
//
// Production was seeded 2026-07-12 and is ledgered (`templateSeedApplied` in
// SETTINGS_SEED above), so never-resurrect means this pack won't re-apply. The rows
// below are a generic example of the shape, not real data — the household's actual
// prep templates live only in the Sheet and are hand-edited there.
// ---------------------------------------------------------------------------

var TEMPLATE_SEED_PACK = [
  { seedKey: 'example-tmpl-bday', eventType: 'example-bday', taskTitle: "Buy Example's birthday gift", offsetDays: -14, defaultOwner: 'max' },
  { seedKey: 'example-tmpl-guests-vacuum', eventType: 'guests-arriving', taskTitle: 'Vacuum', offsetDays: 0, defaultOwner: 'jaz' }
];
