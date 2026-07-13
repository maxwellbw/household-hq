/**
 * RecurringEvents.js — the recurring *event* engine (feature 025).
 *
 * Extends feature 004's recurrence concept from Tasks to Events, with full cadence parity.
 * Reuses 004's pure date math (`occurrencesInWindow_`, `inSeason_`, `addMonthsClamped_`,
 * `addDays_`, `monthOf_`, `ymd_` — all in Recurring.js) rather than duplicating it
 * (Principle IV). Occurrences are all-day (date-only start/end) by default, or timed when
 * the rule carries a `startTime`; either way the write goes through the existing Sheets.js
 * primitives so every mutation stays locked, idempotent, and logged (Principle V/VI). When
 * a rule names a prep template, each occurrence's prep is generated inline by reusing
 * feature 005's `syncPrepForEvent_` unchanged (PrepTasks.js).
 */

// ---------------------------------------------------------------------------
// Pure id/date-math helpers (research D2/D4) — no Sheet/network access
// ---------------------------------------------------------------------------

/**
 * The deterministic id for a generated occurrence Event (research D4) —
 * `'v' + hex(MD5(ruleId + '|' + date))`. Same rule + same occurrence date always produces
 * the same Event id, so `createRecord_`'s id-replay collapses re-runs and overlapping
 * executions to a single row instead of duplicating. `'v'` (eVent occurrence) is distinct
 * from `'r'` (recurring task, Recurring.js) and `'p'` (prep task, PrepTasks.js).
 */
function recurringEventOccurrenceId_(ruleId, date) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, ruleId + '|' + date);
  var hex = bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return 'v' + hex;
}

/** True if `id` has the shape of a generated recurring-event occurrence (`'v'` + 32 hex). */
function isRecurringEventId_(id) {
  return /^v[0-9a-f]{32}$/.test(String(id || ''));
}

/**
 * An occurrence's `{start, end}` (research D2): all-day when `startTime` is blank — both
 * equal to the bare `date` (`YYYY-MM-DD`), which the frontend already renders as all-day
 * (`isAllDay()`) — otherwise a timed occurrence at `date + 'T' + startTime`, ending
 * `durationMinutes` (default 60) later.
 */
function occurrenceStartEnd_(date, startTime, durationMinutes) {
  var time = String(startTime || '').trim();
  if (time === '') return { start: date, end: date };
  var start = date + 'T' + time;
  var minutes = Number(durationMinutes);
  if (!(minutes > 0)) minutes = 60;
  return { start: start, end: addMinutesToDateTime_(start, minutes) };
}

/** `YYYY-MM-DDTHH:mm` shifted forward by `minutes` (minutes may span past midnight/into a
 *  new day); local household time, no offset — parity with the rest of the schema. */
function addMinutesToDateTime_(datetime, minutes) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(datetime);
  var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  d.setMinutes(d.getMinutes() + minutes);
  var mm = d.getMonth() + 1, dd = d.getDate();
  var hh = d.getHours(), mi = d.getMinutes();
  return ymd_(d.getFullYear(), mm, dd) + 'T' +
    (hh < 10 ? '0' + hh : hh) + ':' + (mi < 10 ? '0' + mi : mi);
}

// ---------------------------------------------------------------------------
// Ordinal "{nth}" title token (feature 027, research R4) — pure, no Sheet/network access
// ---------------------------------------------------------------------------

/** The English ordinal string for a positive integer: 1→"1st", 2→"2nd", 3→"3rd", 4→"4th",
 *  11→"11th"/12→"12th"/13→"13th" (the teens are always "th"), 21→"21st", etc. */
function ordinal_(n) {
  var rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  switch (n % 10) {
    case 1: return n + 'st';
    case 2: return n + 'nd';
    case 3: return n + 'rd';
    default: return n + 'th';
  }
}

/**
 * A rule's `title` may contain the literal token `{nth}` (e.g. `"{nth} dating
 * anniversary"`, `"Rufus's {nth} gotcha day"`). Renders it as the ordinal count of years
 * from the rule's anchor year to the occurrence's year — baked into each generated
 * occurrence's stored title so it's correct everywhere that title is read (calendar,
 * dashboard, the 007 Google Calendar mirror) with no frontend involvement. A title with no
 * token, or a non-positive year delta, is returned unchanged (a birthday's plain title
 * passes straight through; see research R4 for why a delta ≤ 0 isn't expected in practice).
 */
function renderOccurrenceTitle_(ruleTitle, anchorDate, occurrenceDate) {
  var title = String(ruleTitle || '');
  if (title.indexOf('{nth}') < 0) return title;
  var n = (+occurrenceDate.substring(0, 4)) - (+anchorDate.substring(0, 4));
  if (n < 1) return title;
  return title.split('{nth}').join(ordinal_(n));
}

// ---------------------------------------------------------------------------
// The nightly generator (FR-004/005/006/007/009/010/011/012/013/018)
// ---------------------------------------------------------------------------

/**
 * Materialize due occurrences for every RecurringEvents rule into Events (and, when a rule
 * has a `templateId`, their prep tasks). Trigger entry point; also safe to run from the
 * editor. No outer lock — each write goes through `createRecord_`/`updateRecordById_`,
 * which lock and log individually and are idempotent on their own (Principle V), so
 * overlapping/retried runs of this whole function are safe.  One rule's failure is isolated
 * so it can't abort generation for the rest (defensive; Apps Script triggers get no user to
 * report an error to) — mirrors `generateRecurringTasks`. Window end is per-cadence
 * (feature 028): annual-class rules (`annually`, `thanksgiving-sat`) get the wide
 * `recurringEventsYearlyLookaheadDays` window so birthdays/anniversaries materialize a
 * full year ahead; every other cadence keeps the short `recurringEventsLookaheadDays`
 * window so weekly/monthly rules don't flood Events/the calendar mirror.
 */
function generateRecurringEvents() {
  var settings = readSettingsMap_();
  var lookaheadRaw = Number(settings['recurringEventsLookaheadDays']);
  var lookahead = lookaheadRaw > 0 ? lookaheadRaw : RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS;
  var yearlyLookaheadRaw = Number(settings['recurringEventsYearlyLookaheadDays']);
  var yearlyLookahead = yearlyLookaheadRaw > 0 ? yearlyLookaheadRaw : RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS;
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var windowEndShort = addDays_(today, lookahead);
  var windowEndYearly = addDays_(today, yearlyLookahead);

  var rules = listRecords_(TABS.RECURRING_EVENTS);
  rules.forEach(function (rule) {
    try {
      var isAnnual = rule.cadence === 'annually' || rule.cadence === 'thanksgiving-sat';
      generateForEventRule_(rule, today, isAnnual ? windowEndYearly : windowEndShort);
    } catch (err) {
      console.error('generateRecurringEvents: rule ' + rule.id + ' failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });
}

/** Generate occurrences + prep, and advance the watermark, for one rule. Isolated so
 *  SelfTest can call it directly. */
function generateForEventRule_(rule, today, windowEnd) {
  var windowStart = rule.lastGenerated ? rule.lastGenerated : addDays_(today, -1);
  var occurrences = occurrencesInWindow_(rule.anchorDate, rule.cadence, windowStart, windowEnd);
  if (occurrences.length === 0) return;

  var highWater = rule.lastGenerated || '';
  occurrences.forEach(function (due) {
    if (due > highWater) highWater = due;
    if (!inSeason_(monthOf_(due), rule.seasonStart, rule.seasonEnd)) return; // skipped, not created
    var timing = occurrenceStartEnd_(due, rule.startTime, rule.durationMinutes);
    var occ = {
      id: recurringEventOccurrenceId_(rule.id, due),
      title: renderOccurrenceTitle_(rule.title, rule.anchorDate, due),
      start: timing.start,
      end: timing.end,
      owner: rule.defaultOwner,
      type: '',
      templateId: rule.templateId || '',
      notes: rule.notes || '',
      location: rule.location || '',
      prepGeneratedFor: '',
      recurringEventId: rule.id
    };
    var created = createRecord_(TABS.EVENTS, occ, 'system');
    syncPrepForEvent_(created, 'system'); // feature 005 US2 FR-008, reused verbatim
  });

  if (highWater && highWater !== rule.lastGenerated) {
    updateRecordById_(TABS.RECURRING_EVENTS, rule.id, { lastGenerated: highWater }, 'system');
  }
}

// ---------------------------------------------------------------------------
// Trigger installer (research D5) — run once from the editor, not exposed as an API action
// ---------------------------------------------------------------------------

/**
 * Install the single nightly trigger for `generateRecurringEvents`. Idempotent: removes any
 * existing trigger for the same handler first, so re-running never stacks duplicates. Run
 * manually from the Apps Script editor after deploy (mirrors `installRecurringTrigger`).
 * Reuses the `script.scriptapp` scope already granted for feature 004 — no new
 * authorization is required.
 *
 * NOTE: public name (no trailing underscore) on purpose — the editor's Run menu and the
 * trigger system both ignore underscore-suffixed "private" functions.
 */
function installRecurringEventsTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'generateRecurringEvents') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generateRecurringEvents')
    .timeBased()
    .atHour(RECURRING_EVENTS_TRIGGER_HOUR)
    .everyDays(1)
    .create();
  Logger.log('installRecurringEventsTrigger: nightly trigger installed at hour ' +
    RECURRING_EVENTS_TRIGGER_HOUR);
}

// ---------------------------------------------------------------------------
// Rule CRUD (US3; contracts/recurring-events.md) — lastGenerated is generator-managed
// ---------------------------------------------------------------------------

function createRecurringEvent_(payload, actor) {
  rejectUnknownFields_(TABS.RECURRING_EVENTS, payload);
  if (payload.hasOwnProperty('lastGenerated') && String(payload.lastGenerated).trim() !== '') {
    fail_('BAD_REQUEST', 'lastGenerated is generator-managed; do not set it on create.', 'lastGenerated');
  }
  requireFields_(payload, REQUIRED_ON_CREATE.RecurringEvents);
  validateFields_(TABS.RECURRING_EVENTS, payload);
  validateSeasonWindow_(payload.seasonStart, payload.seasonEnd);
  var rec = fullRecord_(TABS.RECURRING_EVENTS, payload);
  rec.lastGenerated = ''; // always starts blank; the first run back-fills from today
  return createRecord_(TABS.RECURRING_EVENTS, rec, actor);
}

function updateRecurringEvent_(payload, actor) {
  rejectUnknownFields_(TABS.RECURRING_EVENTS, payload);
  requireFields_(payload, ['id']);
  if (payload.hasOwnProperty('lastGenerated')) {
    fail_('BAD_REQUEST', 'lastGenerated is generator-managed; it cannot be edited.', 'lastGenerated');
  }
  validateFields_(TABS.RECURRING_EVENTS, payload);
  var patch = mutablePatch_(TABS.RECURRING_EVENTS, payload);
  return updateRecordById_(TABS.RECURRING_EVENTS, String(payload.id).trim(), patch, actor, function (merged) {
    validateSeasonWindow_(merged.seasonStart, merged.seasonEnd);
  });
}
