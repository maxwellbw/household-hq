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
      identity.actingPerson = payload.actingPerson; // preserve for read-side slice perspective (003 D4)
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

  'tasks.list':     function (p, actor, identity) { return listTasks_(p, actor, identity); },
  'tasks.create':   function (p, actor) { return { task: createTask_(p, actor) }; },
  'tasks.update':   function (p, actor) { return { task: updateTask_(p, actor) }; },
  'tasks.complete': function (p, actor) { return completeTask_(p, actor); },
  'tasks.reopen':   function (p, actor) { return reopenTask_(p, actor); },
  'tasks.delete':   function (p, actor) { return { id: deleteEntity_(TABS.TASKS, p, actor) }; },

  'templates.list': function () { return { templates: listRecords_(TABS.TEMPLATES) }; },
  'recurring.list':   function () { return { recurring: listRecords_(TABS.RECURRING) }; },
  'recurring.create': function (p, actor) { return { recurring: createRecurring_(p, actor) }; },
  'recurring.update': function (p, actor) { return { recurring: updateRecurring_(p, actor) }; },
  'recurring.delete': function (p, actor) { return { id: deleteEntity_(TABS.RECURRING, p, actor) }; },
  'settings.list':  function () { return { settings: readSettingsMap_() }; },

  // Feature 003: read the household activity feed (newest-first, bounded; read-only).
  'activity.list':  function (p) { return listActivity_(p); },

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

/**
 * List tasks, optionally sliced relative to the verified caller (FR-008/009/010). `filter`
 * ∈ mine|theirs|ours|all|default (default `all`, preserving 001). The slice's person is
 * derived server-side — never from a client "who am I" (FR-009): the caller's actor for a
 * personal account, or a confirmed `actingPerson` for the shared account on the
 * identity-relative slices (mine/theirs/default). `both` tasks live in ours/default only, so
 * mine/theirs/ours are disjoint and union to all. Slices include every status (owner-only).
 */
function listTasks_(payload, actor, identity) {
  var filter = payload.filter != null ? String(payload.filter).trim() : 'all';
  if (filter === '') filter = 'all';
  if (TASK_FILTERS.indexOf(filter) < 0) {
    fail_('VALIDATION_FAILED', 'Unknown filter "' + filter + '".', 'filter');
  }
  var tasks = listRecords_(TABS.TASKS);
  if (filter === 'all') return { tasks: tasks };
  if (filter === 'ours') {
    return { tasks: tasks.filter(function (t) { return t.owner === 'both'; }) };
  }
  var person = slicePerson_(actor, identity); // mine/theirs/default need a person
  var other = person === 'max' ? 'jaz' : 'max';
  var pred;
  if (filter === 'mine') pred = function (t) { return t.owner === person; };
  else if (filter === 'theirs') pred = function (t) { return t.owner === other; };
  else /* default */ pred = function (t) { return t.owner === person || t.owner === 'both'; };
  return { tasks: tasks.filter(pred) };
}

/**
 * The person an identity-relative slice is computed for. Personal accounts are themselves;
 * the shared account (no person) must confirm `actingPerson` ∈ {max,jaz}, mirroring 002's
 * write disambiguation (research D4). Never trusts a client identity for a personal caller.
 */
function slicePerson_(actor, identity) {
  if (actor === 'max' || actor === 'jaz') return actor;
  var ap = identity && identity.actingPerson != null
    ? String(identity.actingPerson).trim().toLowerCase() : '';
  if (ap === 'max' || ap === 'jaz') return ap;
  fail_('ACTING_PERSON_REQUIRED', 'Confirm Max or Jaz to use an identity-relative filter.');
}

function createTask_(payload, actor) {
  rejectUnknownFields_(TABS.TASKS, payload);
  requireFields_(payload, REQUIRED_ON_CREATE.Tasks);
  // New tasks always start `open` — there is no way to create one in another status
  // (feature 003 FR-001, tightening 001). An explicit non-open status is a client mistake;
  // complete a task after creating it via tasks.complete.
  if (payload.hasOwnProperty('status') && String(payload.status).trim() !== ''
      && String(payload.status).trim() !== 'open') {
    fail_('BAD_REQUEST', 'New tasks always start "open"; use tasks.complete afterwards.', 'status');
  }
  validateFields_(TABS.TASKS, payload);
  var rec = fullRecord_(TABS.TASKS, payload);
  rec.status = 'open';
  // completedBy/completedAt are server-managed (FR-002): a client-supplied value is ignored.
  rec.completedBy = '';
  rec.completedAt = '';
  return createRecord_(TABS.TASKS, rec, actor);
}

function updateTask_(payload, actor) {
  rejectUnknownFields_(TABS.TASKS, payload);
  requireFields_(payload, ['id']);
  // Lifecycle fields are not editable here — completion has exactly one path so the feed
  // never shows a completion as a generic "update" (feature 003 FR-015; supersedes 001's
  // status-via-update semantics, contracts/api-003.md). Use tasks.complete / tasks.reopen.
  ['status', 'completedBy', 'completedAt'].forEach(function (f) {
    if (payload.hasOwnProperty(f)) {
      fail_('BAD_REQUEST', 'Use tasks.complete / tasks.reopen to change status; "' + f +
        '" is not editable via tasks.update.', f);
    }
  });
  validateFields_(TABS.TASKS, payload);
  // Only title/owner/dueDate reach the patch; dueDate may be cleared (empty string) (FR-005).
  var patch = mutablePatch_(TABS.TASKS, payload);
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

/**
 * Complete a task (FR-002/003): status→done, stamp the verified completer + time, log
 * `complete`. Already-done is a no-change (changed:false, no new log row). One completion
 * closes a `both` task. Returns { task, changed }.
 */
function completeTask_(payload, actor) {
  requireFields_(payload, ['id']);
  return setTaskLifecycle_(String(payload.id).trim(), 'done', actor, 'complete');
}

/**
 * Reopen a task (FR-004): status→open, clear completion, log `reopen`. Either user may
 * reopen anything; the prior completion stays in the log. Already-open is a no-change.
 */
function reopenTask_(payload, actor) {
  requireFields_(payload, ['id']);
  return setTaskLifecycle_(String(payload.id).trim(), 'open', actor, 'reopen');
}

// ---------------------------------------------------------------------------
// Activity feed (US3)
// ---------------------------------------------------------------------------

/**
 * The household activity feed (FR-011/012/013): newest-first, bounded by `limit`
 * (default/max from Config) and optional ISO `since`. Read-only — never writes the log.
 */
function listActivity_(payload) {
  return { activity: readActivityFeed_({ limit: payload.limit, since: payload.since }) };
}
