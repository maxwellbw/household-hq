/**
 * Notify.js — household push notifications (feature 033 US2/US3): a morning summary of
 * everything overdue, and a night-before heads-up on tomorrow's dog walk. Both ride the
 * existing web-push channel (Push.js, feature 010) and the same daily-trigger/dedupe/lock
 * shape `Digests.js` already established (research R2): read Settings once, compute a
 * payload, then check-log-send under `LockService` with an ActivityLog row as the
 * idempotency key so a trigger re-run never double-sends.
 *
 * Overdue selector:  computeOverdueTasks_ (mirrors frontend/src/lib/dashboard.ts
 *                     smartViews().overdue — kept in sync by hand, not shared code)
 * Content builders:  buildOverdueBody_, formatWalkWindowLabel_, buildWalkBody_
 * Settings resolve:   resolveNotifyHour_
 * Trigger handlers:   sendMorningOverduePush(), sendEveningWalkPush()
 * Installer:          installNotifyTriggers()
 */

/** The only two notification recipients — same posture as DIGEST_RECIPIENTS (Digests.js). */
var NOTIFY_RECIPIENTS = ['max', 'jaz'];

var NOTIFY_ACTION = { overdue: 'notify-overdue', walk: 'notify-walk' };

// ---------------------------------------------------------------------------
// Settings resolution (mirrors resolveHour_ in Digests.js)
// ---------------------------------------------------------------------------

/** `settings[key]` -> 0-23; blank/invalid falls back to `fallback`. */
function resolveNotifyHour_(settings, key, fallback) {
  var raw = String(settings[key] || '').trim();
  if (/^\d{1,2}$/.test(raw) && +raw <= 23) return +raw;
  return fallback;
}

// ---------------------------------------------------------------------------
// Morning overdue push (US2, FR-004)
// ---------------------------------------------------------------------------

/**
 * Overdue set: open, dated, past-due tasks — mirrors frontend/src/lib/dashboard.ts
 * `smartViews().overdue` exactly (status 'open' AND dueDate non-empty AND dueDate < today,
 * household tz, plain YYYY-MM-DD string compare per Tasks' 'date' field type). Sorted
 * oldest-due-first so the truncated title list leads with the longest-overdue items.
 */
function computeOverdueTasks_(tasks, today) {
  return tasks
    .filter(function (t) { return t.status === 'open' && !!t.dueDate && t.dueDate < today; })
    .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : (a.dueDate > b.dueDate ? 1 : 0); });
}

/** `"3 overdue: Bins, Vet meds, Filter change +2 more"` — first 3 titles (truncated per
 *  `truncateTitle_`), "+K more" omitted when the count is 3 or fewer (clarified 2026-07-19). */
function buildOverdueBody_(overdueTasks) {
  var n = overdueTasks.length;
  var titles = overdueTasks.slice(0, 3).map(function (t) { return truncateTitle_(t.title); });
  var body = n + ' overdue: ' + titles.join(', ');
  var extra = n - titles.length;
  if (extra > 0) body += ' +' + extra + ' more';
  return body;
}

/**
 * Daily trigger handler (public, no trailing underscore — CLAUDE.md). Sends nothing when
 * zero tasks are overdue (no send, no log row). Dedupe/lock/log identical in shape to
 * `Digests.sendOne_`, but keyed once for the whole run (both people get the same content in
 * the same send), not per-person.
 */
function sendMorningOverduePush() {
  var today = todayYmd_();
  var overdue = computeOverdueTasks_(listRecords_(TABS.TASKS), today);
  if (overdue.length === 0) return;

  withLock_(function () {
    if (alreadySent_(NOTIFY_ACTION.overdue, today)) return;
    var body = buildOverdueBody_(overdue);
    NOTIFY_RECIPIENTS.forEach(function (person) {
      sendPushToPerson_(person, today, body, {
        title: 'Household HQ', body: body, url: '?overdue=1', tag: 'overdue-' + today
      });
    });
    appendLog_('system', NOTIFY_ACTION.overdue, today, body);
  });
}

// ---------------------------------------------------------------------------
// Evening dog-walk push (US3, FR-005)
// ---------------------------------------------------------------------------

/** `"8:00–8:45 AM"` in household tz, from `windowStart`/`windowEnd` ISO-with-offset strings
 *  (DogWalks ledger format — DogWalk.js `isoWithOffset_`/`parseIsoWithOffset_`). */
function formatWalkWindowLabel_(windowStartIso, windowEndIso) {
  var tz = getTimezone_();
  var start = parseIsoWithOffset_(windowStartIso);
  var end = parseIsoWithOffset_(windowEndIso);
  if (!start || !end) return '';
  return Utilities.formatDate(start, tz, 'h:mm') + '–' + Utilities.formatDate(end, tz, 'h:mm a');
}

/**
 * Tomorrow's push body from its DogWalks rows, or `null` when nothing should be sent
 * (no rows at all — e.g. a weekend skip). Booked/suggested rows (with a window) win over a
 * needs-decision flag; multiple booked windows join with " and " (two-walk days).
 */
function buildWalkBody_(rows) {
  var booked = rows.filter(function (r) {
    return (r.status === 'booked' || r.status === 'suggested') && r.windowStart && r.windowEnd;
  });
  if (booked.length > 0) {
    var windows = booked.map(function (r) { return formatWalkWindowLabel_(r.windowStart, r.windowEnd); });
    var label = booked.length > 1 ? 'Dog walks tomorrow · ' : 'Dog walk tomorrow · ';
    return label + windows.join(' and ');
  }
  var needsDecision = rows.some(function (r) { return r.status === 'needs-decision'; });
  if (needsDecision) return 'Tomorrow’s walk needs a decision';
  return null;
}

/**
 * Daily trigger handler (public — CLAUDE.md). Subject is always tomorrow (household tz).
 * Sends nothing when tomorrow has no DogWalks row at all. Dedupe/lock/log shape identical
 * to `sendMorningOverduePush`, keyed on tomorrow's date.
 */
function sendEveningWalkPush() {
  var tomorrow = addDays_(todayYmd_(), 1);
  var rows = readDogWalkRows_().filter(function (r) { return r.date === tomorrow; });
  var body = buildWalkBody_(rows);
  if (body === null) return;

  withLock_(function () {
    if (alreadySent_(NOTIFY_ACTION.walk, tomorrow)) return;
    NOTIFY_RECIPIENTS.forEach(function (person) {
      sendPushToPerson_(person, tomorrow, body, {
        title: 'Household HQ', body: body, url: '?walk=' + tomorrow, tag: 'walk-' + tomorrow
      });
    });
    appendLog_('system', NOTIFY_ACTION.walk, tomorrow, body);
  });
}

// ---------------------------------------------------------------------------
// Installer (public — CLAUDE.md; re-run by `settings.update` per Api.js's digestHour hook)
// ---------------------------------------------------------------------------

/**
 * Install the two daily triggers (idempotent: deletes any existing trigger for each handler
 * first). Run manually from the editor after deploy, and again whenever
 * `morningOverduePushHour`/`eveningWalkPushHour` change (mirrors `installDigestTrigger`).
 */
function installNotifyTriggers() {
  var settings = readSettingsMap_();
  var morningHour = resolveNotifyHour_(settings, 'morningOverduePushHour', 8);
  var eveningHour = resolveNotifyHour_(settings, 'eveningWalkPushHour', 20);

  ['sendMorningOverduePush', 'sendEveningWalkPush'].forEach(function (handler) {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
    });
  });
  ScriptApp.newTrigger('sendMorningOverduePush').timeBased().atHour(morningHour).everyDays(1).create();
  ScriptApp.newTrigger('sendEveningWalkPush').timeBased().atHour(eveningHour).everyDays(1).create();
  Logger.log('installNotifyTriggers: morning overdue @ ' + morningHour + ', evening walk @ ' + eveningHour);
}
