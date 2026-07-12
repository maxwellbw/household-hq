/**
 * Recurring.js — the recurring chore engine (feature 004).
 *
 * Pure occurrence math (no Sheet access) plus the nightly generator, its trigger
 * installer, and rule create/update helpers. All dates are `YYYY-MM-DD` strings in the
 * household timezone (research D3); the generator writes through the existing
 * Sheets.js primitives so every mutation stays locked, idempotent, and logged.
 */

// ---------------------------------------------------------------------------
// Pure date math (research D3) — no Sheet/network access, unit-testable in isolation
// ---------------------------------------------------------------------------

/** Days in `month` (1-12) of `year`, leap-year aware. */
function daysInMonth_(year, month) {
  return new Date(year, month, 0).getDate();
}

/** `ymd` (YYYY-MM-DD) shifted by `months` calendar months, day clamped to the target
 * month's length (research D3): Jan 31 +1mo -> Feb 28/29; Feb 29 +12mo -> Feb 28 in a
 * common year. */
function addMonthsClamped_(ymd, months) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  var year = +m[1], month = +m[2], day = +m[3];
  var total = (month - 1) + months;
  var targetYear = year + Math.floor(total / 12);
  var targetMonth = ((total % 12) + 12) % 12 + 1;
  var targetDay = Math.min(day, daysInMonth_(targetYear, targetMonth));
  return ymd_(targetYear, targetMonth, targetDay);
}

/** `ymd` shifted by `n` calendar days (n may be negative). */
function addDays_(ymd, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setDate(d.getDate() + n);
  return ymd_(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function ymd_(year, month, day) {
  var mm = month < 10 ? '0' + month : '' + month;
  var dd = day < 10 ? '0' + day : '' + day;
  return year + '-' + mm + '-' + dd;
}

/** The calendar-month component (1-12) of a YYYY-MM-DD string. */
function monthOf_(ymd) {
  return +ymd.substring(5, 7);
}

/** The step function for a cadence: apply it once to move to the next occurrence. */
function CADENCE_STEP_(cadence, ymd) {
  switch (cadence) {
    case 'weekly': return addDays_(ymd, 7);
    case 'biweekly': return addDays_(ymd, 14);
    case 'monthly': return addMonthsClamped_(ymd, 1);
    case 'sixweekly': return addDays_(ymd, 42);
    case 'eightweekly': return addDays_(ymd, 56);
    case 'quarterly': return addMonthsClamped_(ymd, 3);
    case 'annually': return addMonthsClamped_(ymd, 12);
    default: fail_('VALIDATION_FAILED', 'Unknown cadence "' + cadence + '".', 'cadence');
  }
}

/**
 * Occurrence dates stepping from `anchorDate` by `cadence`, restricted to
 * `(startExclusive, endInclusive]` (research D2 window semantics). Steps past occurrences
 * at or before `startExclusive` without emitting them, then collects while `<= endInclusive`.
 * Returns `[]` if none fall in the window. Bounded: stops if it ever runs past `endInclusive`
 * or after a generous iteration cap (defends against a corrupt/degenerate rule).
 */
function occurrencesInWindow_(anchorDate, cadence, startExclusive, endInclusive) {
  var out = [];
  var occ = anchorDate;
  var guard = 0;
  var GUARD_MAX = 100000;
  // Advance past everything at or before the window start.
  while (occ <= startExclusive) {
    occ = CADENCE_STEP_(cadence, occ);
    if (++guard > GUARD_MAX) return out;
  }
  while (occ <= endInclusive) {
    out.push(occ);
    occ = CADENCE_STEP_(cadence, occ);
    if (++guard > GUARD_MAX) break;
  }
  return out;
}

/**
 * True if calendar month `m` (1-12) falls within the inclusive season window
 * `[seasonStart, seasonEnd]` (each 1-12, or both blank for year-round). Wrap-around
 * (`seasonStart > seasonEnd`) spans the year boundary, e.g. 11-2 = Nov, Dec, Jan, Feb
 * (research D4).
 */
function inSeason_(m, seasonStart, seasonEnd) {
  var s = String(seasonStart == null ? '' : seasonStart).trim();
  var e = String(seasonEnd == null ? '' : seasonEnd).trim();
  if (s === '' && e === '') return true; // year-round
  var sn = Number(s), en = Number(e);
  return sn <= en ? (m >= sn && m <= en) : (m >= sn || m <= en);
}

/**
 * The deterministic id for a generated occurrence Task (research D1) —
 * `'r' + hex(MD5(recurringId + '|' + dueDate))`. Same rule + same occurrence date always
 * produces the same Task id, so `createRecord_`'s id-replay collapses re-runs and
 * overlapping executions to a single row instead of duplicating.
 */
function recurringTaskId_(recurringId, dueDate) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, recurringId + '|' + dueDate);
  var hex = bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return 'r' + hex;
}

// ---------------------------------------------------------------------------
// The nightly generator (FR-003/004/005/006/007/011/013/014/016)
// ---------------------------------------------------------------------------

/**
 * Materialize due occurrences for every Recurring rule into Tasks. Trigger entry point;
 * also safe to run from the editor. No outer lock — each rule's writes go through
 * `createRecord_`/`updateRecordById_`, which lock and log individually and are idempotent
 * on their own (Principle V), so overlapping/retried runs of this whole function are safe.
 * One rule's failure is isolated so it can't abort generation for the rest (defensive;
 * Apps Script triggers get no user to report an error to).
 */
function generateRecurringTasks() {
  var lookaheadRaw = Number(readSettingsMap_()['recurringLookaheadDays']);
  var lookahead = lookaheadRaw > 0 ? lookaheadRaw : RECURRING_LOOKAHEAD_DEFAULT_DAYS;
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var windowEnd = addDays_(today, lookahead);

  var rules = listRecords_(TABS.RECURRING);
  rules.forEach(function (rule) {
    try {
      generateForRule_(rule, today, windowEnd);
    } catch (err) {
      console.error('generateRecurringTasks: rule ' + rule.id + ' failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });
}

/** Generate + advance the watermark for one rule. Isolated so SelfTest can call it directly. */
function generateForRule_(rule, today, windowEnd) {
  var windowStart = rule.lastGenerated ? rule.lastGenerated : addDays_(today, -1);
  var occurrences = occurrencesInWindow_(rule.anchorDate, rule.cadence, windowStart, windowEnd);
  if (occurrences.length === 0) return;

  var highWater = rule.lastGenerated || '';
  occurrences.forEach(function (due) {
    if (due > highWater) highWater = due;
    if (!inSeason_(monthOf_(due), rule.seasonStart, rule.seasonEnd)) return; // skipped, not created
    var task = {
      id: recurringTaskId_(rule.id, due),
      title: rule.title,
      dueDate: due,
      owner: rule.defaultOwner,
      status: 'open',
      recurringId: rule.id
    };
    createRecord_(TABS.TASKS, task, 'system');
  });

  if (highWater && highWater !== rule.lastGenerated) {
    updateRecordById_(TABS.RECURRING, rule.id, { lastGenerated: highWater }, 'system');
  }
}

// ---------------------------------------------------------------------------
// Trigger installer (research D7) — run once from the editor, not exposed as an API action
// ---------------------------------------------------------------------------

/**
 * Install the single nightly trigger for `generateRecurringTasks`. Idempotent: removes
 * any existing trigger for the same handler first, so re-running never stacks duplicates.
 * Run manually from the Apps Script editor after deploy (mirrors `setupDatabase()`).
 *
 * NOTE: public name (no trailing underscore) on purpose — the editor's Run menu and the
 * trigger system both ignore underscore-suffixed "private" functions, so entry points that
 * must be invoked from the editor or fired by a trigger cannot use that convention.
 */
function installRecurringTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'generateRecurringTasks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generateRecurringTasks')
    .timeBased()
    .atHour(RECURRING_TRIGGER_HOUR)
    .everyDays(1)
    .create();
  Logger.log('installRecurringTrigger: nightly trigger installed at hour ' + RECURRING_TRIGGER_HOUR);
}

// ---------------------------------------------------------------------------
// Rule CRUD (US2; contracts/api-004.md) — lastGenerated is generator-managed (research D8)
// ---------------------------------------------------------------------------

function createRecurring_(payload, actor) {
  rejectUnknownFields_(TABS.RECURRING, payload);
  if (payload.hasOwnProperty('lastGenerated') && String(payload.lastGenerated).trim() !== '') {
    fail_('BAD_REQUEST', 'lastGenerated is generator-managed; do not set it on create.', 'lastGenerated');
  }
  requireFields_(payload, REQUIRED_ON_CREATE.Recurring);
  validateFields_(TABS.RECURRING, payload);
  validateSeasonWindow_(payload.seasonStart, payload.seasonEnd);
  var rec = fullRecord_(TABS.RECURRING, payload);
  rec.lastGenerated = ''; // always starts blank; the first run back-fills from today
  return createRecord_(TABS.RECURRING, rec, actor);
}

function updateRecurring_(payload, actor) {
  rejectUnknownFields_(TABS.RECURRING, payload);
  requireFields_(payload, ['id']);
  if (payload.hasOwnProperty('lastGenerated')) {
    fail_('BAD_REQUEST', 'lastGenerated is generator-managed; it cannot be edited.', 'lastGenerated');
  }
  validateFields_(TABS.RECURRING, payload);
  var patch = mutablePatch_(TABS.RECURRING, payload);
  return updateRecordById_(TABS.RECURRING, String(payload.id).trim(), patch, actor, function (merged) {
    validateSeasonWindow_(merged.seasonStart, merged.seasonEnd);
  });
}
