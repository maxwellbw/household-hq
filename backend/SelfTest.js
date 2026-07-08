/**
 * SelfTest.js — manually-run end-to-end checks (plan.md "keep it boring": Apps Script
 * has no test runner). Run `selfTest()` from the editor after any backend change; the
 * execution log ends with `ALL PASS` or throws at the first failed assertion.
 *
 * It writes to the live Sheet using a recognizable id prefix and cleans up after itself.
 * setupDatabase() must have been run first.
 */

var SELFTEST_PREFIX = 'selftest-';

function selfTest() {
  unitValidators_();
  unitAuth_();
  liveCrudRoundTrip_();
  liveErrorCases_();
  liveHandEditResilience_();
  Logger.log('ALL PASS');
}

function assert_(cond, message) {
  if (!cond) throw new Error('SelfTest FAILED: ' + message);
}

/**
 * One-time authorization helper (feature 002). Run this from the editor after adding the
 * `script.external_request` scope: it calls UrlFetchApp, so Apps Script prompts for the
 * new scope, and it confirms the token-verification fetch actually works. Expect the log
 * to read `external_request OK — tokeninfo HTTP 400` (400 = our dummy token is rejected by
 * Google, which is exactly right; the point is the fetch itself succeeded).
 */
function checkExternalRequestAuth() {
  try {
    var resp = UrlFetchApp.fetch(TOKENINFO_URL + 'dummy', { muteHttpExceptions: true });
    Logger.log('external_request OK — tokeninfo HTTP ' + resp.getResponseCode());
  } catch (e) {
    Logger.log('external_request FAILED (authorize the scope): ' + e);
  }
}

/** Expect fn() to throw an AppError_ with the given code. */
function assertFails_(code, fn, message) {
  try {
    fn();
  } catch (err) {
    assert_(err && err.isAppError && err.code === code,
      message + ' (expected ' + code + ', got ' + (err && err.code ? err.code : err) + ')');
    return;
  }
  assert_(false, message + ' (expected ' + code + ', but nothing threw)');
}

// ---------------------------------------------------------------------------
// Unit: validators (no Sheet needed)
// ---------------------------------------------------------------------------

function unitValidators_() {
  assert_(isValidType_('owner', 'both'), 'owner both valid');
  assert_(!isValidType_('owner', 'dog'), 'owner dog invalid');
  assert_(isValidType_('date', '2026-07-20'), 'date valid');
  assert_(!isValidType_('date', '2026-13-01'), 'month 13 invalid');
  assert_(!isValidType_('date', 'garbage'), 'garbage date invalid');
  assert_(isValidType_('datetime', '2026-07-20T14:30'), 'datetime valid');
  assert_(!isValidType_('datetime', '2026-07-20 14:30'), 'space datetime invalid');
  assert_(isValidType_('month', '12') && !isValidType_('month', '0'), 'month range');

  // Season window rule (feature 004 reuse; wrap-around legal).
  validateSeasonWindow_('', '');       // year-round: no throw
  validateSeasonWindow_('11', '2');    // Nov–Feb wrap: no throw
  assertFails_('VALIDATION_FAILED', function () { validateSeasonWindow_('4', ''); }, 'half season rejected');
  assertFails_('VALIDATION_FAILED', function () { validateSeasonWindow_('13', '2'); }, 'month 13 rejected');
  Logger.log('unit validators: pass');
}

// ---------------------------------------------------------------------------
// Unit: auth identity resolution (feature 002; no Sheet/network needed)
// ---------------------------------------------------------------------------

function unitAuth_() {
  var lists = { maxEmail: 'max@x.com', jazEmail: 'jaz@x.com', shared: ['shared@x.com'] };

  // Personal accounts map directly; matching is case-insensitive (FR-003/FR-007).
  assert_(matchIdentity_({ email: 'MAX@X.com' }, lists).actor === 'max', 'max resolves (case-insensitive)');
  assert_(matchIdentity_({ email: 'jaz@x.com' }, lists).identity === 'jaz', 'jaz resolves');

  // Shared account authenticates but has no person yet (actor null) — A5.
  var shared = matchIdentity_({ email: 'shared@x.com', name: 'Household' }, lists);
  assert_(shared.identity === 'shared' && shared.actor === null, 'shared resolves with no actor');

  // Non-allowlisted → FORBIDDEN; empty allowlist → fail closed (FR-003/FR-005/SC-006).
  assertFails_('FORBIDDEN', function () { matchIdentity_({ email: 'stranger@x.com' }, lists); }, 'stranger forbidden');
  assertFails_('ALLOWLIST_MISCONFIGURED', function () {
    matchIdentity_({ email: 'max@x.com' }, { maxEmail: '', jazEmail: '', shared: [] });
  }, 'empty allowlist fails closed');

  // Shared-account write disambiguation (FR-014): missing/invalid actingPerson rejected;
  // a confirmed one becomes the actor; reads never require it.
  assertFails_('ACTING_PERSON_REQUIRED', function () {
    resolveWriteActor_(shared, 'tasks.create', {});
  }, 'shared write without actingPerson rejected');
  assertFails_('ACTING_PERSON_REQUIRED', function () {
    resolveWriteActor_(shared, 'tasks.create', { actingPerson: 'bob' });
  }, 'shared write with bad actingPerson rejected');
  assert_(resolveWriteActor_(shared, 'tasks.create', { actingPerson: 'JAZ' }) === 'jaz',
    'shared write with actingPerson jaz → actor jaz');
  assert_(resolveWriteActor_(shared, 'tasks.list', {}) === null, 'shared read needs no actingPerson');

  // Personal callers ignore actingPerson entirely.
  var max = matchIdentity_({ email: 'max@x.com' }, lists);
  assert_(resolveWriteActor_(max, 'tasks.create', { actingPerson: 'jaz' }) === 'max',
    'personal caller ignores actingPerson');

  // Write-action classification.
  assert_(isWriteAction_('tasks.create') && isWriteAction_('events.delete'), 'writes classified');
  assert_(!isWriteAction_('tasks.list') && !isWriteAction_('auth.whoami'), 'reads not writes');
  Logger.log('unit auth: pass');
}

// ---------------------------------------------------------------------------
// Live: CRUD round-trip on Tasks (SC-003, SC-005, SC-006)
// ---------------------------------------------------------------------------

function liveCrudRoundTrip_() {
  var id = SELFTEST_PREFIX + Utilities.getUuid();
  var actor = 'selftest';

  // A spoofed completedBy in the body must be ignored — attribution is server-managed (FR-007).
  var created = createTask_({ id: id, title: 'flea meds', owner: 'both', dueDate: '2026-07-20', completedBy: 'jaz' }, actor);
  assert_(created.id === id, 'create echoes client id');
  assert_(created.status === 'open', 'create defaults status open');
  assert_(created.completedBy === '', 'client-supplied completedBy ignored on open create');

  // Idempotent replay returns the same record, no duplicate.
  var replay = createTask_({ id: id, title: 'flea meds', owner: 'both' }, actor);
  assert_(replay.id === id, 'replay returns same id');
  assert_(countTaskRows_(id) === 1, 'replay creates no duplicate row');

  var listed = listRecords_(TABS.TASKS).filter(function (t) { return t.id === id; });
  assert_(listed.length === 1, 'list contains the task once');

  var done = updateTask_({ id: id, status: 'done' }, actor);
  assert_(done.status === 'done' && done.completedBy === actor && done.completedAt !== '',
    'done stamps completedBy/completedAt');

  var reopened = updateTask_({ id: id, status: 'open' }, actor);
  assert_(reopened.completedBy === '' && reopened.completedAt === '', 'reopen clears completion');

  deleteRecordById_(TABS.TASKS, id, actor);
  assert_(countTaskRows_(id) === 0, 'delete removes the row');
  Logger.log('live CRUD: pass');
}

function countTaskRows_(id) {
  return listRecords_(TABS.TASKS).filter(function (t) { return t.id === id; }).length;
}

// ---------------------------------------------------------------------------
// Live: errors keep the envelope (SC-002)
// ---------------------------------------------------------------------------

function liveErrorCases_() {
  assertFails_('VALIDATION_FAILED', function () {
    createTask_({ title: 'x', owner: 'dog' }, 'selftest');
  }, 'bad owner rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createTask_({ owner: 'max' }, 'selftest'); // missing title
  }, 'missing title rejected');
  assertFails_('BAD_REQUEST', function () {
    createTask_({ title: 'x', owner: 'max', bogus: 'y' }, 'selftest');
  }, 'unknown field rejected');
  assertFails_('NOT_FOUND', function () {
    updateTask_({ id: 'no-such-id', status: 'done' }, 'selftest');
  }, 'update unknown id rejected');
  assert_(!HANDLERS['nope.nope'], 'unknown action absent from registry');
  Logger.log('live errors: pass');
}

// ---------------------------------------------------------------------------
// Live: hand-edit resilience — blank-ID adoption (FR-022, SC-004)
// ---------------------------------------------------------------------------

function liveHandEditResilience_() {
  var sheet = getSheet_(TABS.TASKS);
  var t = readTable_(TABS.TASKS);
  var title = SELFTEST_PREFIX + 'adopt-me';
  // Append a hand-style row with a blank id but a title.
  var row = buildRowArray_(t, { title: title, owner: 'jaz', status: 'open' }, null);
  sheet.appendRow(row);
  SpreadsheetApp.flush();

  var adopted = listRecords_(TABS.TASKS).filter(function (r) { return r.title === title; });
  assert_(adopted.length === 1 && adopted[0].id && adopted[0].id.length > 0,
    'blank-id row adopted with a generated id');

  deleteRecordById_(TABS.TASKS, adopted[0].id, 'selftest');
  Logger.log('live hand-edit resilience: pass');
}
