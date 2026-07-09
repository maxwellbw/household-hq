/**
 * CalendarSync.js — one-way outbound mirror of Events + dated Tasks to the shared
 * "Household" Google Calendar (feature 007). Pure `CalendarApp` (no advanced service, no
 * npm) plus the existing Sheet-as-DB engine. All dates/times are interpreted in the
 * household timezone (research D6); `addDays_` is reused from Recurring.js rather than
 * duplicated (Principle IV).
 *
 * Read layer:  getHouseholdCalendar_, resolveGcalEvent_, isEventDesired_/isTaskDesired_
 * Builders:    buildEntryTitle_, ownerColor_, applyReminders_/applyAllDayReminder_, tagEntry_
 * Write layer: setGcalPointer_ (locked single-cell pointer writer, logs `gcal-sync`)
 * Brain:       syncCalendarForEvent_, syncCalendarForTask_ — the one idempotent reconciler
 *              per kind, called both immediately (Api.js) and nightly (syncCalendar())
 * Trigger:     syncCalendar() + its orphan sweep, installCalendarTrigger()
 */

// ---------------------------------------------------------------------------
// Calendar resolution + the FR-014 no-op guard
// ---------------------------------------------------------------------------

/** The Household calendar, or null when `householdCalendarId` is unset/unresolvable
 *  (FR-014): every sync entry point checks this first and no-ops rather than erroring. */
function getHouseholdCalendar_() {
  var id = String(readSettingsMap_()['householdCalendarId'] || '').trim();
  if (id === '') return null;
  try {
    return CalendarApp.getCalendarById(id) || null;
  } catch (e) {
    return null;
  }
}

/** A calendar event by id, or null if missing/stale (FR-015) — never throws. */
function resolveGcalEvent_(calendar, id) {
  if (!id) return null;
  try {
    return calendar.getEventById(String(id).trim()) || null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure builders (research D4/D5/D6) — no Sheet/Calendar access, unit-testable in isolation
// ---------------------------------------------------------------------------

var OWNER_LABELS = { max: 'Max', jaz: 'Jaz', both: 'Both' };

function ownerLabel_(owner) {
  return OWNER_LABELS[owner] || String(owner || '');
}

/** `'[Jaz] Vet appointment'` — owner is never color-only (accessibility; DESIGN.md). */
function buildEntryTitle_(owner, title) {
  return '[' + ownerLabel_(owner) + '] ' + title;
}

/** Closest fixed Google `EventColor` to the DESIGN.md owner hue (research D4, Config.js). */
function ownerColor_(owner) {
  return OWNER_EVENT_COLOR[owner];
}

function todayYmd_() {
  return Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
}

/** A small recent-past grace so an event/task that just slipped into the past today is
 *  still swept correctly (research D6) — one day back, not a mirroring cap. */
function graceStartYmd_() {
  return addDays_(todayYmd_(), -1);
}

/** An Event belongs on the calendar while its end date is today or later (FR-010a). */
function isEventDesired_(event) {
  var endDate = String(event.end || '').substring(0, 10);
  return endDate !== '' && endDate >= todayYmd_();
}

/** A Task belongs on the calendar only while dated (today+), open/snoozed (FR-005/010a). */
function isTaskDesired_(task) {
  var due = String(task.dueDate || '').trim();
  if (due === '' || due < todayYmd_()) return false;
  return task.status === 'open' || task.status === 'snoozed';
}

/** Minutes-from-midnight for an `HH:mm` Settings value (research D5); falls back to 09:00.
 *  Not used by the live all-day mirror today (Google's all-day reminder clock-time is a
 *  per-viewer default, not per-event — see applyAllDayReminder_) — kept as the building
 *  block for the documented timed-entry fallback if quickstart Scenario D needs it. */
function taskReminderMinutesFromMidnight_(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return 9 * 60;
  return (+m[1]) * 60 + (+m[2]);
}

function eventReminderMinutes_() {
  var v = Number(readSettingsMap_()['gcalEventReminderMin']);
  return v > 0 ? v : 30;
}

/** `YYYY-MM-DDTHH:mm` → a household-tz wall-clock Date, matching Recurring.js's
 *  local-Date-construction convention (Apps Script's JVM default timezone is the script's
 *  project timeZone, which is the household timezone in practice). */
function parseHouseholdDatetime_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso));
  if (!m) fail_('VALIDATION_FAILED', 'Invalid datetime "' + iso + '" for calendar sync.');
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** `YYYY-MM-DD` → a household-tz wall-clock Date (midnight), for all-day entries. */
function parseHouseholdDate_(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd));
  if (!m) fail_('VALIDATION_FAILED', 'Invalid date "' + ymd + '" for calendar sync.');
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

// ---------------------------------------------------------------------------
// Reminders + tagging
// ---------------------------------------------------------------------------

/** Timed-event reminder: a single popup `minutesBefore` start (research D5). */
function applyReminders_(calEvent, minutesBefore) {
  try { calEvent.removeAllReminders(); } catch (e) { /* not fatal — reminder is best-effort */ }
  calEvent.addPopupReminder(minutesBefore);
}

/**
 * All-day-task reminder (research D5 — the documented risk). Google fires an all-day
 * event's popup at each subscriber's own "all-day event notification time" (commonly
 * 9am, matching our `gcalTaskReminderTime` default) — an event cannot override that
 * clock-time per viewer, only request "on the day" via minutes=0. If quickstart Scenario D
 * finds this unreliable, the documented fallback is a short **timed** entry at
 * `gcalTaskReminderTime` (via `taskReminderMinutesFromMidnight_`) instead of all-day.
 */
function applyAllDayReminder_(calEvent) {
  try { calEvent.removeAllReminders(); } catch (e) { /* not fatal */ }
  calEvent.addPopupReminder(0);
}

function tagEntry_(calEvent, kind, id) {
  calEvent.setTag('hhqKind', kind);
  calEvent.setTag('hhqId', id);
}

// ---------------------------------------------------------------------------
// The locked pointer writer (mirrors Sheets.js's locked single-cell adoption write)
// ---------------------------------------------------------------------------

/**
 * Write `gcalEventId` on the row identified by `recordId` in `tabName`, under the script
 * lock (serializes against concurrent writers — Principle V). A vanished row (deleted
 * mid-flight) is silently skipped — nothing left to point at. Logs one `gcal-sync`
 * ActivityLog row when `detail` is given (research D9); a bare pointer-clear with no
 * meaningful action (stale pointer, nothing to delete) passes '' and logs nothing.
 */
function setGcalPointer_(tabName, recordId, gcalEventId, detail) {
  withLock_(function () {
    var t = readTable_(tabName);
    var rec = findRecord_(t, recordId);
    if (!rec) return;
    var col = t.headerMap['gcalEventId'];
    var range = t.sheet.getRange(rec._row, col + 1);
    range.setNumberFormat('@');
    range.setValue(gcalEventId || '');
  });
  if (detail) appendLog_('system', 'gcal-sync', recordId, detail);
}

// ---------------------------------------------------------------------------
// The reconciler brain (research D2/D3) — one idempotent function per kind
// ---------------------------------------------------------------------------

/**
 * Reconcile one Event against the Household calendar (US1; FR-001/003/004/009/015).
 * Branches on the stored pointer + desired-state (data-model.md lifecycle table):
 *   - not desired, pointer resolves  → delete the entry, clear the pointer
 *   - not desired, pointer stale     → just clear the pointer
 *   - desired, pointer blank/stale   → create, tag, store the new pointer
 *   - desired, pointer resolves      → update the same entry in place
 * Safe to call any number of times (Principle V) — creation is gated on "no resolvable
 * pointer," so re-runs/overlaps never duplicate.
 */
function syncCalendarForEvent_(event, actor) {
  var calendar = getHouseholdCalendar_();
  if (!calendar) return; // FR-014

  var pointer = String(event.gcalEventId || '').trim();
  var existing = pointer ? resolveGcalEvent_(calendar, pointer) : null;
  var desired = isEventDesired_(event);

  if (!desired) {
    if (existing) {
      existing.deleteEvent();
      setGcalPointer_(TABS.EVENTS, event.id, '',
        'removed calendar event for "' + event.title + '"');
    } else if (pointer) {
      setGcalPointer_(TABS.EVENTS, event.id, '', '');
    }
    return;
  }

  var title = buildEntryTitle_(event.owner, event.title);
  var start = parseHouseholdDatetime_(event.start);
  var end = parseHouseholdDatetime_(event.end);
  var minutesBefore = eventReminderMinutes_();

  if (existing) {
    existing.setTitle(title);
    existing.setTime(start, end);
    existing.setColor(ownerColor_(event.owner));
    applyReminders_(existing, minutesBefore);
    return;
  }

  var created = calendar.createEvent(title, start, end);
  created.setColor(ownerColor_(event.owner));
  applyReminders_(created, minutesBefore);
  tagEntry_(created, 'event', event.id);
  setGcalPointer_(TABS.EVENTS, event.id, created.getId(),
    'created calendar event for "' + event.title + '"');
}

/**
 * Reconcile one dated Task against the Household calendar (US2; FR-005/006/009/015).
 * Same pointer/desired branching as `syncCalendarForEvent_`, using an all-day entry on
 * `dueDate`. Not-desired covers done, deleted, undated, and past-dated tasks alike.
 */
function syncCalendarForTask_(task, actor) {
  var calendar = getHouseholdCalendar_();
  if (!calendar) return; // FR-014

  var pointer = String(task.gcalEventId || '').trim();
  var existing = pointer ? resolveGcalEvent_(calendar, pointer) : null;
  var desired = isTaskDesired_(task);

  if (!desired) {
    if (existing) {
      existing.deleteEvent();
      setGcalPointer_(TABS.TASKS, task.id, '',
        'removed calendar event for "' + task.title + '"');
    } else if (pointer) {
      setGcalPointer_(TABS.TASKS, task.id, '', '');
    }
    return;
  }

  var title = buildEntryTitle_(task.owner, task.title);
  var dueDate = parseHouseholdDate_(task.dueDate);

  if (existing) {
    existing.setTitle(title);
    existing.setAllDayDate(dueDate);
    existing.setColor(ownerColor_(task.owner));
    applyAllDayReminder_(existing);
    return;
  }

  var created = calendar.createAllDayEvent(title, dueDate);
  created.setColor(ownerColor_(task.owner));
  applyAllDayReminder_(created);
  tagEntry_(created, 'task', task.id);
  setGcalPointer_(TABS.TASKS, task.id, created.getId(),
    'created calendar event for "' + task.title + '"');
}

/**
 * Unconditionally remove a record's calendar mirror, if any — used by the delete API
 * paths (`deleteEvent_`/`deleteTask_`), where the Sheet row is already gone by the time the
 * caller mirrors, so the desired-state brains above can't be reused (they read the row).
 * Safe to call with a blank pointer (no-op).
 */
function removeCalendarMirrorForDeleted_(tabName, recordId, pointer, title) {
  var calendar = getHouseholdCalendar_();
  if (!calendar) return;
  var id = String(pointer || '').trim();
  if (id === '') return;
  var existing = resolveGcalEvent_(calendar, id);
  if (existing) existing.deleteEvent();
  setGcalPointer_(tabName, recordId, '', 'removed calendar event for "' + title + '"');
}

// ---------------------------------------------------------------------------
// The nightly reconcile + orphan sweep (US3, FR-010) and its trigger installer
// ---------------------------------------------------------------------------

/** Pragmatic sweep bound (research D6) — distinct from the mirroring window itself (which
 *  has no far cap): a two-person household's live items are never plausibly years out, so
 *  bounding the *sweep scan* keeps `getEvents` cheap without limiting what gets mirrored. */
var ORPHAN_SWEEP_DAYS_AHEAD = 730;

/**
 * Reconcile every Event/Task against the Household calendar. Trigger entry point; also
 * safe to run from the editor. One record's failure is isolated so it can't abort the rest
 * (Apps Script triggers get no user to report an error to), mirroring
 * `generateRecurringTasks`/`generatePrepTasks`. Finishes with the orphan sweep, which finds
 * app-created entries (tagged `hhqId`) whose backing row is gone — the only way a
 * hand-deleted Sheet row is ever noticed (the write path never saw it delete).
 *
 * NOTE: public name (no trailing underscore) on purpose — trigger handlers and editor-run
 * entry points must not use the private-underscore convention (CLAUDE.md).
 */
function syncCalendar() {
  var calendar = getHouseholdCalendar_();
  if (!calendar) {
    Logger.log('syncCalendar: householdCalendarId not set; skipping.');
    return;
  }

  var events = listRecords_(TABS.EVENTS);
  events.forEach(function (event) {
    try {
      syncCalendarForEvent_(event, 'system');
    } catch (err) {
      console.error('syncCalendar: event ' + event.id + ' failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  var tasks = listRecords_(TABS.TASKS);
  tasks.forEach(function (task) {
    try {
      syncCalendarForTask_(task, 'system');
    } catch (err) {
      console.error('syncCalendar: task ' + task.id + ' failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  sweepOrphanCalendarEntries_(calendar, events, tasks);
}

/** Delete any app-tagged calendar entry whose record no longer exists or is no longer
 *  desired (FR-010, FR-013: untagged/manual entries are never touched). */
function sweepOrphanCalendarEntries_(calendar, events, tasks) {
  var desiredIds = {};
  events.forEach(function (e) { if (isEventDesired_(e)) desiredIds[e.id] = true; });
  tasks.forEach(function (t) { if (isTaskDesired_(t)) desiredIds[t.id] = true; });

  var start = parseHouseholdDate_(graceStartYmd_());
  var end = parseHouseholdDate_(addDays_(todayYmd_(), ORPHAN_SWEEP_DAYS_AHEAD));
  var entries = calendar.getEvents(start, end);
  entries.forEach(function (entry) {
    var hhqId = entry.getTag('hhqId');
    if (!hhqId || desiredIds[hhqId]) return;
    var kind = entry.getTag('hhqKind') || 'entry';
    entry.deleteEvent();
    appendLog_('system', 'gcal-sync', hhqId,
      'removed orphaned calendar ' + kind + ' with no backing row');
  });
}

/**
 * Install the single nightly trigger for `syncCalendar`. Idempotent: removes any existing
 * trigger for the same handler first, so re-running never stacks duplicates. Run manually
 * from the Apps Script editor after deploy (mirrors `installRecurringTrigger`/
 * `installPrepTrigger`).
 */
function installCalendarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncCalendar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncCalendar')
    .timeBased()
    .atHour(GCAL_TRIGGER_HOUR)
    .everyDays(1)
    .create();
  Logger.log('installCalendarTrigger: nightly trigger installed at hour ' + GCAL_TRIGGER_HOUR);
}
