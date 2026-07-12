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
// The nightly generator (FR-004/005/006/007/009/010/011/012/013/018)
// ---------------------------------------------------------------------------

/**
 * Materialize due occurrences for every RecurringEvents rule into Events (and, when a rule
 * has a `templateId`, their prep tasks). Trigger entry point; also safe to run from the
 * editor. No outer lock — each write goes through `createRecord_`/`updateRecordById_`,
 * which lock and log individually and are idempotent on their own (Principle V), so
 * overlapping/retried runs of this whole function are safe.  One rule's failure is isolated
 * so it can't abort generation for the rest (defensive; Apps Script triggers get no user to
 * report an error to) — mirrors `generateRecurringTasks`.
 */
function generateRecurringEvents() {
  var lookaheadRaw = Number(readSettingsMap_()['recurringEventsLookaheadDays']);
  var lookahead = lookaheadRaw > 0 ? lookaheadRaw : RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS;
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var windowEnd = addDays_(today, lookahead);

  var rules = listRecords_(TABS.RECURRING_EVENTS);
  rules.forEach(function (rule) {
    try {
      generateForEventRule_(rule, today, windowEnd);
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
      title: rule.title,
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
