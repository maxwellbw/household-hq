/**
 * PrepTasks.js — event prep-checklist generation (feature 005).
 *
 * Pure id/date helpers (no Sheet access) plus the idempotent sync brain, the nightly
 * generator, and its trigger installer. All dates are `YYYY-MM-DD` strings in the
 * household timezone; the generator writes through the existing Sheets.js primitives so
 * every mutation stays locked, idempotent, and logged. `addDays_` is reused from
 * Recurring.js (feature 004) rather than duplicated (Principle IV).
 */

// ---------------------------------------------------------------------------
// Pure id/date math (research D1, D5) — no Sheet/network access, unit-testable in isolation
// ---------------------------------------------------------------------------

/**
 * The deterministic id for a generated prep Task (research D1) —
 * `'p' + hex(MD5(eventId + '|' + templateStepId))`. Date-independent: the same event and
 * checklist step always produce the same id, so re-dating the event (a moved start) updates
 * this same row instead of orphaning it, and `createRecord_`'s id-replay collapses re-runs
 * and overlapping executions to a single row instead of duplicating.
 */
function prepTaskId_(eventId, stepId) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, eventId + '|' + stepId);
  var hex = bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return 'p' + hex;
}

/**
 * True if `id` has the shape of a generated prep task (`'p'` + 32 hex chars). A
 * `Utilities.getUuid()` id has hyphens and the wrong length, so it never matches — this
 * lets cleanup target only generator-created prep tasks and never a user's manually
 * event-linked task (research D1).
 */
function isPrepTaskId_(id) {
  return /^p[0-9a-f]{32}$/.test(String(id || ''));
}

/**
 * A prep task's due date: the event's `start` date part shifted by a signed `offsetDays`
 * (research D5). `offsetDays` is negative for "days before" (e.g. `-2` = two days before
 * the event's start); the result may fall in the past (FR-018) — not clamped. Reuses
 * `addDays_` from Recurring.js.
 */
function prepDueDate_(eventStart, offsetDays) {
  var datePart = String(eventStart).substring(0, 10);
  return addDays_(datePart, Number(offsetDays));
}

// ---------------------------------------------------------------------------
// The sync brain (research D2/D3) — the one idempotent reconciler for every call site
// ---------------------------------------------------------------------------

/**
 * Reconcile one event's prep tasks against its current `templateId` (research D3). Called
 * synchronously after `events.create`/`events.update` and, per event, by the nightly
 * `generatePrepTasks()` trigger — all three paths are safe to call any number of times.
 *
 * - **Transition** (`event.templateId !== event.prepGeneratedFor`): the event was just
 *   tagged, retagged, or cleared (or is a hand-added/hand-edited row never reconciled).
 *   Outstanding (open) prep tasks belonging to the *old* template are removed (completed
 *   prep is left as history — FR-016); the desired set for the *current* template is
 *   created (deterministic ids replay a still-present completed task instead of
 *   duplicating it); `prepGeneratedFor` advances to the current `templateId`.
 * - **Steady state** (`===`): no creation — a hand-deleted prep task is never resurrected
 *   (FR-014). Outstanding survivors whose desired due date has changed (the event moved)
 *   are re-dated (FR-015); completed prep is left untouched.
 *
 * No outer lock — each `createRecord_`/`updateRecordById_`/`deleteRecordById_` call locks
 * and logs itself and is independently idempotent (Principle V), so this function is safe
 * under concurrent/overlapping callers.
 */
function syncPrepForEvent_(event, actor) {
  var templateId = String(event.templateId || '').trim();
  var generatedFor = String(event.prepGeneratedFor || '').trim();

  var existingPrep = listRecords_(TABS.TASKS).filter(function (t) {
    return t.eventId === event.id && isPrepTaskId_(t.id);
  });
  var steps = templateId === '' ? [] : listRecords_(TABS.TEMPLATES).filter(function (s) {
    return s.eventType === templateId;
  });
  var desired = steps.map(function (s) {
    return {
      id: prepTaskId_(event.id, s.id),
      title: s.taskTitle,
      dueDate: prepDueDate_(event.start, s.offsetDays),
      owner: s.defaultOwner,
      status: 'open',
      eventId: event.id
    };
  });
  var desiredIds = {};
  desired.forEach(function (d) { desiredIds[d.id] = true; });

  if (templateId !== generatedFor) {
    // Transition: retire the old template's outstanding leftovers, keep completed history.
    existingPrep.forEach(function (t) {
      if (t.status === 'open' && !desiredIds[t.id]) {
        deleteRecordById_(TABS.TASKS, t.id, actor);
      }
    });
    desired.forEach(function (d) {
      createRecord_(TABS.TASKS, d, 'system');
    });
    updateRecordById_(TABS.EVENTS, event.id, { prepGeneratedFor: templateId }, 'system');
  } else {
    // Steady state: re-date outstanding survivors; never create (no resurrection).
    var byId = {};
    existingPrep.forEach(function (t) { byId[t.id] = t; });
    desired.forEach(function (d) {
      var existing = byId[d.id];
      if (existing && existing.status === 'open' && existing.dueDate !== d.dueDate) {
        updateRecordById_(TABS.TASKS, d.id, { dueDate: d.dueDate }, 'system');
      }
    });
  }
}

// ---------------------------------------------------------------------------
// The nightly generator (FR-008/011/014/015/016) and its trigger installer
// ---------------------------------------------------------------------------

/**
 * Reconcile prep for every event. Trigger entry point; also safe to run from the editor.
 * One event's failure is isolated so it can't abort reconciliation for the rest (Apps
 * Script triggers get no user to report an error to), mirroring `generateRecurringTasks`.
 */
function generatePrepTasks() {
  var events = listRecords_(TABS.EVENTS);
  events.forEach(function (event) {
    try {
      syncPrepForEvent_(event, 'system');
    } catch (err) {
      console.error('generatePrepTasks: event ' + event.id + ' failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });
}

/**
 * Install the single nightly trigger for `generatePrepTasks`. Idempotent: removes any
 * existing trigger for the same handler first, so re-running never stacks duplicates. Run
 * manually from the Apps Script editor after deploy (mirrors `installRecurringTrigger`).
 * Reuses the `script.scriptapp` scope already granted for feature 004 — no new
 * authorization is required.
 *
 * NOTE: public name (no trailing underscore) on purpose — the editor's Run menu and the
 * trigger system both ignore underscore-suffixed "private" functions.
 */
function installPrepTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'generatePrepTasks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generatePrepTasks')
    .timeBased()
    .atHour(PREP_TRIGGER_HOUR)
    .everyDays(1)
    .create();
  Logger.log('installPrepTrigger: nightly trigger installed at hour ' + PREP_TRIGGER_HOUR);
}
