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
  unitOccurrenceMath_();
  liveCrudRoundTrip_();
  liveTaskSlices_();
  liveActivityFeed_();
  liveErrorCases_();
  liveHandEditResilience_();
  liveRecurringGeneration_();
  liveRecurringCrud_();
  liveRecurringCatchUp_();
  liveEventCrud_();
  liveTemplateCrud_();
  unitPrepMath_();
  livePrepGeneration_();
  livePrepLifecycle_();
  unitCalendarSync_();
  liveCalendarEventSync_();
  liveCalendarTaskSync_();
  liveCalendarReconcile_();
  unitDigests_();
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

/**
 * One-time authorization helper (feature 007). Run this from the editor after adding the
 * `calendar` scope: it calls CalendarApp directly, so Apps Script prompts for the new scope
 * right away — independent of whether Settings `householdCalendarId` is set yet (the sync
 * code itself no-ops on a blank id per FR-014, so it never triggers the prompt on its own).
 * Expect the log to read `calendar OK — N owned calendar(s) visible to this account.`
 */
function checkCalendarAuth() {
  try {
    var cals = CalendarApp.getAllOwnedCalendars();
    Logger.log('calendar OK — ' + cals.length + ' owned calendar(s) visible to this account.');
  } catch (e) {
    Logger.log('calendar FAILED (authorize the scope): ' + e);
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

  // Completion is a dedicated action now (feature 003): complete stamps, re-complete is a
  // no-change (FR-003), reopen clears + logs 'reopen'; status via update is refused (FR-015).
  var done = completeTask_({ id: id }, actor);
  assert_(done.changed === true && done.task.status === 'done' &&
    done.task.completedBy === actor && done.task.completedAt !== '',
    'complete stamps completedBy/completedAt (changed:true)');
  assert_(countLogRows_(id, 'complete') === 1, 'complete appends exactly one complete log row');

  var again = completeTask_({ id: id }, 'someone-else');
  assert_(again.changed === false && again.task.completedBy === actor &&
    again.task.completedAt === done.task.completedAt,
    're-complete is a no-change: original completer/time preserved (FR-003)');
  assert_(countLogRows_(id, 'complete') === 1, 're-complete adds no new log row (SC-006)');

  var reopened = reopenTask_({ id: id }, 'jaz'); // either user may reopen (FR-004)
  assert_(reopened.changed === true && reopened.task.status === 'open' &&
    reopened.task.completedBy === '' && reopened.task.completedAt === '',
    'reopen clears completion (changed:true)');
  assert_(countLogRows_(id, 'reopen') === 1, 'reopen appends a reopen log row');
  assert_(reopenTask_({ id: id }, 'jaz').changed === false, 're-open of an open task is a no-change');

  assertFails_('BAD_REQUEST', function () {
    updateTask_({ id: id, status: 'done' }, actor);
  }, 'status via tasks.update rejected (use complete/reopen)');

  deleteRecordById_(TABS.TASKS, id, actor);
  assert_(countTaskRows_(id) === 0, 'delete removes the row');
  Logger.log('live CRUD: pass');
}

function countTaskRows_(id) {
  return listRecords_(TABS.TASKS).filter(function (t) { return t.id === id; }).length;
}

/** Count ActivityLog rows for a target id, optionally filtered to one action. */
function countLogRows_(targetId, action) {
  return readTable_(TABS.ACTIVITY_LOG).records.filter(function (r) {
    return r.targetId === targetId && (!action || r.action === action);
  }).length;
}

// ---------------------------------------------------------------------------
// Live: task slices — mine/theirs/ours/all/default (feature 003 US2, FR-008/009, SC-002)
// ---------------------------------------------------------------------------

function liveTaskSlices_() {
  var pfx = SELFTEST_PREFIX + 'slice-';
  var mx = createTask_({ title: pfx + 'max', owner: 'max' }, 'selftest').id;
  var jz = createTask_({ title: pfx + 'jaz', owner: 'jaz' }, 'selftest').id;
  var bo = createTask_({ title: pfx + 'both', owner: 'both' }, 'selftest').id;
  var seeded = [mx, jz, bo];
  // Restrict each slice to the seeded ids so unrelated rows in the live Sheet don't matter.
  var ids = function (res) {
    return res.tasks
      .filter(function (t) { return seeded.indexOf(t.id) >= 0; })
      .map(function (t) { return t.id; }).sort();
  };

  // As Max (personal actor; identity unused for personal callers).
  var mine = ids(listTasks_({ filter: 'mine' }, 'max', null));
  var theirs = ids(listTasks_({ filter: 'theirs' }, 'max', null));
  var ours = ids(listTasks_({ filter: 'ours' }, 'max', null));
  var all = ids(listTasks_({ filter: 'all' }, 'max', null));
  var def = ids(listTasks_({ filter: 'default' }, 'max', null));
  assert_(mine.length === 1 && mine[0] === mx, 'max mine = max-owned only');
  assert_(theirs.length === 1 && theirs[0] === jz, 'max theirs = jaz-owned only');
  assert_(ours.length === 1 && ours[0] === bo, 'ours = both-owned only');
  assert_(all.length === 3, 'all = every seeded task');
  assert_(mine.concat(theirs, ours).sort().join(',') === all.join(','),
    'mine ∪ theirs ∪ ours = all, pairwise-disjoint (SC-002)');
  assert_(def.join(',') === [mx, bo].sort().join(','), 'default = mine ∪ ours');

  // As Jaz — the identity-relative slice flips (follows the verified caller, FR-009).
  var jazMine = ids(listTasks_({ filter: 'mine' }, 'jaz', null));
  assert_(jazMine.length === 1 && jazMine[0] === jz, 'jaz mine = jaz-owned (caller-relative)');

  assertFails_('VALIDATION_FAILED', function () {
    listTasks_({ filter: 'bogus' }, 'max', null);
  }, 'unknown filter rejected');

  seeded.forEach(function (id) { deleteRecordById_(TABS.TASKS, id, 'selftest'); });
  Logger.log('live slices: pass');
}

// ---------------------------------------------------------------------------
// Live: activity feed — newest-first, bounded, survives deletion (US3, FR-011/012/013)
// ---------------------------------------------------------------------------

function liveActivityFeed_() {
  var id = SELFTEST_PREFIX + Utilities.getUuid();
  createTask_({ id: id, title: 'feed probe', owner: 'jaz' }, 'jaz');
  completeTask_({ id: id }, 'jaz');
  deleteRecordById_(TABS.TASKS, id, 'max'); // target gone; feed must still read (FR-013)

  var mine = readActivityFeed_({ limit: 100 }).filter(function (e) { return e.targetId === id; });
  assert_(mine.length >= 3, 'create + complete + delete all present in the feed');

  // Newest-first (append order reversed): delete precedes complete precedes create.
  var seq = mine.map(function (e) { return e.action; });
  assert_(seq.indexOf('delete') < seq.indexOf('complete') &&
    seq.indexOf('complete') < seq.indexOf('create'), 'feed is newest-first');

  var completeEntry = mine.filter(function (e) { return e.action === 'complete'; })[0];
  assert_(completeEntry, 'complete is its own action in the feed, not update (FR-015)');
  assert_(completeEntry.summary.indexOf('Jaz') === 0 &&
    completeEntry.summary.indexOf('completed') > 0 &&
    completeEntry.summary.indexOf('feed probe') > 0,
    'summary names actor + action + title even for a deleted target (SC-005)');

  // Bounding.
  assert_(readActivityFeed_({ limit: 1 }).length === 1, 'limit bounds the feed');
  assert_(readActivityFeed_({ since: '2999-01-01T00:00' }).length === 0,
    'since in the future returns an empty feed');
  Logger.log('live feed: pass');
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
    updateTask_({ id: 'no-such-id', title: 'ghost' }, 'selftest'); // status not editable now (003)
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

// ---------------------------------------------------------------------------
// Unit: recurring occurrence math (feature 004; no Sheet needed)
// ---------------------------------------------------------------------------

function unitOccurrenceMath_() {
  // Month-end / leap-day clamping (research D3).
  assert_(addMonthsClamped_('2026-01-31', 1) === '2026-02-28', 'Jan 31 +1mo clamps to Feb 28');
  assert_(addMonthsClamped_('2028-01-31', 1) === '2028-02-29', 'Jan 31 +1mo clamps to Feb 29 in a leap year');
  assert_(addMonthsClamped_('2026-02-28', 12) === '2027-02-28', 'Feb 28 +12mo stays Feb 28');
  assert_(addMonthsClamped_('2028-02-29', 12) === '2029-02-28', 'Feb 29 +12mo clamps to Feb 28 in a common year');
  assert_(addDays_('2026-07-01', 14) === '2026-07-15', 'addDays_ 14-day step');

  // Occurrence windows per cadence — anchor before the window, expect the in-window dates.
  assert_(
    occurrencesInWindow_('2026-06-15', 'monthly', '2026-06-30', '2026-09-30').join(',') ===
    ['2026-07-15', '2026-08-15', '2026-09-15'].join(','),
    'monthly occurrences within window'
  );
  assert_(
    occurrencesInWindow_('2026-07-01', 'weekly', '2026-07-01', '2026-07-22').join(',') ===
    ['2026-07-08', '2026-07-15', '2026-07-22'].join(','),
    'weekly occurrences within window'
  );
  assert_(
    occurrencesInWindow_('2026-07-01', 'biweekly', '2026-07-01', '2026-08-01').join(',') ===
    ['2026-07-15', '2026-07-29'].join(','),
    'biweekly occurrences within window'
  );
  assert_(
    occurrencesInWindow_('2026-01-15', 'quarterly', '2026-06-30', '2026-12-31').join(',') ===
    ['2026-07-15', '2026-10-15'].join(','),
    'quarterly occurrences within window'
  );
  assert_(
    occurrencesInWindow_('2025-07-15', 'annually', '2026-06-30', '2026-12-31').join(',') ===
    ['2026-07-15'].join(','),
    'annually occurrences within window'
  );
  assert_(occurrencesInWindow_('2026-01-01', 'monthly', '2030-01-01', '2030-01-31').length === 0,
    'empty result outside all occurrences');

  // Season wrap-around (research D4).
  assert_(inSeason_(1, '11', '2') === true, 'Jan in Nov–Feb wrap window');
  assert_(inSeason_(6, '11', '2') === false, 'Jun outside Nov–Feb wrap window');
  assert_(inSeason_(6, '', '') === true, 'year-round when season blank');
  assert_(inSeason_(4, '4', '10') === true, 'boundary month included (season start)');
  assert_(inSeason_(10, '4', '10') === true, 'boundary month included (season end)');

  // Deterministic id (research D1).
  var id1 = recurringTaskId_('rule-a', '2026-07-15');
  var id2 = recurringTaskId_('rule-a', '2026-07-15');
  var id3 = recurringTaskId_('rule-a', '2026-08-15');
  assert_(id1 === id2, 'recurringTaskId_ deterministic for same rule+date');
  assert_(id1 !== id3, 'recurringTaskId_ differs across dates');
  assert_(id1.indexOf('r') === 0, 'recurringTaskId_ starts with "r"');

  Logger.log('unit occurrence math: pass');
}

// ---------------------------------------------------------------------------
// Live: recurring generation — idempotency, tombstone, season skip (US1, FR-003…016)
// ---------------------------------------------------------------------------

function liveRecurringGeneration_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 30);

  // A monthly rule anchored ~15 days ago, so one occurrence falls inside the 30-day window.
  var ruleId = SELFTEST_PREFIX + Utilities.getUuid();
  var anchor = addDays_(today, -15);
  createRecord_(TABS.RECURRING, {
    id: ruleId, title: SELFTEST_PREFIX + 'flea meds', cadence: 'monthly',
    anchorDate: anchor, defaultOwner: 'both', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  generateForRule_(readRuleById_(ruleId), today, windowEnd);
  var tasksForRule = function () {
    return listRecords_(TABS.TASKS).filter(function (t) { return t.recurringId === ruleId; });
  };
  var first = tasksForRule();
  assert_(first.length >= 1, 'generation produces at least one occurrence');
  first.forEach(function (t) {
    assert_(t.owner === 'both' && t.status === 'open' && t.id.indexOf('r') === 0,
      'generated task carries rule owner/status and a deterministic id');
  });
  assert_(readRuleById_(ruleId).lastGenerated !== '', 'lastGenerated advances after generation');

  // Re-run: idempotent, no duplicates (SC-002).
  generateForRule_(readRuleById_(ruleId), today, windowEnd);
  assert_(tasksForRule().length === first.length, 're-run creates no duplicate occurrences');

  // Delete one occurrence, re-run: not resurrected (FR-013).
  var deletedId = first[0].id;
  deleteRecordById_(TABS.TASKS, deletedId, 'selftest');
  generateForRule_(readRuleById_(ruleId), today, windowEnd);
  var afterDelete = tasksForRule();
  assert_(afterDelete.filter(function (t) { return t.id === deletedId; }).length === 0,
    'deleted occurrence is not resurrected on re-run');

  // Out-of-season rule: generates nothing for the current window. Pick a season 6 months
  // away from now so the 30-day generation window can never reach into it (a 1-month offset
  // is unsafe near a month boundary, since a 30-day window can cross into next month).
  var currentMonth = new Date().getMonth() + 1;
  var offMonth = ((currentMonth + 5) % 12) + 1;
  var seasonId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING, {
    id: seasonId, title: SELFTEST_PREFIX + 'off season', cadence: 'weekly',
    anchorDate: addDays_(today, -3), defaultOwner: 'max', lastGenerated: '',
    seasonStart: String(offMonth), seasonEnd: String(offMonth)
  }, 'selftest');
  generateForRule_(readRuleById_(seasonId), today, windowEnd);
  var seasonTasks = listRecords_(TABS.TASKS).filter(function (t) { return t.recurringId === seasonId; });
  assert_(seasonTasks.length === 0, 'out-of-season rule generates no occurrences');

  // Cleanup.
  tasksForRule().concat(afterDelete).forEach(function (t) { deleteRecordById_(TABS.TASKS, t.id, 'selftest'); });
  deleteRecordById_(TABS.RECURRING, ruleId, 'selftest');
  deleteRecordById_(TABS.RECURRING, seasonId, 'selftest');
  Logger.log('live recurring generation: pass');
}

function readRuleById_(id) {
  return listRecords_(TABS.RECURRING).filter(function (r) { return r.id === id; })[0];
}

// ---------------------------------------------------------------------------
// Live: recurring rule CRUD (US2, FR-001/009/010; research D8)
// ---------------------------------------------------------------------------

function liveRecurringCrud_() {
  var created = createRecurring_({
    title: SELFTEST_PREFIX + 'mow lawn', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max'
  }, 'selftest');
  assert_(created.lastGenerated === '', 'create leaves lastGenerated blank');

  var updated = updateRecurring_({
    id: created.id, title: SELFTEST_PREFIX + 'mow the lawn', seasonStart: '4', seasonEnd: '10'
  }, 'selftest');
  assert_(updated.title === SELFTEST_PREFIX + 'mow the lawn' &&
    updated.seasonStart === '4' && updated.seasonEnd === '10',
    'update persists title and season pair');

  assertFails_('BAD_REQUEST', function () {
    createRecurring_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      lastGenerated: '2026-06-01' }, 'selftest');
  }, 'lastGenerated on create rejected');
  assertFails_('BAD_REQUEST', function () {
    updateRecurring_({ id: created.id, lastGenerated: '2026-06-01' }, 'selftest');
  }, 'lastGenerated on update rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createRecurring_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      seasonStart: '4' }, 'selftest');
  }, 'half season window rejected on create');
  assertFails_('BAD_REQUEST', function () {
    createRecurring_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      bogus: 'y' }, 'selftest');
  }, 'unknown field rejected');
  assertFails_('NOT_FOUND', function () {
    updateRecurring_({ id: 'no-such-id', title: 'ghost' }, 'selftest');
  }, 'update unknown id rejected');

  deleteRecordById_(TABS.RECURRING, created.id, 'selftest');
  assert_(readRuleById_(created.id) === undefined, 'delete removes the rule');
  Logger.log('live recurring CRUD: pass');
}

// ---------------------------------------------------------------------------
// Live: catch-up bound — no backlog for a long-idle rule (US3, FR-016; SC-003)
// ---------------------------------------------------------------------------

function liveRecurringCatchUp_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 30);

  var ruleId = SELFTEST_PREFIX + Utilities.getUuid();
  var anchor = addMonthsClamped_(today, -24); // ~2 years in the past, never generated
  createRecord_(TABS.RECURRING, {
    id: ruleId, title: SELFTEST_PREFIX + 'catch up', cadence: 'monthly',
    anchorDate: anchor, defaultOwner: 'jaz', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  generateForRule_(readRuleById_(ruleId), today, windowEnd);
  var tasks = listRecords_(TABS.TASKS).filter(function (t) { return t.recurringId === ruleId; });
  assert_(tasks.length <= 2, 'first run on an old anchor is bounded to the lookahead window, not a backlog');
  tasks.forEach(function (t) {
    assert_(t.dueDate >= today && t.dueDate <= windowEnd, 'generated occurrence falls within the window');
  });
  assert_(readRuleById_(ruleId).lastGenerated !== '', 'lastGenerated set after catch-up run');

  tasks.forEach(function (t) { deleteRecordById_(TABS.TASKS, t.id, 'selftest'); });
  deleteRecordById_(TABS.RECURRING, ruleId, 'selftest');
  Logger.log('live recurring catch-up: pass');
}

// ---------------------------------------------------------------------------
// Live: event CRUD + the prepGeneratedFor guard (feature 005 US1, FR-001/002/003; D9)
// ---------------------------------------------------------------------------

function liveEventCrud_() {
  var created = createEvent_({
    title: SELFTEST_PREFIX + 'trip', start: '2026-07-25T17:00', end: '2026-07-27T12:00', owner: 'both'
  }, 'selftest');
  assert_(created.prepGeneratedFor === '', 'create leaves prepGeneratedFor blank when untagged');

  var updated = updateEvent_({ id: created.id, title: SELFTEST_PREFIX + 'trip (updated)', owner: 'max' }, 'selftest');
  assert_(updated.title === SELFTEST_PREFIX + 'trip (updated)' && updated.owner === 'max',
    'update persists title and owner');

  assertFails_('BAD_REQUEST', function () {
    createEvent_({ title: 'x', start: '2026-07-25T17:00', end: '2026-07-27T12:00', owner: 'both',
      prepGeneratedFor: 'x' }, 'selftest');
  }, 'prepGeneratedFor on create rejected');
  assertFails_('BAD_REQUEST', function () {
    updateEvent_({ id: created.id, prepGeneratedFor: 'x' }, 'selftest');
  }, 'prepGeneratedFor on update rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createEvent_({ title: 'x', start: '2026-07-27T12:00', end: '2026-07-25T17:00', owner: 'both' }, 'selftest');
  }, 'end before start rejected');

  deleteEvent_({ id: created.id }, 'selftest');
  assert_(listRecords_(TABS.EVENTS).filter(function (e) { return e.id === created.id; }).length === 0,
    'delete removes the event');
  Logger.log('live event CRUD: pass');
}

// ---------------------------------------------------------------------------
// Live: prep-checklist step (TaskTemplates) CRUD (US2, FR-005/006/007)
// ---------------------------------------------------------------------------

function liveTemplateCrud_() {
  var created = createTemplate_({
    eventType: SELFTEST_PREFIX + 'visit', taskTitle: 'Clean', offsetDays: '-2', defaultOwner: 'both'
  }, 'selftest');
  assert_(created.offsetDays === '-2', 'create persists a signed offset');

  var updated = updateTemplate_({ id: created.id, defaultOwner: 'max' }, 'selftest');
  assert_(updated.defaultOwner === 'max', 'update persists owner');

  assertFails_('BAD_REQUEST', function () {
    createTemplate_({ eventType: 'x', taskTitle: 'y', offsetDays: '-1', defaultOwner: 'both', bogus: '1' }, 'selftest');
  }, 'unknown field rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createTemplate_({ eventType: 'x', taskTitle: 'y', offsetDays: 'soon', defaultOwner: 'both' }, 'selftest');
  }, 'non-integer offsetDays rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createTemplate_({ eventType: 'x', taskTitle: 'y', offsetDays: '-1', defaultOwner: 'dog' }, 'selftest');
  }, 'bad defaultOwner rejected');
  assertFails_('NOT_FOUND', function () {
    updateTemplate_({ id: 'no-such-id', taskTitle: 'ghost' }, 'selftest');
  }, 'update unknown id rejected');

  deleteRecordById_(TABS.TEMPLATES, created.id, 'selftest');
  assert_(listRecords_(TABS.TEMPLATES).filter(function (t) { return t.id === created.id; }).length === 0,
    'delete removes the step');
  Logger.log('live template CRUD: pass');
}

// ---------------------------------------------------------------------------
// Unit: prep id + offset date math (feature 005 research D1/D5; no Sheet needed)
// ---------------------------------------------------------------------------

function unitPrepMath_() {
  var id1 = prepTaskId_('e1', 's1');
  var id2 = prepTaskId_('e1', 's1');
  var id3 = prepTaskId_('e1', 's2');
  assert_(id1 === id2, 'prepTaskId_ deterministic for same event+step');
  assert_(id1 !== id3, 'prepTaskId_ differs across steps');
  assert_(id1.indexOf('p') === 0, 'prepTaskId_ starts with "p"');
  assert_(isPrepTaskId_(id1), 'isPrepTaskId_ accepts a generated prep id');
  assert_(!isPrepTaskId_(Utilities.getUuid()), 'isPrepTaskId_ rejects a plain UUID');

  assert_(prepDueDate_('2026-07-25T17:00', '-2') === '2026-07-23', 'prepDueDate_ two days before');
  assert_(prepDueDate_('2026-07-25T17:00', '-1') === '2026-07-24', 'prepDueDate_ one day before');
  Logger.log('unit prep math: pass');
}

// ---------------------------------------------------------------------------
// Live: prep generation — idempotency, non-resurrection (US3, FR-008/009/010/011/014)
// ---------------------------------------------------------------------------

function livePrepGeneration_() {
  var eventType = SELFTEST_PREFIX + 'visit-gen';
  var step1 = createRecord_(TABS.TEMPLATES, {
    eventType: eventType, taskTitle: SELFTEST_PREFIX + 'Clean the house', offsetDays: '-2', defaultOwner: 'both'
  }, 'selftest');
  var step2 = createRecord_(TABS.TEMPLATES, {
    eventType: eventType, taskTitle: SELFTEST_PREFIX + 'Groceries', offsetDays: '-1', defaultOwner: 'jaz'
  }, 'selftest');

  var event = createEvent_({
    title: SELFTEST_PREFIX + 'guests', start: '2026-07-25T17:00', end: '2026-07-27T12:00',
    owner: 'both', templateId: eventType
  }, 'selftest');

  var prepFor = function () {
    return listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === event.id; });
  };
  var first = prepFor();
  assert_(first.length === 2, 'tagging an event generates one prep task per checklist step');
  assert_(event.prepGeneratedFor === eventType, 'createEvent_ response reflects the advanced marker');
  var clean = first.filter(function (t) { return t.dueDate === '2026-07-23'; })[0];
  var groceries = first.filter(function (t) { return t.dueDate === '2026-07-24'; })[0];
  assert_(clean && clean.owner === 'both' && isPrepTaskId_(clean.id), 'clean-house prep dated/owned/linked correctly');
  assert_(groceries && groceries.owner === 'jaz' && isPrepTaskId_(groceries.id), 'groceries prep dated/owned/linked correctly');

  // Re-run via the nightly path: idempotent, no duplicates (SC-003).
  generatePrepTasks();
  assert_(prepFor().length === 2, 're-running the generator creates no duplicate prep tasks');

  // Hand-delete one prep task; a later run must not resurrect it (steady state — FR-014).
  deleteRecordById_(TABS.TASKS, clean.id, 'selftest');
  generatePrepTasks();
  assert_(prepFor().length === 1, 'a hand-deleted prep task is not resurrected by the nightly run');

  // Cleanup.
  prepFor().forEach(function (t) { deleteRecordById_(TABS.TASKS, t.id, 'selftest'); });
  deleteRecordById_(TABS.EVENTS, event.id, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, step1.id, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, step2.id, 'selftest');
  Logger.log('live prep generation: pass');
}

// ---------------------------------------------------------------------------
// Live: prep lifecycle — move re-dates, retag swaps, delete purges (US4, FR-015/016/017)
// ---------------------------------------------------------------------------

function livePrepLifecycle_() {
  var visitType = SELFTEST_PREFIX + 'visit-life';
  var dinnerType = SELFTEST_PREFIX + 'dinner-life';
  var visitStep = createRecord_(TABS.TEMPLATES, {
    eventType: visitType, taskTitle: SELFTEST_PREFIX + 'Clean', offsetDays: '-2', defaultOwner: 'both'
  }, 'selftest');
  var dinnerStep = createRecord_(TABS.TEMPLATES, {
    eventType: dinnerType, taskTitle: SELFTEST_PREFIX + 'Plan menu', offsetDays: '-3', defaultOwner: 'both'
  }, 'selftest');

  var event = createEvent_({
    title: SELFTEST_PREFIX + 'lifecycle', start: '2026-07-25T17:00', end: '2026-07-27T12:00',
    owner: 'both', templateId: visitType
  }, 'selftest');
  var prepFor = function () {
    return listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === event.id; });
  };

  // (a) Move: complete the one prep task, then push the event's start back two days.
  var before = prepFor()[0];
  completeTask_({ id: before.id }, 'selftest');
  var moved = updateEvent_({ id: event.id, start: '2026-07-27T17:00', end: '2026-07-29T12:00' }, 'selftest');
  var afterMove = prepFor()[0];
  assert_(afterMove.dueDate === before.dueDate, 'a completed prep task is not re-dated on move (FR-015)');

  // (b) Retag: switch to a different checklist — old (completed) prep remains, new prep appears.
  var retagged = updateEvent_({ id: moved.id, templateId: dinnerType }, 'selftest');
  assert_(retagged.prepGeneratedFor === dinnerType, 'retag advances the marker to the new template');
  var afterRetag = prepFor();
  assert_(afterRetag.filter(function (t) { return t.id === before.id; }).length === 1,
    'completed prep from the old checklist remains after retag (FR-016)');
  assert_(afterRetag.filter(function (t) { return t.title === SELFTEST_PREFIX + 'Plan menu'; }).length === 1,
    'prep for the new checklist is generated after retag');

  // (c) Delete: purges ALL prep for the event, completed and outstanding alike (FR-017).
  // Seed one manual (non-prep-id) task linked to the event to prove it survives.
  var manual = createTask_({ title: SELFTEST_PREFIX + 'manual', owner: 'both', eventId: event.id }, 'selftest');
  deleteEvent_({ id: event.id }, 'selftest');
  var remaining = listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === event.id; });
  assert_(remaining.filter(function (t) { return isPrepTaskId_(t.id); }).length === 0,
    'deleting the event purges all of its prep tasks (done + outstanding)');
  assert_(remaining.filter(function (t) { return t.id === manual.id; }).length === 1,
    'a manually event-linked task is not deleted');

  // Cleanup.
  deleteRecordById_(TABS.TASKS, manual.id, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, visitStep.id, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, dinnerStep.id, 'selftest');
  Logger.log('live prep lifecycle: pass');
}

// ---------------------------------------------------------------------------
// Unit: calendar-sync pure builders (feature 007 research D4/D5/D6; no Sheet/Calendar needed)
// ---------------------------------------------------------------------------

function unitCalendarSync_() {
  assert_(buildEntryTitle_('jaz', 'Vet') === '[Jaz] Vet', 'buildEntryTitle_ prefixes owner label (jaz)');
  assert_(buildEntryTitle_('max', 'Trash') === '[Max] Trash', 'buildEntryTitle_ prefixes owner label (max)');
  assert_(buildEntryTitle_('both', 'Renew license') === '[Both] Renew license',
    'buildEntryTitle_ prefixes owner label (both)');

  assert_(ownerColor_('max') === CalendarApp.EventColor.CYAN, 'ownerColor_ max -> Peacock/CYAN');
  assert_(ownerColor_('jaz') === CalendarApp.EventColor.MAUVE, 'ownerColor_ jaz -> Grape/MAUVE');
  assert_(ownerColor_('both') === CalendarApp.EventColor.ORANGE, 'ownerColor_ both -> Tangerine/ORANGE');
  assert_(ownerColor_('max') !== ownerColor_('jaz') && ownerColor_('jaz') !== ownerColor_('both'),
    'the three owner colors are distinct');

  var today = todayYmd_();
  var future = addDays_(today, 5);
  var past = addDays_(today, -5);

  assert_(isEventDesired_({ end: future + 'T10:00' }) === true, 'future-ending event is desired');
  assert_(isEventDesired_({ end: today + 'T23:59' }) === true, 'today-ending event is desired (boundary)');
  assert_(isEventDesired_({ end: past + 'T10:00' }) === false, 'past-ending event is not desired');

  assert_(isTaskDesired_({ dueDate: future, status: 'open' }) === true, 'future open task is desired');
  assert_(isTaskDesired_({ dueDate: future, status: 'snoozed' }) === true, 'future snoozed task is desired');
  assert_(isTaskDesired_({ dueDate: future, status: 'done' }) === false, 'done task is not desired');
  assert_(isTaskDesired_({ dueDate: '', status: 'open' }) === false, 'undated task is not desired');
  assert_(isTaskDesired_({ dueDate: past, status: 'open' }) === false, 'past-due task is not desired');

  assert_(taskReminderMinutesFromMidnight_('09:00') === 540, '09:00 -> 540 minutes from midnight');
  assert_(taskReminderMinutesFromMidnight_('00:00') === 0, '00:00 -> 0 minutes from midnight');
  assert_(taskReminderMinutesFromMidnight_('bogus') === 540, 'invalid time falls back to the 09:00 default');
  Logger.log('unit calendar sync: pass');
}

/** Guard for the live calendar blocks below — skipped (not failed) when the household
 *  calendar isn't configured, mirroring the feature's own FR-014 no-op behavior. */
function calendarConfigured_() {
  return String(readSettingsMap_()['householdCalendarId'] || '').trim() !== '';
}

// ---------------------------------------------------------------------------
// Live: Event calendar mirror — create/update/re-sync/stale-pointer/delete (US1; FR-001/
// 003/004/009/015). Guarded + self-cleaning.
// ---------------------------------------------------------------------------

/**
 * CalendarApp caveat (applies to all three live blocks below): `CalendarApp` caches events
 * within a single execution, so an entry deleted earlier in THIS run can still resolve by id
 * (a stale handle) and operations on it throw "already been deleted." These blocks therefore
 * assert only what is reliable in one execution — creation, in-place update, and Sheet-side
 * pointer bookkeeping (which reads the Sheet, not the calendar cache). Entry *removal*,
 * stale-pointer recreation (FR-015), reconcile self-healing, and the orphan sweep can only be
 * observed across executions (a fresh cache), so they are validated in quickstart.md
 * (Scenarios E & F). Production is unaffected: the immediate-mirror and nightly paths never
 * delete-then-refetch the same event within one execution.
 */
function liveCalendarEventSync_() {
  if (!calendarConfigured_()) {
    Logger.log('live calendar event sync: SKIPPED (householdCalendarId not set)');
    return;
  }
  var calendar = getHouseholdCalendar_();
  var eventId = null;
  try {
    var day = addDays_(todayYmd_(), 2);
    var event = createEvent_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'cal event',
      start: day + 'T16:00', end: day + 'T16:30', owner: 'jaz'
    }, 'selftest');
    eventId = event.id;
    assert_(event.gcalEventId !== '', 'creating a future event mirrors a calendar entry (pointer stored)');
    var entry = calendar.getEventById(event.gcalEventId);
    assert_(entry && entry.getTitle() === '[Jaz] ' + SELFTEST_PREFIX + 'cal event',
      'mirrored entry title carries the owner prefix');
    assert_(entry.getColor() === ownerColor_('jaz'), 'mirrored entry uses the jaz color');

    var updated = updateEvent_({ id: event.id, start: day + 'T17:00', end: day + 'T17:30' }, 'selftest');
    assert_(updated.gcalEventId === event.gcalEventId, 'update reuses the same calendar pointer (no duplicate)');
    assert_(calendar.getEventById(updated.gcalEventId).getStartTime().getHours() === 17,
      'update moves the same entry to the new time (in place, no duplicate)');

    // Re-sync with no app-side change is a no-op: same pointer, still exactly one entry.
    syncCalendarForEvent_(rereadEvent_(event.id), 'selftest');
    assert_(rereadEvent_(event.id).gcalEventId === updated.gcalEventId,
      're-sync leaves the pointer unchanged (idempotent)');
  } finally {
    if (eventId) {
      try { deleteEvent_({ id: eventId }, 'selftest'); } catch (e) { /* best-effort cleanup */ }
    }
  }
  Logger.log('live calendar event sync: pass');
}

// ---------------------------------------------------------------------------
// Live: Task calendar mirror — dated/undated, move, complete, reopen, delete (US2;
// FR-005/006/009). Guarded + self-cleaning.
// ---------------------------------------------------------------------------

function liveCalendarTaskSync_() {
  if (!calendarConfigured_()) {
    Logger.log('live calendar task sync: SKIPPED (householdCalendarId not set)');
    return;
  }
  var calendar = getHouseholdCalendar_();
  var datedId = null, undatedId = null;
  try {
    var due = addDays_(todayYmd_(), 3);
    var dated = createTask_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'cal task',
      owner: 'both', dueDate: due
    }, 'selftest');
    datedId = dated.id;
    assert_(dated.gcalEventId !== '', 'a dated future task mirrors an all-day calendar entry');
    var entry = calendar.getEventById(dated.gcalEventId);
    assert_(entry && entry.isAllDayEvent(), 'the mirrored task entry is all-day');
    assert_(entry.getTitle() === '[Both] ' + SELFTEST_PREFIX + 'cal task',
      'mirrored task entry title carries the owner prefix');
    assert_(entry.getColor() === ownerColor_('both'), 'mirrored task entry uses the both color');

    var undated = createTask_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'cal task undated', owner: 'max'
    }, 'selftest');
    undatedId = undated.id;
    assert_(undated.gcalEventId === '', 'an undated task produces no calendar entry');

    var newDue = addDays_(todayYmd_(), 6);
    var moved = updateTask_({ id: dated.id, dueDate: newDue }, 'selftest');
    assert_(moved.gcalEventId === dated.gcalEventId, 'due-date change reuses the same calendar pointer');
    var movedEntry = calendar.getEventById(moved.gcalEventId);
    var movedDate = Utilities.formatDate(movedEntry.getAllDayStartDate(), getTimezone_(), 'yyyy-MM-dd');
    assert_(movedDate === newDue, 'the same entry moves to the new due date (no duplicate)');

    // Pointer bookkeeping is Sheet-side, so it's reliable in one execution; the entry's
    // actual disappearance/reappearance is validated cross-execution in quickstart.
    var completed = completeTask_({ id: dated.id }, 'selftest');
    assert_(completed.task.gcalEventId === '', 'completing the task clears the calendar pointer');

    var reopened = reopenTask_({ id: dated.id }, 'selftest');
    assert_(reopened.task.gcalEventId !== '', 'reopening the task re-stores a calendar pointer');
  } finally {
    if (undatedId) {
      try { deleteRecordById_(TABS.TASKS, undatedId, 'selftest'); } catch (e) { /* best-effort */ }
    }
    if (datedId) {
      try { deleteTask_({ id: datedId }, 'selftest'); } catch (e) { /* best-effort cleanup */ }
    }
  }
  Logger.log('live calendar task sync: pass');
}

// ---------------------------------------------------------------------------
// Live: nightly reconcile smoke test (US3; FR-010). Guarded + self-cleaning.
//
// Confirms the `syncCalendar()` trigger entry point runs end-to-end over the live data and
// leaves seeded records mirrored. The self-healing (re-create a hand-deleted entry, correct a
// hand-renamed one) and the orphan sweep cannot be exercised in a single execution —
// CalendarApp's per-execution cache masks same-run deletes/edits — so they are validated
// cross-execution in quickstart.md Scenarios E & F (hand-edit in Google Calendar, then run
// syncCalendar() as a separate execution with a fresh cache).
// ---------------------------------------------------------------------------

function liveCalendarReconcile_() {
  if (!calendarConfigured_()) {
    Logger.log('live calendar reconcile: SKIPPED (householdCalendarId not set)');
    return;
  }
  var eventId = null, taskId = null;
  try {
    var day = addDays_(todayYmd_(), 4);
    var event = createEvent_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'reconcile event',
      start: day + 'T09:00', end: day + 'T09:30', owner: 'max'
    }, 'selftest');
    eventId = event.id;

    var task = createTask_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'reconcile task',
      owner: 'jaz', dueDate: day
    }, 'selftest');
    taskId = task.id;

    // The nightly entry point must complete without throwing and keep the seeded records
    // mirrored (idempotent — they already have pointers, so this is a no-op for them).
    syncCalendar();

    assert_(rereadEvent_(eventId).gcalEventId !== '', 'reconcile keeps the seeded event mirrored');
    assert_(rereadTask_(taskId).gcalEventId !== '', 'reconcile keeps the seeded task mirrored');
  } finally {
    if (eventId) {
      try { deleteEvent_({ id: eventId }, 'selftest'); } catch (e) { /* best-effort cleanup */ }
    }
    if (taskId) {
      try { deleteTask_({ id: taskId }, 'selftest'); } catch (e) { /* best-effort cleanup */ }
    }
  }
  Logger.log('live calendar reconcile: pass');
}

// ---------------------------------------------------------------------------
// Unit: email digests — pure builders, gates, and dedupe (feature 008 research D1/D2/D7).
// Deliberately never calls sendDigests()/MailApp — only the pure gate predicates
// (isWeeklySendDay_/isMonthlySendDay_) and builders are exercised, so this suite never
// risks sending a real email even if run on an actual configured send day.
// ---------------------------------------------------------------------------

function unitDigests_() {
  var today = todayYmd_();

  // --- weekly window boundaries (FR-001, FR-013) ---------------------------------------
  var wwin = weeklyWindow_(today);
  assert_(wwin.start === today && wwin.end === addDays_(today, 6), 'weeklyWindow_ spans today..today+6');
  var weeklyEvents = [
    { owner: 'max', start: wwin.start + 'T09:00', title: 'in-window start' },
    { owner: 'max', start: wwin.end + 'T09:00', title: 'in-window end' },
    { owner: 'max', start: addDays_(wwin.start, -1) + 'T09:00', title: 'before window' },
    { owner: 'max', start: addDays_(wwin.end, 1) + 'T09:00', title: 'after window' }
  ];
  var weeklyItems = relevantItemsFor_('max', wwin.start, wwin.end, weeklyEvents, []);
  assert_(weeklyItems.length === 2, 'weekly window includes today and today+6, excludes today-1 and today+7');

  // --- monthly window boundaries (FR-002, FR-013) ---------------------------------------
  var mwin = monthlyWindow_(today);
  var monthlyEvents = [
    { owner: 'jaz', start: mwin.start + 'T00:00', title: 'first of next month' },
    { owner: 'jaz', start: mwin.end + 'T23:00', title: 'last of next month' },
    { owner: 'jaz', start: addDays_(mwin.start, -1) + 'T00:00', title: 'this month' },
    { owner: 'jaz', start: addDays_(mwin.end, 1) + 'T00:00', title: 'month after next' }
  ];
  var monthlyItems = relevantItemsFor_('jaz', mwin.start, mwin.end, monthlyEvents, []);
  assert_(monthlyItems.length === 2, 'monthly window includes first/last of next month, excludes this month and two-months-out');

  // resolveMonthlyDay_ "last" resolution — short (Feb, non-leap) and 30-day months.
  assert_(resolveMonthlyDay_({}, 2027, 2) === 28, 'resolveMonthlyDay_ "last" -> 28 for Feb 2027 (non-leap)');
  assert_(resolveMonthlyDay_({}, 2028, 2) === 29, 'resolveMonthlyDay_ "last" -> 29 for Feb 2028 (leap)');
  assert_(resolveMonthlyDay_({ digestMonthlyDay: '15' }, 2027, 4) === 15, 'resolveMonthlyDay_ honors an explicit in-range day');
  assert_(resolveMonthlyDay_({ digestMonthlyDay: '29' }, 2027, 4) === 30, 'resolveMonthlyDay_ rejects out-of-range (29) and falls back to that month\'s last day');

  // --- owner filtering (FR-003, FR-004) --------------------------------------------------
  var ownerEvents = [
    { owner: 'max', start: today + 'T09:00', title: 'max item' },
    { owner: 'both', start: today + 'T09:00', title: 'both item' },
    { owner: 'jaz', start: today + 'T09:00', title: 'jaz item' }
  ];
  var maxItems = relevantItemsFor_('max', today, today, ownerEvents, []);
  assert_(maxItems.length === 2, 'max digest includes own + both items only');
  assert_(!maxItems.some(function (i) { return i.title === 'jaz item'; }), 'max digest never includes jaz\'s solo item');
  var jazItems = relevantItemsFor_('jaz', today, today, ownerEvents, []);
  assert_(jazItems.length === 2 && !jazItems.some(function (i) { return i.title === 'max item'; }),
    'jaz digest includes own + both items only, never max\'s solo item');

  // --- task status / due-date exclusion (FR-014) -----------------------------------------
  var statusTasks = [
    { owner: 'max', dueDate: today, status: 'open', title: 'open task' },
    { owner: 'max', dueDate: today, status: 'snoozed', title: 'snoozed task' },
    { owner: 'max', dueDate: today, status: 'done', title: 'done task' },
    { owner: 'max', dueDate: '', status: 'open', title: 'undated task' }
  ];
  var taskItems = relevantItemsFor_('max', today, today, [], statusTasks);
  assert_(taskItems.length === 2, 'only open/snoozed dated tasks are included');
  assert_(!taskItems.some(function (i) { return i.title === 'done task' || i.title === 'undated task'; }),
    'completed and undated tasks never appear in a digest');

  // --- empty-state rendering (FR-009) -----------------------------------------------------
  var emptyDigest = buildDigest_('max', 'weekly', wwin, [], []);
  assert_(emptyDigest.count === 0, 'buildDigest_ with no items has count 0');
  assert_(emptyDigest.html.indexOf('Nothing on the calendar') !== -1, 'empty weekly digest HTML states nothing is scheduled');
  assert_(emptyDigest.text.indexOf('Nothing on the calendar') !== -1, 'empty weekly digest text states nothing is scheduled');

  // --- dedupe ledger (FR-011) --------------------------------------------------------------
  var dedupeKey = SELFTEST_PREFIX + 'digest-dedupe-' + Utilities.getUuid();
  assert_(alreadySent_('digest-weekly', dedupeKey) === false, 'alreadySent_ is false before any matching log row exists');
  appendLog_('system', 'digest-weekly', dedupeKey, 'selftest dedupe marker');
  assert_(alreadySent_('digest-weekly', dedupeKey) === true, 'alreadySent_ is true once a matching ActivityLog row exists');

  // --- missing-email skip (FR-010) ----------------------------------------------------------
  var fakePerson = 'selftestperson';
  var skipDigest = buildDigest_('max', 'weekly', wwin, [], []);
  var sent = sendOne_(fakePerson, skipDigest, {});
  assert_(sent === false, 'sendOne_ skips a recipient with no email in Settings, returning false');
  assert_(alreadySent_('digest-weekly', periodKey_('weekly', skipDigest.window, fakePerson)) === false,
    'no ActivityLog row is written for a skipped (missing-email) recipient');

  // --- pure send-gate predicates (FR-008, FR-015) — never invokes the real trigger handler --
  var todayDow = parseHouseholdDate_(today).getDay();
  var nextSunday = addDays_(today, (7 - todayDow) % 7);
  var nextMonday = addDays_(nextSunday, 1);
  assert_(isWeeklySendDay_({ digestWeeklyDay: 'Sunday' }, nextSunday) === true, 'isWeeklySendDay_ true on the configured weekday');
  assert_(isWeeklySendDay_({ digestWeeklyDay: 'Sunday' }, nextMonday) === false, 'isWeeklySendDay_ false on a non-matching weekday');
  assert_(isWeeklySendDay_({ digestWeeklyEnabled: 'FALSE', digestWeeklyDay: 'Sunday' }, nextSunday) === false,
    'isWeeklySendDay_ false when digestWeeklyEnabled is FALSE, even on the configured weekday');

  var lastFeb2027 = ymd_(2027, 2, 28);
  var midFeb2027 = ymd_(2027, 2, 15);
  assert_(isMonthlySendDay_({ digestMonthlyDay: 'last' }, lastFeb2027) === true, 'isMonthlySendDay_ true on the resolved last day');
  assert_(isMonthlySendDay_({ digestMonthlyDay: 'last' }, midFeb2027) === false, 'isMonthlySendDay_ false mid-month');
  assert_(isMonthlySendDay_({ digestMonthlyEnabled: 'FALSE', digestMonthlyDay: 'last' }, lastFeb2027) === false,
    'isMonthlySendDay_ false when digestMonthlyEnabled is FALSE, even on the resolved last day');

  // --- entry points exist and are public (CLAUDE.md trigger/editor entry-point rule) -------
  assert_(typeof sendDigests === 'function', 'sendDigests is a public entry point');
  assert_(typeof installDigestTrigger === 'function', 'installDigestTrigger is a public entry point');
  assert_(typeof sendWeeklyDigestNow === 'function', 'sendWeeklyDigestNow is a public entry point');
  assert_(typeof sendMonthlyDigestNow === 'function', 'sendMonthlyDigestNow is a public entry point');

  Logger.log('unit digests: pass');
}
