/**
 * Api.js — the single web-app endpoint (contracts/api.md; research D1/D2).
 *
 * Transport: every operation is a text/plain POST to doPost carrying a JSON envelope;
 * doGet is a health ping only. HTTP status is always 200 — the `ok` field is the sole
 * success discriminator. All action handlers live here (the plan's flat structure has no
 * per-entity files); they lean on Sheets.js for storage and Validation.js for checks.
 */

// ---------------------------------------------------------------------------
// Envelope + error plumbing
// ---------------------------------------------------------------------------

/** Structured error carrier; fail_ throws it, doPost maps it to the error envelope. */
function AppError_(code, message, field) {
  this.isAppError = true;
  this.code = code;
  this.message = message;
  this.field = field;
}

/** Throw a closed-set error (contracts/api.md §Error codes). */
function fail_(code, message, field) {
  throw new AppError_(code, message, field);
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function okOut_(data) {
  return jsonOutput_({ ok: true, data: data });
}

function errorOut_(code, message, field) {
  var error = { code: code, message: message };
  if (field) error.field = field;
  return jsonOutput_({ ok: false, error: error });
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Health/version ping (contracts/api.md §Transport). No auth, no side effects. */
function doGet() {
  return okOut_({ service: SERVICE_NAME, version: API_VERSION });
}

/** Parse → route → envelope. Any thrown AppError_ maps to its code; anything else INTERNAL. */
function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse(e && e.postData ? e.postData.contents : '');
    } catch (parseErr) {
      return errorOut_('BAD_REQUEST', 'Request body is not valid JSON.');
    }
    if (!body || typeof body !== 'object') {
      return errorOut_('BAD_REQUEST', 'Request body must be a JSON object.');
    }
    var handler = HANDLERS[body.action];
    if (!handler) return errorOut_('UNKNOWN_ACTION', 'Unknown action: ' + body.action);

    var payload = body.payload || {};

    // Auth gate (feature 002): everything except the public `ping` requires a verified,
    // allowlisted identity. The gate runs before any handler or Sheet write, so rejected
    // requests read/write nothing (FR-001/FR-013). `actor` now comes from the verified
    // identity, never the client (FR-007).
    var actor = null;
    var identity = null;
    if (body.action !== 'ping') {
      identity = authenticate_(body.action, body.token, payload);
      actor = identity.actor;
      delete payload.actingPerson; // pop before entity validation — keeps 001's envelope frozen (A5)
    }
    return okOut_(handler(payload, actor, identity));
  } catch (err) {
    if (err && err.isAppError) return errorOut_(err.code, err.message, err.field);
    console.error('INTERNAL error in doPost: ' + (err && err.stack ? err.stack : err));
    return errorOut_('INTERNAL', 'An unexpected error occurred.');
  }
}

// ---------------------------------------------------------------------------
// Action registry (contracts/api.md §Actions)
// ---------------------------------------------------------------------------

var HANDLERS = {
  'ping': function () { return { service: SERVICE_NAME, version: API_VERSION }; },

  'events.list':   function () { return { events: listRecords_(TABS.EVENTS) }; },
  'events.create': function (p, actor) { return { event: createEvent_(p, actor) }; },
  'events.update': function (p, actor) { return { event: updateEvent_(p, actor) }; },
  'events.delete': function (p, actor) { return { id: deleteEntity_(TABS.EVENTS, p, actor) }; },

  'tasks.list':    function () { return { tasks: listRecords_(TABS.TASKS) }; },
  'tasks.create':  function (p, actor) { return { task: createTask_(p, actor) }; },
  'tasks.update':  function (p, actor) { return { task: updateTask_(p, actor) }; },
  'tasks.delete':  function (p, actor) { return { id: deleteEntity_(TABS.TASKS, p, actor) }; },

  'templates.list': function () { return { templates: listRecords_(TABS.TEMPLATES) }; },
  'recurring.list': function () { return { recurring: listRecords_(TABS.RECURRING) }; },
  'settings.list':  function () { return { settings: readSettingsMap_() }; },

  // Feature 002: "who am I" — identity + whether the client must confirm Max/Jaz (FR-009).
  'auth.whoami':    function (p, actor, identity) { return whoami_(identity); }
};

// ---------------------------------------------------------------------------
// Shared handler helpers
// ---------------------------------------------------------------------------

/** A full record with every header field present ('' for those not supplied). */
function fullRecord_(tabName, payload) {
  var rec = {};
  HEADERS[tabName].forEach(function (name) {
    rec[name] = payload.hasOwnProperty(name) ? String(payload[name]).trim() : '';
  });
  return rec;
}

/** Hard-delete an Event or Task by payload.id. */
function deleteEntity_(tabName, payload, actor) {
  requireFields_(payload, ['id']);
  return deleteRecordById_(tabName, String(payload.id).trim(), actor);
}

// ---------------------------------------------------------------------------
// Events (US2)
// ---------------------------------------------------------------------------

function createEvent_(payload, actor) {
  rejectUnknownFields_(TABS.EVENTS, payload);
  requireFields_(payload, REQUIRED_ON_CREATE.Events);
  validateFields_(TABS.EVENTS, payload);
  var rec = fullRecord_(TABS.EVENTS, payload);
  if (rec.end < rec.start) fail_('VALIDATION_FAILED', 'end must be on or after start.', 'end');
  return createRecord_(TABS.EVENTS, rec, actor);
}

function updateEvent_(payload, actor) {
  rejectUnknownFields_(TABS.EVENTS, payload);
  requireFields_(payload, ['id']);
  validateFields_(TABS.EVENTS, payload);
  var patch = mutablePatch_(TABS.EVENTS, payload);
  return updateRecordById_(TABS.EVENTS, String(payload.id).trim(), patch, actor, function (merged) {
    if (merged.start && merged.end && merged.end < merged.start) {
      fail_('VALIDATION_FAILED', 'end must be on or after start.', 'end');
    }
  });
}

// ---------------------------------------------------------------------------
// Tasks (US2)
// ---------------------------------------------------------------------------

function createTask_(payload, actor) {
  rejectUnknownFields_(TABS.TASKS, payload);
  requireFields_(payload, REQUIRED_ON_CREATE.Tasks);
  validateFields_(TABS.TASKS, payload);
  var rec = fullRecord_(TABS.TASKS, payload);
  if (rec.status === '') rec.status = 'open'; // default (data-model.md)
  // completedBy/completedAt are server-managed (FR-007): never honor a client-supplied
  // value — derive solely from the status. Creating a task already marked done stamps it.
  rec.completedBy = '';
  rec.completedAt = '';
  if (rec.status === 'done') {
    rec.completedBy = actor;
    rec.completedAt = nowIso_();
  }
  return createRecord_(TABS.TASKS, rec, actor);
}

function updateTask_(payload, actor) {
  rejectUnknownFields_(TABS.TASKS, payload);
  requireFields_(payload, ['id']);
  validateFields_(TABS.TASKS, payload);
  var patch = mutablePatch_(TABS.TASKS, payload);
  // completedBy/completedAt are server-managed (FR-007): drop any client-supplied value.
  delete patch.completedBy;
  delete patch.completedAt;
  // Status transitions manage the completion stamp (data-model.md lifecycle).
  if (patch.hasOwnProperty('status')) {
    if (patch.status === 'done') {
      patch.completedBy = actor;
      patch.completedAt = nowIso_();
    } else if (patch.status === 'open') {
      patch.completedBy = '';
      patch.completedAt = '';
    }
  }
  return updateRecordById_(TABS.TASKS, String(payload.id).trim(), patch, actor);
}

/** Provided header fields to change, excluding the id selector. */
function mutablePatch_(tabName, payload) {
  var patch = {};
  HEADERS[tabName].forEach(function (name) {
    if (name === 'id') return;
    if (payload.hasOwnProperty(name)) patch[name] = String(payload[name]).trim();
  });
  return patch;
}
