/**
 * Digests.js — personalized weekly "week ahead" and monthly "next month" email digests
 * (feature 008). Pure `MailApp` (no advanced service, no npm) plus the existing Sheet-as-DB
 * engine. All dates are interpreted in the household timezone (research D7); `addDays_`,
 * `daysInMonth_`, `ymd_` (Recurring.js) and `todayYmd_`, `parseHouseholdDate_`,
 * `parseHouseholdDatetime_`, `ownerLabel_` (CalendarSync.js) are reused rather than
 * duplicated (Principle IV).
 *
 * Settings resolution: resolveWeekday_, resolveMonthlyDay_, resolveHour_, isEnabled_
 * Windows:              weeklyWindow_, monthlyWindow_
 * Pure builders:        relevantItemsFor_, buildDigest_, renderHtml_/renderText_
 * Dedupe + send:        periodKey_, alreadySent_, sendOne_ (locked check-send-log, research D3)
 * Orchestration:        runWeekly_, runMonthly_, isWeeklySendDay_/isMonthlySendDay_ (pure gates)
 * Trigger:               sendDigests() (daily gate), installDigestTrigger()
 * Manual test kicks:    sendWeeklyDigestNow(), sendMonthlyDigestNow()
 */

// ---------------------------------------------------------------------------
// Recipients + action bookkeeping
// ---------------------------------------------------------------------------

/** The only two digest recipients — the shared household account is never one (research D6). */
var DIGEST_RECIPIENTS = ['max', 'jaz'];

var DIGEST_ACTION = { weekly: 'digest-weekly', monthly: 'digest-monthly' };

// ---------------------------------------------------------------------------
// Settings resolution (research D5/D1) — every value blank/invalid-safe
// ---------------------------------------------------------------------------

var WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** `digestWeeklyDay` → 0–6 (Sun=0). Name or digit; blank/invalid falls back to Sunday. */
function resolveWeekday_(settings) {
  var raw = String(settings['digestWeeklyDay'] || '').trim().toLowerCase();
  if (raw === '') return 0;
  var byName = WEEKDAY_NAMES.indexOf(raw);
  if (byName >= 0) return byName;
  if (/^[0-6]$/.test(raw)) return +raw;
  return 0;
}

/** `digestMonthlyDay` → 1–31 for the given year/month. `last`/blank/invalid/29–31 resolve
 *  to that month's actual final day (so "last" is always correct, including February). */
function resolveMonthlyDay_(settings, year, month) {
  var last = daysInMonth_(year, month);
  var raw = String(settings['digestMonthlyDay'] || '').trim().toLowerCase();
  if (raw === '' || raw === 'last') return last;
  if (/^\d{1,2}$/.test(raw)) {
    var n = +raw;
    if (n >= 1 && n <= 28) return n;
  }
  return last;
}

/** `digestHour` → 0–23; blank/invalid falls back to DIGEST_TRIGGER_HOUR. */
function resolveHour_(settings) {
  var raw = String(settings['digestHour'] || '').trim();
  if (/^\d{1,2}$/.test(raw) && +raw <= 23) return +raw;
  return DIGEST_TRIGGER_HOUR;
}

/** Boolean-ish Settings flag; blank or unrecognized fails open to `true` (the seeded
 *  default), only recognized falsy strings turn a digest off. */
function isEnabled_(settings, key) {
  var raw = settings[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  var v = String(raw).trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no' && v !== 'off';
}

// ---------------------------------------------------------------------------
// Windows (household tz, inclusive both ends — research D7, FR-013)
// ---------------------------------------------------------------------------

/** The 7 days beginning `today` (weekly "week ahead", FR-001). */
function weeklyWindow_(today) {
  return { start: today, end: addDays_(today, 6) };
}

/** All of next calendar month, whatever its length (monthly "next month", FR-002). */
function monthlyWindow_(today) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  var year = +m[1], month = +m[2];
  var nextYear = year, nextMonth = month + 1;
  if (nextMonth > 12) { nextMonth = 1; nextYear = year + 1; }
  return { start: ymd_(nextYear, nextMonth, 1), end: ymd_(nextYear, nextMonth, daysInMonth_(nextYear, nextMonth)) };
}

// ---------------------------------------------------------------------------
// Pure item selection + composition (research D7) — no Sheet/Mail access
// ---------------------------------------------------------------------------

/**
 * Items relevant to `person` within `[windowStart, windowEnd]` (inclusive, YYYY-MM-DD):
 * Events by `owner ∈ {person, both}` + start date in window; dated open/snoozed Tasks by the
 * same owner rule. Completed/deleted/undated tasks and out-of-window items never appear
 * (FR-003/004/014). Sorted by date then time.
 */
function relevantItemsFor_(person, windowStart, windowEnd, events, tasks) {
  var items = [];
  events.forEach(function (e) {
    if (e.owner !== person && e.owner !== 'both') return;
    var date = String(e.start || '').substring(0, 10);
    if (date === '' || date < windowStart || date > windowEnd) return;
    items.push({ date: date, time: String(e.start).substring(11, 16), title: e.title, owner: e.owner, source: 'event' });
  });
  tasks.forEach(function (t) {
    if (t.owner !== person && t.owner !== 'both') return;
    var date = String(t.dueDate || '').trim();
    if (date === '' || date < windowStart || date > windowEnd) return;
    if (t.status !== 'open' && t.status !== 'snoozed') return;
    items.push({ date: date, time: null, title: t.title, owner: t.owner, source: 'task' });
  });
  items.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var at = a.time || '', bt = b.time || '';
    return at < bt ? -1 : (at > bt ? 1 : 0);
  });
  return items;
}

function groupByDate_(items) {
  var map = {}, order = [];
  items.forEach(function (it) {
    if (!map[it.date]) { map[it.date] = []; order.push(it.date); }
    map[it.date].push(it);
  });
  return order.map(function (date) { return { date: date, items: map[date] }; });
}

function emptyStateMessage_(kind) {
  return kind === 'weekly'
    ? 'Nothing on the calendar for the coming week. Enjoy the quiet.'
    : 'Nothing on the calendar for next month yet.';
}

function escapeHtml_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `'16:00'` → `'4:00 PM'`; pure string math (no Date/tz involved — avoids any DST edge
 *  case a constructed Date could introduce for a bare time-of-day). */
function formatItemTimeLabel_(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return '';
  var h = +m[1], mm = m[2];
  var period = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + mm + ' ' + period;
}

function formatItemDateLabel_(ymd) {
  return Utilities.formatDate(parseHouseholdDate_(ymd), getTimezone_(), 'EEE, MMM d');
}

/** `'Jul 13–19'` (same month) or `'Jul 28–Aug 3'` (spanning months). */
function formatDateRangeShort_(startYmd, endYmd) {
  var tz = getTimezone_();
  var sameMonth = startYmd.substring(0, 7) === endYmd.substring(0, 7);
  var startLabel = Utilities.formatDate(parseHouseholdDate_(startYmd), tz, 'MMM d');
  var endLabel = Utilities.formatDate(parseHouseholdDate_(endYmd), tz, sameMonth ? 'd' : 'MMM d');
  return startLabel + '–' + endLabel;
}

function subjectFor_(kind, window) {
  if (kind === 'weekly') return 'Your week ahead — ' + formatDateRangeShort_(window.start, window.end);
  return Utilities.formatDate(parseHouseholdDate_(window.start), getTimezone_(), 'MMMM') + ' at a glance';
}

/** Warm, app-consistent HTML body with **inline** owner-color styling (email clients strip
 *  external CSS) — Max/Jaz/Both hues from OWNER_EMAIL_HUE (DESIGN.md), grouped by day. */
function renderHtml_(kind, items) {
  if (items.length === 0) {
    return '<div style="font-family:sans-serif;background:#FAF6F0;padding:24px;color:#2A261F;">' +
      '<p style="font-size:16px;margin:0;">' + escapeHtml_(emptyStateMessage_(kind)) + '</p></div>';
  }
  var groups = groupByDate_(items).map(function (g) {
    var rows = g.items.map(function (it) {
      var hue = OWNER_EMAIL_HUE[it.owner] || OWNER_EMAIL_HUE.both;
      var timeLabel = it.time ? escapeHtml_(formatItemTimeLabel_(it.time)) + ' · ' : '';
      return '<div style="padding:3px 0;">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + hue + ';margin-right:8px;"></span>' +
        '<span style="color:' + hue + ';font-weight:600;">' + escapeHtml_(ownerLabel_(it.owner)) + '</span>' +
        ' — ' + timeLabel + escapeHtml_(it.title) +
        '</div>';
    }).join('');
    return '<div style="margin-bottom:14px;">' +
      '<div style="font-size:12px;color:#6E6656;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">' +
      escapeHtml_(formatItemDateLabel_(g.date)) + '</div>' + rows + '</div>';
  }).join('');
  return '<div style="font-family:sans-serif;background:#FAF6F0;padding:24px;color:#2A261F;">' + groups + '</div>';
}

/** Plain-text fallback (FR-007a) — same content, owner as a `[Max]`/`[Jaz]`/`[Both]` label. */
function renderText_(kind, items) {
  if (items.length === 0) return emptyStateMessage_(kind);
  return groupByDate_(items).map(function (g) {
    var lines = g.items.map(function (it) {
      var timeLabel = it.time ? formatItemTimeLabel_(it.time) + ' - ' : '';
      return '  [' + ownerLabel_(it.owner) + '] ' + timeLabel + it.title;
    });
    return formatItemDateLabel_(g.date) + ':\n' + lines.join('\n');
  }).join('\n\n');
}

/** Compose one recipient's digest — pure, no Sheet/Mail access (unit-testable in isolation). */
function buildDigest_(person, kind, window, events, tasks) {
  var items = relevantItemsFor_(person, window.start, window.end, events, tasks);
  return {
    person: person, kind: kind, window: window, items: items, count: items.length,
    subject: subjectFor_(kind, window),
    html: renderHtml_(kind, items),
    text: renderText_(kind, items)
  };
}

// ---------------------------------------------------------------------------
// Dedupe + send (research D2/D3) — ActivityLog is both the audit trail and the ledger
// ---------------------------------------------------------------------------

/** Deterministic per-period, per-person key (research D2). */
function periodKey_(kind, window, person) {
  if (kind === 'weekly') return 'weekly/' + window.start + '/' + person;
  return 'monthly/' + window.start.substring(0, 7) + '/' + person;
}

/** True iff ActivityLog already has a row for this `action`+`targetId` — the dedupe check. */
function alreadySent_(action, targetId) {
  var t = readTable_(TABS.ACTIVITY_LOG);
  for (var i = 0; i < t.records.length; i++) {
    if (t.records[i].action === action && t.records[i].targetId === targetId) return true;
  }
  return false;
}

/**
 * Send one recipient's digest, unless already sent for this period or their Settings email
 * is blank (FR-010). The check-send-log sequence runs under the script lock (research D3) so
 * a rare double-fire can't slip two sends past the dedupe check. Returns true iff it sent.
 */
function sendOne_(person, digest, settings) {
  var email = String(settings[person + 'Email'] || '').trim();
  if (email === '') {
    Logger.log('sendOne_: skipping ' + person + ' — no email set in Settings');
    return false;
  }
  var action = DIGEST_ACTION[digest.kind];
  var key = periodKey_(digest.kind, digest.window, person);
  var sent = false;
  withLock_(function () {
    if (alreadySent_(action, key)) return;
    MailApp.sendEmail({ to: email, subject: digest.subject, htmlBody: digest.html, body: digest.text });
    appendLog_('system', action, key,
      (digest.kind === 'weekly' ? 'emailed the week ahead to ' : 'emailed the month ahead to ') +
      person + ' (' + digest.count + ' item' + (digest.count === 1 ? '' : 's') + ')');
    sent = true;
  });
  return sent;
}

// ---------------------------------------------------------------------------
// Orchestration (per user story) + pure gate predicates
// ---------------------------------------------------------------------------

function runWeekly_(settings, events, tasks, today) {
  var window = weeklyWindow_(today);
  DIGEST_RECIPIENTS.forEach(function (person) {
    sendOne_(person, buildDigest_(person, 'weekly', window, events, tasks), settings);
  });
}

function runMonthly_(settings, events, tasks, today) {
  var window = monthlyWindow_(today);
  DIGEST_RECIPIENTS.forEach(function (person) {
    sendOne_(person, buildDigest_(person, 'monthly', window, events, tasks), settings);
  });
}

/** Pure decision (no Mail/Sheet access beyond the passed-in settings) — kept separate from
 *  sendDigests() so it is safe to unit-test the gate without any risk of a real send. */
function isWeeklySendDay_(settings, today) {
  if (!isEnabled_(settings, 'digestWeeklyEnabled')) return false;
  return parseHouseholdDate_(today).getDay() === resolveWeekday_(settings);
}

function isMonthlySendDay_(settings, today) {
  if (!isEnabled_(settings, 'digestMonthlyEnabled')) return false;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  var year = +m[1], month = +m[2], day = +m[3];
  return day === resolveMonthlyDay_(settings, year, month);
}

// ---------------------------------------------------------------------------
// Public entry points (no trailing underscore — trigger handler + editor-run, CLAUDE.md)
// ---------------------------------------------------------------------------

/**
 * The daily gate and trigger handler. Reads Settings once; sends the weekly and/or monthly
 * digest only when today matches the configured day and that digest is enabled (FR-008/015).
 * Idempotent — safe to run any number of times per day (dedupe via ActivityLog, research D2).
 */
function sendDigests() {
  var settings = readSettingsMap_();
  var today = todayYmd_();
  var events = listRecords_(TABS.EVENTS);
  var tasks = listRecords_(TABS.TASKS);
  if (isWeeklySendDay_(settings, today)) runWeekly_(settings, events, tasks, today);
  if (isMonthlySendDay_(settings, today)) runMonthly_(settings, events, tasks, today);
}

/** Manual test kick — bypasses only the weekday gate; still honors the enabled flag, the
 *  per-person dedupe, and missing-email skip (quickstart.md Scenario A). */
function sendWeeklyDigestNow() {
  var settings = readSettingsMap_();
  if (!isEnabled_(settings, 'digestWeeklyEnabled')) {
    Logger.log('sendWeeklyDigestNow: digestWeeklyEnabled is FALSE; nothing sent.');
    return;
  }
  runWeekly_(settings, listRecords_(TABS.EVENTS), listRecords_(TABS.TASKS), todayYmd_());
}

/** Manual test kick — bypasses only the day-of-month gate (quickstart.md Scenario B). */
function sendMonthlyDigestNow() {
  var settings = readSettingsMap_();
  if (!isEnabled_(settings, 'digestMonthlyEnabled')) {
    Logger.log('sendMonthlyDigestNow: digestMonthlyEnabled is FALSE; nothing sent.');
    return;
  }
  runMonthly_(settings, listRecords_(TABS.EVENTS), listRecords_(TABS.TASKS), todayYmd_());
}

/**
 * Install the single daily trigger for `sendDigests`. Idempotent: removes any existing
 * trigger for the same handler first. Run manually from the Apps Script editor after deploy,
 * and again any time `digestHour` changes (mirrors `installCalendarTrigger`).
 */
function installDigestTrigger() {
  var hour = resolveHour_(readSettingsMap_());
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDigests') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDigests')
    .timeBased()
    .atHour(hour)
    .everyDays(1)
    .create();
  Logger.log('installDigestTrigger: daily trigger installed at hour ' + hour);
}
