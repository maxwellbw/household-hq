/**
 * SelfTest.js — manually-run end-to-end checks (plan.md "keep it boring": Apps Script
 * has no test runner). Run `selfTest()` from the editor after any backend change; the
 * execution log ends with `ALL PASS` or throws at the first failed assertion.
 *
 * It writes to the live Sheet using a recognizable id prefix and cleans up after itself.
 * setupDatabase() must have been run first.
 */

var SELFTEST_PREFIX = 'selftest-';

/**
 * Chunk coverage map (feature 028 US7, research R8) — the monolithic `selfTest()` grew past
 * the Apps Script 6-minute execution limit (the live-Calendar suites make real Calendar API
 * calls and dominate wall time), so it is split into four public, editor-runnable chunks.
 * This is a flat regrouping of the exact same 42 suite calls in their original relative
 * order, split by dependency cluster — no suite's internal behavior changed. Union of the
 * four chunks == the old monolith's coverage; each suite appears in exactly one chunk:
 *
 *   selfTest1Core()            (14): unitValidators_, unitAuth_, unitSessionTokens_,
 *     liveCrudRoundTrip_, liveTaskSlices_, liveActivityFeed_, liveErrorCases_,
 *     liveHandEditResilience_, liveEventCrud_, liveTemplateCrud_, liveSnooze_,
 *     liveTaskNotes_, liveAcknowledge_, liveTasksRank_
 *   selfTest2Recurring()        (12): unitOccurrenceMath_, unitThanksgivingAndOrdinals_,
 *     liveRecurringGeneration_, liveRecurringCrud_, liveRecurringCatchUp_,
 *     unitRecurringEventMath_, liveRecurringEventGeneration_, liveRecurringEventPrep_,
 *     liveRecurringEventCrud_, unitPrepMath_, livePrepGeneration_, livePrepLifecycle_
 *   selfTest3SeedAndLists()      (8): liveSeedEventsAndTemplates_, unitSeedPack_,
 *     liveSeedPack_, unitAlternatingBins_, liveSeedTripTemplateOnEvent_, liveListsCrud_,
 *     liveListItemsCrud_, liveSeedLists_
 *   selfTest4CalendarAndComms()  (8): unitCalendarSync_, liveCalendarEventSync_,
 *     liveCalendarTaskSync_, liveCalendarReconcile_, unitDigests_, liveSettingsUpdate_,
 *     unitPush_, liveCalendarLocationSync_ (feature 010: unitPush_ replaces the retired
 *     unitNtfy_; the crypto proof itself lives in the separate selfTestPush() runner)
 *
 *   Total: 14 + 12 + 8 + 8 = 42 suites, matching the old monolith's call count exactly.
 *
 * `selfTestSeedPack()` and `selfTestSessionTokens()` (below) are unrelated targeted runners
 * from earlier features and are untouched.
 */
function selfTest() {
  Logger.log('selfTest() no longer runs the suite directly — the full run exceeds the Apps ' +
    'Script 6-minute execution limit. Run these four chunks from the editor, in order: ' +
    'selfTest1Core(), selfTest2Recurring(), selfTest3SeedAndLists(), selfTest4CalendarAndComms().');
  throw new Error('selfTest() is a fail-loud guard, not a runner. See the Logger output above ' +
    'for the four chunk functions to run instead — never trust a partial run as a pass.');
}

function selfTest1Core() {
  unitValidators_();
  unitAuth_();
  unitSessionTokens_();
  liveCrudRoundTrip_();
  liveTaskSlices_();
  liveActivityFeed_();
  liveErrorCases_();
  liveHandEditResilience_();
  liveEventCrud_();
  liveTemplateCrud_();
  liveSnooze_();
  liveTaskNotes_();
  liveAcknowledge_();
  liveTasksRank_();
  Logger.log('SELFTEST 1/4 (Core): ALL PASS');
}

function selfTest2Recurring() {
  unitOccurrenceMath_();
  unitThanksgivingAndOrdinals_();
  liveRecurringGeneration_();
  liveRecurringCrud_();
  liveRecurringCatchUp_();
  unitRecurringEventMath_();
  liveRecurringEventGeneration_();
  liveRecurringEventPrep_();
  liveRecurringEventCrud_();
  unitPrepMath_();
  livePrepGeneration_();
  livePrepLifecycle_();
  Logger.log('SELFTEST 2/4 (Recurring): ALL PASS');
}

function selfTest3SeedAndLists() {
  liveSeedEventsAndTemplates_();
  unitSeedPack_();
  liveSeedPack_();
  unitAlternatingBins_();
  liveSeedTripTemplateOnEvent_();
  liveListsCrud_();
  liveListItemsCrud_();
  liveSeedLists_();
  Logger.log('SELFTEST 3/4 (SeedAndLists): ALL PASS');
}

function selfTest4CalendarAndComms() {
  unitCalendarSync_();
  liveCalendarEventSync_();
  liveCalendarTaskSync_();
  liveCalendarReconcile_();
  unitDigests_();
  liveSettingsUpdate_();
  unitPush_();
  liveCalendarLocationSync_();
  Logger.log('SELFTEST 4/4 (CalendarAndComms): ALL PASS');
}

/**
 * Feature-015 targeted runner. The full `selfTest()` suite has grown past the 6-minute Apps
 * Script execution limit (the calendar blocks make real Calendar API calls), so this public
 * entry point runs *only* the seed-pack checks — a few seconds — for validating feature 015
 * in isolation. Public name (no trailing underscore) so it appears in the editor Run menu.
 * The `unit*`/`live*` helpers it calls are private and can't be run from the menu directly.
 */
function selfTestSeedPack() {
  unitSeedPack_();
  liveSeedPack_();
  unitAlternatingBins_();
  Logger.log('SEED PACK: ALL PASS');
}

/**
 * Feature-018-revision targeted runner (seconds, not minutes): auth resolution plus the
 * session-token mint/verify unit checks. Public name so it appears in the editor Run menu.
 */
function selfTestSessionTokens() {
  unitAuth_();
  unitSessionTokens_();
  Logger.log('SESSION TOKENS: ALL PASS');
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
// Unit: household session tokens (feature 018 rev. — mint/verify; touches only
// Script Properties, no Sheet). Public targeted runner: selfTestSessionTokens.
// ---------------------------------------------------------------------------

function unitSessionTokens_() {
  var secret = sessionSecret_(); // auto-creates the script property on first run
  var token = mintSessionToken_('Max@X.com', 'Max');

  assert_(isSessionToken_(token), 'minted token carries the hqs1 prefix');
  assert_(!isSessionToken_('eyJhbGciOi.fake.idtoken'), 'a Google ID token is not a session token');

  var claims = verifySessionToken_(token, secret);
  assert_(claims.email === 'max@x.com', 'round-trip lowercases and returns the email');
  assert_(claims.name === 'Max', 'round-trip preserves the display name');
  assert_(String(claims.email_verified) === 'true', 'session claims count as verified');

  // Tampered payload, wrong secret, and garbage are all INVALID_CREDENTIAL.
  var parts = token.split('.');
  var tamperedPayload = b64Url_(JSON.stringify({ e: 'stranger@x.com', n: '', x: Date.now() + 60000 }));
  assertFails_('INVALID_CREDENTIAL', function () {
    verifySessionToken_(parts[0] + '.' + tamperedPayload + '.' + parts[2], secret);
  }, 'tampered payload rejected');
  assertFails_('INVALID_CREDENTIAL', function () {
    verifySessionToken_(token, secret + '-rotated');
  }, 'rotated secret invalidates outstanding tokens');
  assertFails_('INVALID_CREDENTIAL', function () {
    verifySessionToken_('hqs1.garbage', secret);
  }, 'malformed token rejected');

  // A genuinely expired token is UNAUTHENTICATED (client falls back to the wall).
  var expiredPayload = b64Url_(JSON.stringify({ e: 'max@x.com', n: 'Max', x: Date.now() - 1000 }));
  var expiredToken = SESSION_TOKEN_PREFIX + '.' + expiredPayload + '.' +
    signSessionPayload_(expiredPayload, secret);
  assertFails_('UNAUTHENTICATED', function () {
    verifySessionToken_(expiredToken, secret);
  }, 'expired token rejected as UNAUTHENTICATED');

  // whoami now mints a sliding token for the resolved identity.
  var who = whoami_({ identity: 'max', actor: 'max', email: 'max@x.com', displayName: 'Max' });
  assert_(isSessionToken_(who.sessionToken), 'whoami includes a fresh session token');
  assert_(verifySessionToken_(who.sessionToken, secret).email === 'max@x.com',
    'whoami session token verifies for the same email');

  Logger.log('unit session tokens: pass');
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

  // Feature 027: semiannually steps exactly 6 months, clamped like the other month steps.
  assert_(CADENCE_STEP_('semiannually', '2026-01-31') === '2026-07-31', 'semiannually steps 6 months');
  assert_(CADENCE_STEP_('semiannually', '2026-08-31') === '2027-02-28', 'semiannually clamps into a shorter month');

  Logger.log('unit occurrence math: pass');
}

// ---------------------------------------------------------------------------
// Unit: Thanksgiving math + ordinal titles (feature 027, research R4/R5)
// ---------------------------------------------------------------------------

function unitThanksgivingAndOrdinals_() {
  // Verified against a real calendar (research R5): 2026/2027/2028 all land correctly,
  // including a case where the 4th Thursday itself crosses no month boundary quirks.
  assert_(fourthThursdayOfNovember_(2026) === '2026-11-26', '2026 Thanksgiving is Nov 26');
  assert_(thanksgivingSaturday_(2026) === '2026-11-21', '2026 lights weekend is Nov 21');
  assert_(fourthThursdayOfNovember_(2027) === '2027-11-25', '2027 Thanksgiving is Nov 25');
  assert_(thanksgivingSaturday_(2027) === '2027-11-20', '2027 lights weekend is Nov 20');
  assert_(fourthThursdayOfNovember_(2028) === '2028-11-23', '2028 Thanksgiving is Nov 23');
  assert_(thanksgivingSaturday_(2028) === '2028-11-18', '2028 lights weekend is Nov 18');

  // occurrencesInWindow_ special-cases 'thanksgiving-sat': exactly one per year, correct date,
  // never drifting off a fixed step (unlike a plain annually anchor).
  var multiYear = occurrencesInWindow_('2026-01-01', 'thanksgiving-sat', '2026-01-01', '2028-12-31');
  assert_(multiYear.join(',') === ['2026-11-21', '2027-11-20', '2028-11-18'].join(','),
    'thanksgiving-sat yields one correct occurrence per year across a multi-year window');
  assert_(occurrencesInWindow_('2026-01-01', 'thanksgiving-sat', '2026-01-01', '2026-06-30').length === 0,
    'thanksgiving-sat yields nothing in a window that ends before the computed date');

  // Ordinal rendering (research R4): standard English ordinal suffixes, including the
  // 11th/12th/13th teen exception.
  assert_(ordinal_(1) === '1st' && ordinal_(2) === '2nd' && ordinal_(3) === '3rd' && ordinal_(4) === '4th',
    'ordinal_ 1-4');
  assert_(ordinal_(11) === '11th' && ordinal_(12) === '12th' && ordinal_(13) === '13th',
    'ordinal_ teens are always "th"');
  assert_(ordinal_(21) === '21st' && ordinal_(22) === '22nd' && ordinal_(23) === '23rd',
    'ordinal_ 21-23 after the teens exception');

  // {nth} token substitution, baked per occurrence from anchor year -> occurrence year.
  assert_(renderOccurrenceTitle_('{nth} dating anniversary', '2020-01-24', '2026-01-24') === '6th dating anniversary',
    'renderOccurrenceTitle_ substitutes the year delta as an ordinal');
  assert_(renderOccurrenceTitle_("Rufus's {nth} gotcha day", '2022-07-10', '2027-07-10') === "Rufus's 5th gotcha day",
    'renderOccurrenceTitle_ works inside a possessive title');
  assert_(renderOccurrenceTitle_("Jazmine's birthday", '2020-01-02', '2027-01-02') === "Jazmine's birthday",
    'renderOccurrenceTitle_ returns a token-less title unchanged');
  assert_(renderOccurrenceTitle_('{nth} wedding anniversary', '2025-05-05', '2025-05-05') === '{nth} wedding anniversary',
    'renderOccurrenceTitle_ leaves the token in place rather than rendering a non-positive ordinal');

  Logger.log('unit Thanksgiving + ordinals: pass');
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
// Unit: recurring-event occurrence id + timing math (feature 025 research D2/D4)
// ---------------------------------------------------------------------------

function unitRecurringEventMath_() {
  var id1 = recurringEventOccurrenceId_('rule-a', '2026-07-15');
  var id2 = recurringEventOccurrenceId_('rule-a', '2026-07-15');
  var id3 = recurringEventOccurrenceId_('rule-a', '2026-08-15');
  assert_(id1 === id2, 'recurringEventOccurrenceId_ deterministic for same rule+date');
  assert_(id1 !== id3, 'recurringEventOccurrenceId_ differs across dates');
  assert_(id1.indexOf('v') === 0, 'recurringEventOccurrenceId_ starts with "v"');
  assert_(isRecurringEventId_(id1), 'isRecurringEventId_ accepts a generated occurrence id');
  assert_(!isRecurringEventId_(Utilities.getUuid()), 'isRecurringEventId_ rejects a plain UUID');
  assert_(!isRecurringEventId_(recurringTaskId_('x', '2026-07-15')), 'isRecurringEventId_ rejects a recurring-task id');

  var allDay = occurrenceStartEnd_('2026-07-15', '', '');
  assert_(allDay.start === '2026-07-15' && allDay.end === '2026-07-15',
    'blank startTime produces an all-day (date-only) occurrence');

  var timed = occurrenceStartEnd_('2026-07-15', '09:30', '60');
  assert_(timed.start === '2026-07-15T09:30' && timed.end === '2026-07-15T10:30',
    'startTime + durationMinutes produces a timed occurrence');

  var defaulted = occurrenceStartEnd_('2026-07-15', '09:30', '');
  assert_(defaulted.end === '2026-07-15T10:30', 'blank durationMinutes with a startTime defaults to 60 minutes');

  var spansMidnight = occurrenceStartEnd_('2026-07-15', '23:30', '90');
  assert_(spansMidnight.end === '2026-07-16T01:00', 'a duration spanning midnight rolls into the next day');

  Logger.log('unit recurring-event math: pass');
}

// ---------------------------------------------------------------------------
// Live: recurring-event generation — all-day/timed, idempotency, never-resurrect, season
// (feature 025 US1, FR-002/003/004/005/006/013/016/018)
// ---------------------------------------------------------------------------

function liveRecurringEventGeneration_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 60);

  // An all-day yearly rule anchored ~15 days ago, so one occurrence falls inside the window.
  var ruleId = SELFTEST_PREFIX + Utilities.getUuid();
  var anchor = addDays_(today, -15);
  createRecord_(TABS.RECURRING_EVENTS, {
    id: ruleId, title: SELFTEST_PREFIX + 'birthday', cadence: 'annually',
    anchorDate: anchor, startTime: '', durationMinutes: '', defaultOwner: 'both',
    templateId: '', location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  var occurrencesForRule = function () {
    return listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === ruleId; });
  };
  var first = occurrencesForRule();
  assert_(first.length >= 1, 'generation produces at least one occurrence');
  first.forEach(function (e) {
    assert_(e.owner === 'both' && isRecurringEventId_(e.id) && e.start === e.end,
      'generated occurrence carries rule owner, a deterministic id, and is all-day (date-only start===end)');
  });
  assert_(readEventRuleById_(ruleId).lastGenerated !== '', 'lastGenerated advances after generation');

  // Re-run: idempotent, no duplicates (SC-002).
  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  assert_(occurrencesForRule().length === first.length, 're-run creates no duplicate occurrences');

  // Delete one occurrence, re-run: not resurrected (FR-006).
  var deletedId = first[0].id;
  deleteEvent_({ id: deletedId }, 'selftest');
  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  var afterDelete = occurrencesForRule();
  assert_(afterDelete.filter(function (e) { return e.id === deletedId; }).length === 0,
    'deleted occurrence is not resurrected on re-run');

  // A timed rule: occurrence carries the derived start/end.
  var timedId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: timedId, title: SELFTEST_PREFIX + 'checkup', cadence: 'quarterly',
    anchorDate: addDays_(today, -5), startTime: '09:30', durationMinutes: '60',
    defaultOwner: 'max', templateId: '', location: '', notes: '', lastGenerated: '',
    seasonStart: '', seasonEnd: ''
  }, 'selftest');
  generateForEventRule_(readEventRuleById_(timedId), today, windowEnd);
  var timedOccurrences = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === timedId; });
  assert_(timedOccurrences.length >= 1, 'timed rule generates occurrences');
  timedOccurrences.forEach(function (e) {
    assert_(/T09:30$/.test(e.start) && /T10:30$/.test(e.end), 'timed occurrence carries the rule\'s time + duration');
  });

  // Out-of-season rule: generates nothing for the current window (mirrors 004's season test).
  var currentMonth = new Date().getMonth() + 1;
  var offMonth = ((currentMonth + 5) % 12) + 1;
  var seasonId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: seasonId, title: SELFTEST_PREFIX + 'off season event', cadence: 'weekly',
    anchorDate: addDays_(today, -3), startTime: '', durationMinutes: '', defaultOwner: 'jaz',
    templateId: '', location: '', notes: '', lastGenerated: '',
    seasonStart: String(offMonth), seasonEnd: String(offMonth)
  }, 'selftest');
  generateForEventRule_(readEventRuleById_(seasonId), today, windowEnd);
  var seasonOccurrences = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === seasonId; });
  assert_(seasonOccurrences.length === 0, 'out-of-season rule generates no occurrences');

  // Cleanup.
  occurrencesForRule().concat(afterDelete).forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  timedOccurrences.forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  deleteRecordById_(TABS.RECURRING_EVENTS, ruleId, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, timedId, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, seasonId, 'selftest');

  // Feature 028: per-cadence generator window (generateRecurringEvents() itself, not
  // generateForEventRule_ directly, so the annual-vs-short window selection is exercised).
  var yearlyAnchorId = SELFTEST_PREFIX + Utilities.getUuid();
  var yearlyAnchor = addDays_(today, 300); // ~10 months out: beyond the 60-day short window, inside the 366-day yearly window
  createRecord_(TABS.RECURRING_EVENTS, {
    id: yearlyAnchorId, title: SELFTEST_PREFIX + 'wide-window birthday', cadence: 'annually',
    anchorDate: yearlyAnchor, startTime: '', durationMinutes: '', defaultOwner: 'both',
    templateId: '', location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  var shortWeeklyId = SELFTEST_PREFIX + Utilities.getUuid();
  var weeklyAnchor = addDays_(today, 70); // beyond the 60-day short window
  createRecord_(TABS.RECURRING_EVENTS, {
    id: shortWeeklyId, title: SELFTEST_PREFIX + 'short-window weekly', cadence: 'weekly',
    anchorDate: weeklyAnchor, startTime: '', durationMinutes: '', defaultOwner: 'jaz',
    templateId: '', location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  generateRecurringEvents();

  var yearlyOccurrences = function () {
    return listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === yearlyAnchorId; });
  };
  var weeklyOccurrences = function () {
    return listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === shortWeeklyId; });
  };
  assert_(yearlyOccurrences().length === 1, 'annual rule ~10 months out generates inside the wide 366-day window');
  assert_(weeklyOccurrences().length === 0, 'weekly rule beyond 60 days generates nothing in the short window');

  // Re-run: idempotent at the wide window too — no new rows for the annual rule.
  var yearlyCountBefore = yearlyOccurrences().length;
  generateRecurringEvents();
  assert_(yearlyOccurrences().length === yearlyCountBefore, 're-run at the wide window creates no duplicate occurrences');

  yearlyOccurrences().forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  weeklyOccurrences().forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  deleteRecordById_(TABS.RECURRING_EVENTS, yearlyAnchorId, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, shortWeeklyId, 'selftest');

  Logger.log('live recurring-event generation: pass');
}

function readEventRuleById_(id) {
  return listRecords_(TABS.RECURRING_EVENTS).filter(function (r) { return r.id === id; })[0];
}

// ---------------------------------------------------------------------------
// Live: recurring-event prep — inline generation, idempotency, independence, no-template
// (feature 025 US2, FR-009/010/011/012)
// ---------------------------------------------------------------------------

function liveRecurringEventPrep_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 60);

  var eventType = SELFTEST_PREFIX + 'birthday-prep';
  var giftStep = createRecord_(TABS.TEMPLATES, {
    eventType: eventType, taskTitle: SELFTEST_PREFIX + 'Buy gift', offsetDays: '-14', defaultOwner: 'both'
  }, 'selftest');
  var dinnerStep = createRecord_(TABS.TEMPLATES, {
    eventType: eventType, taskTitle: SELFTEST_PREFIX + 'Plan dinner', offsetDays: '-3', defaultOwner: 'both'
  }, 'selftest');

  var ruleId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: ruleId, title: SELFTEST_PREFIX + 'birthday with prep', cadence: 'annually',
    anchorDate: addDays_(today, -10), startTime: '', durationMinutes: '', defaultOwner: 'both',
    templateId: eventType, location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');

  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  var occurrences = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === ruleId; });
  assert_(occurrences.length >= 1, 'rule with a template generates occurrences');
  var occ = occurrences[0];
  var prepFor = function (eventId) {
    return listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === eventId; });
  };
  var prep = prepFor(occ.id);
  assert_(prep.length === 2, 'each occurrence gets one prep task per checklist step');
  var gift = prep.filter(function (t) { return t.title === SELFTEST_PREFIX + 'Buy gift'; })[0];
  assert_(gift && gift.dueDate === addDays_(occ.start.substring(0, 10), -14),
    'prep is dated by its offset relative to the occurrence date');

  // Re-run: idempotent, no duplicate prep (FR-011).
  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  assert_(prepFor(occ.id).length === 2, 're-running the generator creates no duplicate prep');

  // A second occurrence's prep is independent — completing one occurrence's prep does not
  // affect the other's.
  if (occurrences.length > 1) {
    var occ2 = occurrences[1];
    completeTask_({ id: prep[0].id }, 'selftest');
    assert_(prepFor(occ2.id).filter(function (t) { return t.status === 'done'; }).length === 0,
      'completing one occurrence\'s prep does not affect another occurrence\'s prep');
  }

  // No template ⇒ plain occurrence, no prep, no error.
  var plainId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: plainId, title: SELFTEST_PREFIX + 'plain', cadence: 'annually',
    anchorDate: addDays_(today, -8), startTime: '', durationMinutes: '', defaultOwner: 'max',
    templateId: '', location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');
  generateForEventRule_(readEventRuleById_(plainId), today, windowEnd);
  var plainOccurrences = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === plainId; });
  assert_(plainOccurrences.length >= 1 && prepFor(plainOccurrences[0].id).length === 0,
    'rule with no template generates plain occurrences with no prep');

  // Deleted/unknown template ⇒ same — no prep, no error (FR-012).
  var ghostId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: ghostId, title: SELFTEST_PREFIX + 'ghost template', cadence: 'annually',
    anchorDate: addDays_(today, -6), startTime: '', durationMinutes: '', defaultOwner: 'max',
    templateId: SELFTEST_PREFIX + 'does-not-exist', location: '', notes: '', lastGenerated: '',
    seasonStart: '', seasonEnd: ''
  }, 'selftest');
  generateForEventRule_(readEventRuleById_(ghostId), today, windowEnd);
  var ghostOccurrences = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === ghostId; });
  assert_(ghostOccurrences.length >= 1 && prepFor(ghostOccurrences[0].id).length === 0,
    'rule with a deleted/unknown template generates plain occurrences with no prep or error');

  // Cleanup.
  occurrences.forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); }); // cascades its own prep
  plainOccurrences.forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  ghostOccurrences.forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  deleteRecordById_(TABS.RECURRING_EVENTS, ruleId, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, plainId, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, ghostId, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, giftStep.id, 'selftest');
  deleteRecordById_(TABS.TEMPLATES, dinnerStep.id, 'selftest');
  Logger.log('live recurring-event prep: pass');
}

// ---------------------------------------------------------------------------
// Live: recurring-event rule CRUD + edit/delete scope + cascade-delete confirmation
// (feature 025 US3, FR-001/007/008/014/017)
// ---------------------------------------------------------------------------

function liveRecurringEventCrud_() {
  var created = createRecurringEvent_({
    title: SELFTEST_PREFIX + 'anniversary', cadence: 'annually', anchorDate: '2026-06-01', defaultOwner: 'both'
  }, 'selftest');
  assert_(created.lastGenerated === '', 'create leaves lastGenerated blank');

  var updated = updateRecurringEvent_({
    id: created.id, title: SELFTEST_PREFIX + 'anniversary (updated)', startTime: '18:00',
    durationMinutes: '120', seasonStart: '4', seasonEnd: '10'
  }, 'selftest');
  assert_(updated.title === SELFTEST_PREFIX + 'anniversary (updated)' && updated.startTime === '18:00' &&
    updated.seasonStart === '4' && updated.seasonEnd === '10',
    'update persists title, timing, and season pair');

  assertFails_('BAD_REQUEST', function () {
    createRecurringEvent_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      lastGenerated: '2026-06-01' }, 'selftest');
  }, 'lastGenerated on create rejected');
  assertFails_('BAD_REQUEST', function () {
    updateRecurringEvent_({ id: created.id, lastGenerated: '2026-06-01' }, 'selftest');
  }, 'lastGenerated on update rejected');
  assertFails_('VALIDATION_FAILED', function () {
    createRecurringEvent_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      seasonStart: '4' }, 'selftest');
  }, 'half season window rejected on create');
  assertFails_('VALIDATION_FAILED', function () {
    createRecurringEvent_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      startTime: '25:00' }, 'selftest');
  }, 'invalid startTime rejected');
  assertFails_('BAD_REQUEST', function () {
    createRecurringEvent_({ title: 'x', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max',
      bogus: 'y' }, 'selftest');
  }, 'unknown field rejected');
  assertFails_('NOT_FOUND', function () {
    updateRecurringEvent_({ id: 'no-such-id', title: 'ghost' }, 'selftest');
  }, 'update unknown id rejected');

  // Edit/delete affect only future occurrences (FR-007/008): an existing occurrence keeps
  // its original values after the rule changes.
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 60);
  var ruleId = SELFTEST_PREFIX + Utilities.getUuid();
  createRecord_(TABS.RECURRING_EVENTS, {
    id: ruleId, title: SELFTEST_PREFIX + 'scope test', cadence: 'annually',
    anchorDate: addDays_(today, -10), startTime: '', durationMinutes: '', defaultOwner: 'max',
    templateId: '', location: '', notes: '', lastGenerated: '', seasonStart: '', seasonEnd: ''
  }, 'selftest');
  generateForEventRule_(readEventRuleById_(ruleId), today, windowEnd);
  var beforeEdit = listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === ruleId; });
  assert_(beforeEdit.length >= 1, 'scope-test rule generates an occurrence');
  updateRecurringEvent_({ id: ruleId, title: SELFTEST_PREFIX + 'scope test (renamed)' }, 'selftest');
  var afterEdit = listRecords_(TABS.EVENTS).filter(function (e) { return e.id === beforeEdit[0].id; })[0];
  assert_(afterEdit.title === beforeEdit[0].title, 'editing the rule does not rewrite an already-generated occurrence');
  deleteEntity_(TABS.RECURRING_EVENTS, { id: ruleId }, 'selftest');
  var afterRuleDelete = listRecords_(TABS.EVENTS).filter(function (e) { return e.id === beforeEdit[0].id; });
  assert_(afterRuleDelete.length === 1, 'deleting the rule leaves an already-generated occurrence in place');

  // Deleting an occurrence event cascades its prep (FR-017) — confirms the existing 005
  // `deleteEvent_` cascade already covers recurring-event occurrences (research D7).
  var withPrep = createRecurringEvent_({
    title: SELFTEST_PREFIX + 'cascade check', cadence: 'annually', anchorDate: addDays_(today, -5),
    defaultOwner: 'jaz'
  }, 'selftest');
  var occ = createEvent_({
    title: SELFTEST_PREFIX + 'cascade occurrence', start: today, end: today, owner: 'jaz'
  }, 'selftest');
  var manualPrep = createRecord_(TABS.TASKS, {
    id: 'p' + Utilities.getUuid().replace(/-/g, '').substring(0, 32), title: SELFTEST_PREFIX + 'fake prep',
    owner: 'jaz', status: 'open', eventId: occ.id
  }, 'selftest');
  deleteEvent_({ id: occ.id }, 'selftest');
  var remainingPrep = listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === occ.id; });
  assert_(remainingPrep.length === 0, 'deleting an occurrence event cascades its prep tasks');

  // Cleanup.
  afterRuleDelete.forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); });
  deleteRecordById_(TABS.RECURRING_EVENTS, created.id, 'selftest');
  deleteRecordById_(TABS.RECURRING_EVENTS, withPrep.id, 'selftest');
  Logger.log('live recurring-event CRUD: pass');
}

// ---------------------------------------------------------------------------
// Unit: recurring seed pack — pack shape, anchor math, ledger parsing (feature 015)
// ---------------------------------------------------------------------------

function unitSeedPack_() {
  // The starter pack itself: 12 chores (8 household + 4 dog-care, feature 023) plus 13
  // more (feature 027: 6 semiannual cleans + 4 yard + 3 holiday/vet) = 25, valid
  // cadences/owners, mow-lawn's season window.
  assert_(SEED_PACK.length === 25, 'SEED_PACK has 25 chores (12 from 015/023 + 13 from 027)');
  var keys = SEED_PACK.map(function (c) { return c.seedKey; });
  assert_(keys.length === Object.keys(keys.reduce(function (s, k) { s[k] = true; return s; }, {})).length,
    'every seedKey in SEED_PACK is unique');
  SEED_PACK.forEach(function (c) {
    assert_(CADENCES.indexOf(c.cadence) >= 0, 'chore "' + c.seedKey + '" has a valid cadence');
    assert_(OWNERS.indexOf(c.defaultOwner) >= 0, 'chore "' + c.seedKey + '" has a valid defaultOwner');
  });
  var mow = SEED_PACK.filter(function (c) { return c.seedKey === 'mow-lawn'; })[0];
  assert_(mow && String(mow.seasonStart) === '4' && String(mow.seasonEnd) === '10',
    'mow-lawn is seeded April-October (FR-006)');
  var gutters = SEED_PACK.filter(function (c) { return c.seedKey === 'gutters'; })[0];
  assert_(gutters && gutters.cadence === 'annually', 'gutters is a single annual rule, not biannual');

  // Dog-care chores (feature 023): flea/tick + heartworm monthly, nail trim every 6 weeks,
  // grooming every 8 weeks, all owned by both, all year-round (no season window).
  var nailTrim = SEED_PACK.filter(function (c) { return c.seedKey === 'nail-trim'; })[0];
  var grooming = SEED_PACK.filter(function (c) { return c.seedKey === 'grooming'; })[0];
  var fleaTick = SEED_PACK.filter(function (c) { return c.seedKey === 'flea-tick'; })[0];
  var heartworm = SEED_PACK.filter(function (c) { return c.seedKey === 'heartworm'; })[0];
  assert_(nailTrim && nailTrim.cadence === 'sixweekly' && nailTrim.defaultOwner === 'both',
    'nail trim is every-6-weeks, owned by both');
  assert_(grooming && grooming.cadence === 'eightweekly' && grooming.defaultOwner === 'both',
    'grooming is every-8-weeks, owned by both');
  assert_(fleaTick && fleaTick.cadence === 'monthly' && heartworm && heartworm.cadence === 'monthly',
    'flea/tick and heartworm meds are monthly');
  assert_(nailTrim.seasonStart == null && grooming.seasonStart == null,
    'dog-care chores run year-round (no season window)');

  // New cadence step math (feature 023): sixweekly/eightweekly advance by exact day counts.
  assert_(CADENCE_STEP_('sixweekly', '2026-07-10') === '2026-08-21',
    'sixweekly steps exactly 42 days');
  assert_(CADENCE_STEP_('eightweekly', '2026-07-10') === '2026-09-04',
    'eightweekly steps exactly 56 days');

  // Feature 027 — six-month cleans: owners (dishwasher=max, washing machine=jaz, rest
  // both) and, critically, their anchors resolve to six *distinct* calendar months so the
  // real household never gets all six due at once (docs/seed-data.md §4).
  var sixMonthKeys = ['water-filter', 'clean-dishwasher', 'deep-clean', 'clean-fridge',
    'clean-oven', 'clean-washing-machine'];
  var sixMonthChores = sixMonthKeys.map(function (k) {
    return SEED_PACK.filter(function (c) { return c.seedKey === k; })[0];
  });
  sixMonthChores.forEach(function (c) {
    assert_(c && c.cadence === 'semiannually', 'chore "' + c.seedKey + '" is semiannually');
  });
  var dishwasher = sixMonthChores[1], washer = sixMonthChores[5];
  assert_(dishwasher.defaultOwner === 'max', 'clean-dishwasher is owned by Max');
  assert_(washer.defaultOwner === 'jaz', 'clean-washing-machine is owned by Jaz');
  var anchorMonths = sixMonthChores.map(function (c) {
    return monthOf_(computeSeedAnchor_(c.anchorRule, '2026-07-10'));
  });
  var uniqueMonths = anchorMonths.reduce(function (s, m) { s[m] = true; return s; }, {});
  assert_(Object.keys(uniqueMonths).length === 6,
    'the six semiannual cleans resolve to six distinct calendar months');

  // Feature 027 — yard/holiday/vet: cadence + season/owner specifics.
  var leafCleanup = SEED_PACK.filter(function (c) { return c.seedKey === 'leaf-cleanup'; })[0];
  assert_(leafCleanup && leafCleanup.cadence === 'biweekly' &&
    String(leafCleanup.seasonStart) === '10' && String(leafCleanup.seasonEnd) === '12',
    'leaf-cleanup is biweekly, seasoned Oct-Dec');
  assert_(!inSeason_(7, leafCleanup.seasonStart, leafCleanup.seasonEnd),
    'leaf-cleanup is out of season in July');
  assert_(inSeason_(11, leafCleanup.seasonStart, leafCleanup.seasonEnd),
    'leaf-cleanup is in season in November');
  var lights = SEED_PACK.filter(function (c) { return c.seedKey === 'christmas-lights'; })[0];
  assert_(lights && lights.cadence === 'thanksgiving-sat',
    'christmas-lights uses the computed thanksgiving-sat cadence, not a fixed annual date');
  var vet = SEED_PACK.filter(function (c) { return c.seedKey === 'vet-annual'; })[0];
  assert_(vet && vet.cadence === 'annually' && vet.anchorRule === 'monthday-10-01' &&
    vet.defaultOwner === 'max', 'vet-annual is an October 1 annual rule owned by Max');

  // Anchor math.
  assert_(computeSeedAnchor_('today', '2026-07-10') === '2026-07-10', 'today anchor is today');
  assert_(computeSeedAnchor_('today+7', '2026-07-10') === '2026-07-17', 'today+7 anchor is 7 days out');
  assert_(nextMonthDayOnOrAfter_('2026-07-10', 10, 15) === '2026-10-15',
    'fall anchor resolves to this year when the date is still ahead');
  assert_(nextMonthDayOnOrAfter_('2026-11-10', 11, 1) === '2027-11-01',
    'fall anchor rolls to next year once the date has passed');

  // Feature 027 — new anchorRule forms: today+Nmo and monthday-MM-DD.
  assert_(computeSeedAnchor_('today+2mo', '2026-07-10') === '2026-09-10', 'today+2mo anchor is 2 months out');
  assert_(computeSeedAnchor_('today+7mo', '2026-07-10') === '2027-02-10', 'today+7mo anchor crosses the year boundary');
  assert_(computeSeedAnchor_('monthday-10-01', '2026-07-10') === '2026-10-01',
    'monthday anchor resolves to this year when the date is still ahead');
  assert_(computeSeedAnchor_('monthday-04-01', '2026-07-10') === '2027-04-01',
    'monthday anchor rolls to next year once the date has passed');

  // Ledger parse/serialize round-trip.
  var parsed = parseAppliedKeys_('trash; recycling;  yardwaste ');
  assert_(parsed.trash && parsed.recycling && parsed.yardwaste, 'ledger parses all keys, trims whitespace');
  assert_(Object.keys(parsed).length === 3, 'blank/duplicate entries do not inflate the ledger');
  assert_(serializeAppliedKeys_({ b: true, a: true }) === 'a; b', 'ledger serializes sorted for stable diffs');
  Logger.log('unit seed pack: pass');
}

// ---------------------------------------------------------------------------
// Live: recurring seed pack — idempotence, edit-preservation, never-resurrect (US1/US2)
// ---------------------------------------------------------------------------

/**
 * Exercises the real `seedRecurringPack()` against a small isolated test pack (not the
 * production `SEED_PACK`) so running selfTest() never permanently seeds real household
 * chores. The shared `recurringSeedApplied` ledger is still the real one — restored at the
 * end so the live seed pack's own idempotency is untouched by this test run.
 */
function liveSeedPack_() {
  var testPack = [
    { seedKey: SELFTEST_PREFIX + 'chore-a', title: SELFTEST_PREFIX + 'chore a', cadence: 'weekly', anchorRule: 'today', defaultOwner: 'both' },
    { seedKey: SELFTEST_PREFIX + 'chore-b', title: SELFTEST_PREFIX + 'chore b', cadence: 'monthly', anchorRule: 'today', defaultOwner: 'max' }
  ];
  var ledgerBefore = readSettingsMap_()['recurringSeedApplied'];
  var rulesForKey = function (key) {
    return listRecords_(TABS.RECURRING).filter(function (r) { return r.seedKey === key; });
  };

  seedRecurringPack(testPack);
  assert_(rulesForKey(testPack[0].seedKey).length === 1, 'first run seeds chore a');
  assert_(rulesForKey(testPack[1].seedKey).length === 1, 'first run seeds chore b');
  var ledgerAfterFirst = parseAppliedKeys_(readSettingsMap_()['recurringSeedApplied']);
  assert_(ledgerAfterFirst[testPack[0].seedKey] && ledgerAfterFirst[testPack[1].seedKey],
    'ledger records both newly-seeded keys');

  // Re-run: idempotent, no duplicates (SC-002).
  seedRecurringPack(testPack);
  assert_(rulesForKey(testPack[0].seedKey).length === 1 && rulesForKey(testPack[1].seedKey).length === 1,
    're-run creates no duplicate rows');

  // Edit preservation, rename included since identity is the seed key, not title (SC-003).
  var ruleA = rulesForKey(testPack[0].seedKey)[0];
  var editedAnchor = addDays_(ruleA.anchorDate, 3);
  updateRecordById_(TABS.RECURRING, ruleA.id,
    { title: SELFTEST_PREFIX + 'renamed', defaultOwner: 'jaz', anchorDate: editedAnchor }, 'selftest');
  seedRecurringPack(testPack);
  var ruleAAfter = rulesForKey(testPack[0].seedKey)[0];
  assert_(ruleAAfter.title === SELFTEST_PREFIX + 'renamed' && ruleAAfter.defaultOwner === 'jaz' &&
    ruleAAfter.anchorDate === editedAnchor,
    're-run preserves a hand-edited (renamed, reassigned, re-anchored) seeded rule');
  assert_(rulesForKey(testPack[0].seedKey).length === 1, 'edit-preservation re-run creates no duplicate');

  // Never-resurrect (FR-004b): delete chore b's row, re-run, confirm it is not recreated.
  var ruleB = rulesForKey(testPack[1].seedKey)[0];
  deleteRecordById_(TABS.RECURRING, ruleB.id, 'selftest');
  seedRecurringPack(testPack);
  assert_(rulesForKey(testPack[1].seedKey).length === 0, 'deleted seeded chore is not resurrected on re-run');

  // No-op run: nothing left to add, so the ledger is untouched (FR-009 — no spurious writes).
  var ledgerBeforeNoop = readSettingsMap_()['recurringSeedApplied'];
  seedRecurringPack(testPack);
  assert_(readSettingsMap_()['recurringSeedApplied'] === ledgerBeforeNoop,
    'a run with nothing to add leaves the ledger untouched');

  // Cleanup: remove the surviving seeded row and restore the ledger exactly.
  rulesForKey(testPack[0].seedKey).forEach(function (r) { deleteRecordById_(TABS.RECURRING, r.id, 'selftest'); });
  setSettingValue_('recurringSeedApplied', ledgerBefore || '');
  Logger.log('live seed pack: pass');
}

// ---------------------------------------------------------------------------
// Live: household list seed pack — idempotence, edit-preservation, never-resurrect,
// cross-tab list->item resolution (feature 027, docs/seed-data.md §1)
// ---------------------------------------------------------------------------

/**
 * Exercises the real `seedLists()` against a small isolated test pack (not the production
 * `LIST_SEED_PACK`), mirroring `liveSeedPack_()`'s approach so running selfTest() never
 * permanently seeds the real household lists. The shared `listSeedApplied` ledger is still
 * the real one — restored at the end.
 */
function liveSeedLists_() {
  var testPack = {
    lists: [{ seedKey: SELFTEST_PREFIX + 'list-a', name: SELFTEST_PREFIX + 'list a' }],
    items: [
      { seedKey: SELFTEST_PREFIX + 'item-a', listSeedKey: SELFTEST_PREFIX + 'list-a',
        name: SELFTEST_PREFIX + 'item a', section: 'pantry', staple: 'TRUE', status: 'need' },
      { seedKey: SELFTEST_PREFIX + 'item-b', listSeedKey: SELFTEST_PREFIX + 'list-a',
        name: SELFTEST_PREFIX + 'item b', section: 'produce', staple: 'FALSE', status: 'stocked' }
    ]
  };
  var ledgerBefore = readSettingsMap_()['listSeedApplied'];
  var listForKey = function (key) {
    return listRecords_(TABS.LISTS).filter(function (l) { return l.seedKey === key; });
  };
  var itemForKey = function (key) {
    return listRecords_(TABS.LIST_ITEMS).filter(function (i) { return i.seedKey === key; });
  };

  seedLists(testPack);
  var listRow = listForKey(testPack.lists[0].seedKey)[0];
  assert_(listRow && listRow.name === testPack.lists[0].name, 'first run seeds the list');
  var itemA = itemForKey(testPack.items[0].seedKey)[0];
  var itemB = itemForKey(testPack.items[1].seedKey)[0];
  assert_(itemA && itemA.listId === listRow.id && itemA.status === 'need' &&
    itemA.section === 'pantry' && itemA.staple === 'TRUE',
    'first run seeds item a, resolved to the newly-created list, with its explicit fields');
  assert_(itemB && itemB.status === 'stocked',
    'first run seeds item b with its explicit stocked status (bypassing createListItem_\'s force-to-need)');

  // Re-run: idempotent, no duplicates (mirrors liveSeedPack_'s SC-002 check).
  seedLists(testPack);
  assert_(listForKey(testPack.lists[0].seedKey).length === 1 &&
    itemForKey(testPack.items[0].seedKey).length === 1 &&
    itemForKey(testPack.items[1].seedKey).length === 1,
    're-run creates no duplicate list or item rows');

  // Edit preservation — a hand-renamed item is left untouched by a re-run (identity is
  // seedKey, never name).
  updateRecordById_(TABS.LIST_ITEMS, itemA.id, { name: SELFTEST_PREFIX + 'renamed item a' }, 'selftest');
  seedLists(testPack);
  assert_(itemForKey(testPack.items[0].seedKey)[0].name === SELFTEST_PREFIX + 'renamed item a',
    're-run preserves a hand-renamed seeded item');

  // Never-resurrect: delete item b, re-run, confirm it stays gone.
  deleteRecordById_(TABS.LIST_ITEMS, itemB.id, 'selftest');
  seedLists(testPack);
  assert_(itemForKey(testPack.items[1].seedKey).length === 0,
    'deleted seeded item is not resurrected on re-run');

  // Cleanup: cascading list delete removes the surviving item too; restore the ledger.
  deleteList_({ id: listRow.id }, 'selftest');
  setSettingValue_('listSeedApplied', ledgerBefore || '');
  Logger.log('live seed lists: pass');
}

// ---------------------------------------------------------------------------
// Live: household event + template seed packs — birthday prep (owner/offset), ordinal
// anniversary titles, idempotence, never-resurrect (feature 027, docs/seed-data.md §2-§3)
// ---------------------------------------------------------------------------

/**
 * Exercises the real `seedEvents()`/`seedTemplates()` against small isolated test packs
 * (not the production packs), mirroring `liveSeedPack_()`. Anchors are deliberately chosen
 * so a real occurrence lands inside the generator's lookahead window: the birthday anchor
 * is a few days in the future (exactly how `monthday-MM-DD` resolves in production — the
 * *next* future occurrence), and the anniversary anchor is the same month/day five years
 * earlier, so both step to the identical occurrence date this year.
 */
function liveSeedEventsAndTemplates_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var windowEnd = addDays_(today, 60);
  var futureAnchor = addDays_(today, 10);
  var historicalAnchor = addMonthsClamped_(futureAnchor, -60); // same month/day, 5 years earlier

  var templatePack = [
    { seedKey: SELFTEST_PREFIX + 'tmpl-bday-x', eventType: SELFTEST_PREFIX + 'bday-x',
      taskTitle: SELFTEST_PREFIX + 'Buy X a gift', offsetDays: -14, defaultOwner: 'max' }
  ];
  var eventPack = [
    { seedKey: SELFTEST_PREFIX + 'bday-x', title: SELFTEST_PREFIX + "X's birthday",
      cadence: 'annually', anchorDate: futureAnchor, defaultOwner: 'both',
      templateId: SELFTEST_PREFIX + 'bday-x' },
    { seedKey: SELFTEST_PREFIX + 'anniv-x', title: SELFTEST_PREFIX + '{nth} test anniversary',
      cadence: 'annually', anchorDate: historicalAnchor, defaultOwner: 'both' }
  ];
  var templateLedgerBefore = readSettingsMap_()['templateSeedApplied'];
  var eventLedgerBefore = readSettingsMap_()['eventSeedApplied'];
  var ruleForKey = function (key) {
    return listRecords_(TABS.RECURRING_EVENTS).filter(function (r) { return r.seedKey === key; })[0];
  };
  var occForRule = function (ruleId) {
    return listRecords_(TABS.EVENTS).filter(function (e) { return e.recurringEventId === ruleId; });
  };

  seedTemplates(templatePack);
  seedEvents(eventPack);
  var bdayRule = ruleForKey(eventPack[0].seedKey);
  var annivRule = ruleForKey(eventPack[1].seedKey);
  assert_(bdayRule && bdayRule.templateId === templatePack[0].eventType,
    'seeded birthday rule carries its own per-person templateId');

  generateForEventRule_(bdayRule, today, windowEnd);
  generateForEventRule_(annivRule, today, windowEnd);

  var bdayOcc = occForRule(bdayRule.id);
  assert_(bdayOcc.length === 1, 'seeded birthday rule generates its occurrence');
  var prep = listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === bdayOcc[0].id; });
  assert_(prep.length === 1 && prep[0].title === templatePack[0].taskTitle &&
    prep[0].owner === 'max' && prep[0].dueDate === addDays_(bdayOcc[0].start.substring(0, 10), -14),
    'seeded birthday occurrence generates its per-person prep task with the right owner and lead time');

  var annivOcc = occForRule(annivRule.id);
  assert_(annivOcc.length === 1, 'seeded anniversary rule generates its occurrence');
  assert_(annivOcc[0].title === '5th test anniversary',
    'seeded anniversary occurrence bakes the {nth} token as the correct ordinal (5 years)');

  // Idempotency: re-run creates no duplicate template row or event rule.
  seedTemplates(templatePack);
  seedEvents(eventPack);
  assert_(listRecords_(TABS.TEMPLATES).filter(function (t) { return t.seedKey === templatePack[0].seedKey; }).length === 1,
    're-run creates no duplicate template row');
  assert_(listRecords_(TABS.RECURRING_EVENTS).filter(function (r) { return r.seedKey === eventPack[0].seedKey; }).length === 1,
    're-run creates no duplicate event rule');

  // Never-resurrect: delete the anniversary rule, re-run, confirm it stays gone.
  deleteRecordById_(TABS.RECURRING_EVENTS, annivRule.id, 'selftest');
  seedEvents(eventPack);
  assert_(listRecords_(TABS.RECURRING_EVENTS).filter(function (r) { return r.seedKey === eventPack[1].seedKey; }).length === 0,
    'deleted seeded event rule is not resurrected on re-run');

  // Cleanup.
  bdayOcc.concat(annivOcc).forEach(function (e) { deleteEvent_({ id: e.id }, 'selftest'); }); // cascades prep
  deleteRecordById_(TABS.RECURRING_EVENTS, bdayRule.id, 'selftest');
  var tmplRow = listRecords_(TABS.TEMPLATES).filter(function (t) { return t.seedKey === templatePack[0].seedKey; })[0];
  if (tmplRow) deleteRecordById_(TABS.TEMPLATES, tmplRow.id, 'selftest');
  setSettingValue_('templateSeedApplied', templateLedgerBefore || '');
  setSettingValue_('eventSeedApplied', eventLedgerBefore || '');
  Logger.log('live seed events + templates: pass');
}

// ---------------------------------------------------------------------------
// Live: "leaving-trip" prep checklist end-to-end — seeded template rows attached to a
// real one-off event, via the existing events.create -> syncPrepForEvent_ path
// (feature 027, docs/seed-data.md §8)
// ---------------------------------------------------------------------------

/**
 * Confirms the actual "leaving-trip" checklist content transcribed into
 * `TEMPLATE_SEED_PACK` (Config.js) generates correctly once a household member attaches it
 * to a real one-off event — exercising `seedTemplates()` + the existing `events.create`
 * (`createEvent_` -> `syncPrepForEvent_`) path together. Uses an isolated
 * SELFTEST_PREFIX-tagged copy of the pack's five rows (not the production `eventType`), so
 * running selfTest() never touches real household templates or events.
 */
function liveSeedTripTemplateOnEvent_() {
  var tz = getTimezone_();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var eventType = SELFTEST_PREFIX + 'leaving-trip';
  var templateLedgerBefore = readSettingsMap_()['templateSeedApplied'];
  var pack = [
    { seedKey: SELFTEST_PREFIX + 'tmpl-trip-pumpkin', eventType: eventType, taskTitle: 'Get enough pumpkin & pup veggies', offsetDays: -1, defaultOwner: 'max' },
    { seedKey: SELFTEST_PREFIX + 'tmpl-trip-plants', eventType: eventType, taskTitle: 'Water plants', offsetDays: -1, defaultOwner: 'jaz' },
    { seedKey: SELFTEST_PREFIX + 'tmpl-trip-trash', eventType: eventType, taskTitle: 'Take trash out', offsetDays: -1, defaultOwner: 'max' },
    { seedKey: SELFTEST_PREFIX + 'tmpl-trip-pup-instructions', eventType: eventType, taskTitle: 'Set out pup instructions', offsetDays: 0, defaultOwner: 'max' },
    { seedKey: SELFTEST_PREFIX + 'tmpl-trip-key', eventType: eventType, taskTitle: 'Key under mat for dog sitter', offsetDays: 0, defaultOwner: 'both' }
  ];
  seedTemplates(pack);

  var tripStart = addDays_(today, 20);
  var event = createEvent_({
    title: SELFTEST_PREFIX + 'trip', start: tripStart, end: addDays_(tripStart, 5),
    owner: 'both', templateId: eventType
  }, 'selftest');

  var prep = listRecords_(TABS.TASKS).filter(function (t) { return t.eventId === event.id; });
  assert_(prep.length === 5, 'attaching leaving-trip generates all five checklist tasks');
  var byTitle = {};
  prep.forEach(function (t) { byTitle[t.title] = t; });
  assert_(byTitle['Get enough pumpkin & pup veggies'].owner === 'max' &&
    byTitle['Get enough pumpkin & pup veggies'].dueDate === addDays_(tripStart, -1),
    'pumpkin/pup-veggies task: Max, one day before');
  assert_(byTitle['Water plants'].owner === 'jaz' && byTitle['Water plants'].dueDate === addDays_(tripStart, -1),
    'water plants task: Jaz, one day before');
  assert_(byTitle['Take trash out'].owner === 'max' && byTitle['Take trash out'].dueDate === addDays_(tripStart, -1),
    'trash task: Max, one day before');
  assert_(byTitle['Set out pup instructions'].owner === 'max' && byTitle['Set out pup instructions'].dueDate === tripStart,
    'pup instructions task: Max, day of');
  assert_(byTitle['Key under mat for dog sitter'].owner === 'both' && byTitle['Key under mat for dog sitter'].dueDate === tripStart,
    'key-under-mat task: both, day of');

  // Cleanup: deleting the event cascades its prep; remove the seeded template rows too
  // (their seedKeys would otherwise keep them "applied" via the row-scan even after the
  // ledger is restored below); restore the ledger.
  deleteEvent_({ id: event.id }, 'selftest');
  listRecords_(TABS.TEMPLATES).filter(function (t) { return t.eventType === eventType; })
    .forEach(function (t) { deleteRecordById_(TABS.TEMPLATES, t.id, 'selftest'); });
  setSettingValue_('templateSeedApplied', templateLedgerBefore || '');
  Logger.log('live seed trip template on event: pass');
}

// ---------------------------------------------------------------------------
// Unit: alternating bins — trash weekly, recycling/yard waste biweekly offset 7 days (US3)
// ---------------------------------------------------------------------------

function unitAlternatingBins_() {
  var trash = SEED_PACK.filter(function (c) { return c.seedKey === 'trash'; })[0];
  var recycling = SEED_PACK.filter(function (c) { return c.seedKey === 'recycling'; })[0];
  var yardwaste = SEED_PACK.filter(function (c) { return c.seedKey === 'yardwaste'; })[0];
  var today = '2026-07-10';
  var windowEnd = addDays_(today, 55); // an 8-week span (days 0-55); day 56 would start a 9th week

  var trashAnchor = computeSeedAnchor_(trash.anchorRule, today);
  var recyclingAnchor = computeSeedAnchor_(recycling.anchorRule, today);
  var yardwasteAnchor = computeSeedAnchor_(yardwaste.anchorRule, today);
  assert_(yardwasteAnchor === addDays_(recyclingAnchor, 7),
    'yard waste is anchored exactly 7 days after recycling');

  var trashOcc = occurrencesInWindow_(trashAnchor, 'weekly', addDays_(today, -1), windowEnd);
  var recyclingOcc = occurrencesInWindow_(recyclingAnchor, 'biweekly', addDays_(today, -1), windowEnd);
  var yardwasteOcc = occurrencesInWindow_(yardwasteAnchor, 'biweekly', addDays_(today, -1), windowEnd);

  assert_(trashOcc.length === 8, 'trash comes due every one of the 8 weeks (SC-004)');
  assert_(recyclingOcc.length === 4 && yardwasteOcc.length === 4,
    'recycling and yard waste each come due in exactly 4 of the 8 weeks (SC-004)');
  var overlap = recyclingOcc.filter(function (d) { return yardwasteOcc.indexOf(d) >= 0; });
  assert_(overlap.length === 0, 'recycling and yard waste never fall due in the same week');
  Logger.log('unit alternating bins: pass');
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
// Live: event location → calendar mapping (feature 019 US4). Guarded + self-cleaning.
// ---------------------------------------------------------------------------

function liveCalendarLocationSync_() {
  if (!calendarConfigured_()) {
    Logger.log('live calendar location sync: SKIPPED (householdCalendarId not set)');
    return;
  }
  var calendar = getHouseholdCalendar_();
  var eventId = null;
  try {
    var day = addDays_(todayYmd_(), 2);
    var event = createEvent_({
      id: SELFTEST_PREFIX + Utilities.getUuid(), title: SELFTEST_PREFIX + 'location probe',
      start: day + 'T09:00', end: day + 'T09:30', owner: 'max', location: '123 Main St'
    }, 'selftest');
    eventId = event.id;
    var entry = calendar.getEventById(event.gcalEventId);
    assert_(entry.getLocation() === '123 Main St', 'creating an event with a location mirrors it to the calendar entry');

    var moved = updateEvent_({ id: event.id, location: '456 Oak Ave' }, 'selftest');
    assert_(calendar.getEventById(moved.gcalEventId).getLocation() === '456 Oak Ave',
      'updating the location re-syncs the same calendar entry (no duplicate)');

    var cleared = updateEvent_({ id: event.id, location: '' }, 'selftest');
    assert_(calendar.getEventById(cleared.gcalEventId).getLocation() === '',
      'clearing the location empties it on the mirrored calendar entry');
  } finally {
    if (eventId) {
      try { deleteEvent_({ id: eventId }, 'selftest'); } catch (e) { /* best-effort cleanup */ }
    }
  }
  Logger.log('live calendar location sync: pass');
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

// ---------------------------------------------------------------------------
// Live: settings.update (feature 020 — curated Settings editor)
// ---------------------------------------------------------------------------

/** Exercises updateSettings_ against the live Settings tab: whitelist enforcement,
 *  per-field validation (no partial writes), digest-trigger reinstall on hour change, and
 *  exactly-one ActivityLog row per successful save. Snapshots and restores every touched key
 *  so the household's real settings are unaffected by the run. */
function liveSettingsUpdate_() {
  var before = readSettingsMap_();
  var logCountBefore = countLogRows_('settings', 'settings-update');

  // 1. Valid digest-field save writes only the changed keys and logs exactly one row.
  var newWeeklyDay = before.digestWeeklyDay === 'Wednesday' ? 'Thursday' : 'Wednesday';
  var r1 = updateSettings_({ digestWeeklyDay: newWeeklyDay, digestMonthlyDay: 'last' }, 'selftest');
  assert_(r1.settings.digestWeeklyDay === newWeeklyDay, 'digestWeeklyDay persisted');
  assert_(readSettingsMap_().gcalEventReminderMin === before.gcalEventReminderMin,
    'an untouched whitelisted key is left alone by a partial save');
  assert_(countLogRows_('settings', 'settings-update') === logCountBefore + 1,
    'a successful save appends exactly one settings-update ActivityLog row');

  // 2. Re-saving identical values is a no-op: empty changed[], no new log row (idempotent).
  var r2 = updateSettings_({ digestWeeklyDay: newWeeklyDay }, 'selftest');
  assert_(r2.changed.length === 0, 're-saving identical values reports no changes');
  assert_(countLogRows_('settings', 'settings-update') === logCountBefore + 1,
    'a no-op save appends no ActivityLog row');

  // 3. Invalid digestHour is rejected before any write (no partial writes).
  assertFails_('BAD_REQUEST', function () {
    updateSettings_({ digestHour: '25', digestWeeklyDay: 'Friday' }, 'selftest');
  }, 'digestHour=25 → BAD_REQUEST');
  assert_(readSettingsMap_().digestWeeklyDay === newWeeklyDay,
    'a rejected save writes nothing, even for the other valid fields in the same payload');

  // 4. Invalid gcalEventReminderMin is rejected, no write.
  assertFails_('BAD_REQUEST', function () {
    updateSettings_({ gcalEventReminderMin: '-5' }, 'selftest');
  }, 'gcalEventReminderMin=-5 → BAD_REQUEST');

  // 5. Invalid timezone is rejected, no write.
  assertFails_('BAD_REQUEST', function () {
    updateSettings_({ timezone: 'Mars/Olympus_Mons' }, 'selftest');
  }, 'an off-list timezone → BAD_REQUEST');

  // 6. A non-whitelisted key is rejected outright — Sheet-only settings stay untouched
  //    (FR-013/SC-004), even when mixed with an otherwise-valid field.
  var maxEmailBefore = before.maxEmail;
  assertFails_('BAD_REQUEST', function () {
    updateSettings_({ maxEmail: 'nope@example.com', digestHour: String(before.digestHour || 7) }, 'selftest');
  }, 'a non-editable key (maxEmail) → BAD_REQUEST');
  assert_(readSettingsMap_().maxEmail === maxEmailBefore, 'maxEmail is untouched by a rejected save');

  // 7. Changing digestHour reinstalls the daily digest trigger at the new hour.
  var newHour = String((Number(before.digestHour || 7) + 1) % 24);
  var r7 = updateSettings_({ digestHour: newHour }, 'selftest');
  assert_(r7.digestTriggerReinstalled === true, 'changing digestHour reinstalls the digest trigger');
  var sendDigestsTriggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'sendDigests';
  });
  assert_(sendDigestsTriggers.length === 1, 'exactly one sendDigests trigger exists after reinstall');

  // 8. A save that doesn't touch digestHour does not report a reinstall.
  var r8 = updateSettings_({ pushEnabled: before.pushEnabled === 'FALSE' ? 'TRUE' : 'FALSE' }, 'selftest');
  assert_(r8.digestTriggerReinstalled === false, 'a save without digestHour does not reinstall the trigger');

  // Restore every key this test touched, back to the pre-test snapshot.
  updateSettings_({
    digestWeeklyDay: before.digestWeeklyDay || 'Sunday',
    digestMonthlyDay: before.digestMonthlyDay || 'last',
    digestHour: String(before.digestHour || 7),
    pushEnabled: before.pushEnabled === 'FALSE' ? 'FALSE' : 'TRUE'
  }, 'selftest');

  Logger.log('live settings.update: pass');
}

// ---------------------------------------------------------------------------
// Live: snooze / unsnooze (feature 012 US3, contract §SelfTest — T016)
// ---------------------------------------------------------------------------

function liveSnooze_() {
  var id = SELFTEST_PREFIX + Utilities.getUuid();
  createTask_({ id: id, title: SELFTEST_PREFIX + 'snooze probe', owner: 'jaz', dueDate: '2026-07-10' }, 'selftest');

  // 1. Snooze open task → changed:true, status='snoozed', dueDate updated, one history entry, one log row.
  var r1 = snoozeTask_({ id: id, dueDate: '2026-07-14' }, 'selftest');
  assert_(r1.changed === true, 'snooze returns changed:true');
  assert_(r1.task.status === 'snoozed', 'snooze sets status=snoozed');
  assert_(r1.task.dueDate === '2026-07-14', 'snooze sets new dueDate');
  assert_(r1.task.snoozeHistory.indexOf('2026-07-10→2026-07-14') === 0,
    'snooze appends one history entry (oldDue→newDue)');
  assert_(countLogRows_(id, 'snooze') === 1, 'snooze appends exactly one ActivityLog snooze row');

  // 2. Snooze again to a new date → second history entry, dueDate moved, second log row.
  var r2 = snoozeTask_({ id: id, dueDate: '2026-07-20' }, 'selftest');
  assert_(r2.changed === true, 'second snooze returns changed:true');
  assert_(r2.task.dueDate === '2026-07-20', 'second snooze moves dueDate');
  assert_(r2.task.snoozeHistory.indexOf('2026-07-14→2026-07-20') > 0,
    'second snooze appends a second history entry');
  assert_(r2.task.snoozeHistory.split(' | ').length === 2, 'snoozeHistory now has exactly two entries');
  assert_(countLogRows_(id, 'snooze') === 2, 'second snooze appends a second ActivityLog row');

  // 3. Snooze to the same date again → changed:false, no new history/log row (idempotent).
  var r3 = snoozeTask_({ id: id, dueDate: '2026-07-20' }, 'selftest');
  assert_(r3.changed === false, 'snooze to same date is a no-change (idempotent)');
  assert_(r3.task.snoozeHistory.split(' | ').length === 2, 'idempotent snooze adds no history entry');
  assert_(countLogRows_(id, 'snooze') === 2, 'idempotent snooze adds no ActivityLog row');

  // 4. Unsnooze → status='open', history preserved, one unsnooze log row; unsnooze again → no-change.
  var r4 = unsnoozeTask_({ id: id }, 'selftest');
  assert_(r4.changed === true, 'unsnooze returns changed:true');
  assert_(r4.task.status === 'open', 'unsnooze sets status=open');
  assert_(r4.task.snoozeHistory.split(' | ').length === 2, 'unsnooze preserves snoozeHistory');
  assert_(countLogRows_(id, 'unsnooze') === 1, 'unsnooze appends exactly one ActivityLog unsnooze row');
  var r4b = unsnoozeTask_({ id: id }, 'selftest');
  assert_(r4b.changed === false, 'unsnooze of an already-open task is a no-change');
  assert_(countLogRows_(id, 'unsnooze') === 1, 're-unsnooze adds no ActivityLog row');

  // 5. Shared-account snooze without actingPerson → ACTING_PERSON_REQUIRED.
  //    With actingPerson → actor is the named person in the log (guards R4 isWriteAction_ change).
  var sharedLists = {
    maxEmail: SELFTEST_PREFIX + 'ignored@x.com',
    jazEmail: SELFTEST_PREFIX + 'ignored2@x.com',
    shared: [SELFTEST_PREFIX + 'shared@x.com']
  };
  var sharedId = matchIdentity_({ email: SELFTEST_PREFIX + 'shared@x.com', name: 'Shared' }, sharedLists);
  assertFails_('ACTING_PERSON_REQUIRED', function () {
    resolveWriteActor_(sharedId, 'tasks.snooze', {});
  }, 'shared-account snooze without actingPerson → ACTING_PERSON_REQUIRED');
  assert_(resolveWriteActor_(sharedId, 'tasks.snooze', { actingPerson: 'max' }) === 'max',
    'shared-account snooze with actingPerson max → actor=max');

  // 6. Bad request: missing id / invalid dueDate rejected.
  assertFails_('BAD_REQUEST', function () {
    snoozeTask_({ dueDate: '2026-07-14' }, 'selftest');
  }, 'snooze without id → BAD_REQUEST');
  assertFails_('BAD_REQUEST', function () {
    snoozeTask_({ id: id }, 'selftest');
  }, 'snooze without dueDate → BAD_REQUEST');
  assertFails_('VALIDATION_FAILED', function () {
    snoozeTask_({ id: id, dueDate: 'not-a-date' }, 'selftest');
  }, 'snooze with invalid dueDate → VALIDATION_FAILED');
  assertFails_('BAD_REQUEST', function () {
    unsnoozeTask_({}, 'selftest');
  }, 'unsnooze without id → BAD_REQUEST');

  deleteRecordById_(TABS.TASKS, id, 'selftest');
  Logger.log('live snooze: pass');
}

// ---------------------------------------------------------------------------
// Live: task notes (feature 019 US1) — round-trip through create + update, hand-editable.
// ---------------------------------------------------------------------------

function liveTaskNotes_() {
  var id = SELFTEST_PREFIX + Utilities.getUuid();
  var created = createTask_({
    id: id, title: SELFTEST_PREFIX + 'notes probe', owner: 'max',
    notes: 'Buy: https://example.com/filter'
  }, 'selftest');
  assert_(created.notes === 'Buy: https://example.com/filter', 'tasks.create stores notes');

  var updated = updateTask_({ id: id, notes: 'Buy: https://example.com/filter — 20x25x1' }, 'selftest');
  assert_(updated.notes === 'Buy: https://example.com/filter — 20x25x1', 'tasks.update edits notes');
  assert_(countLogRows_(id, 'update') === 1, 'notes edit appends exactly one ActivityLog update row');

  // A task created with no notes stores/returns a blank string, not undefined (hand-editable Sheet).
  var noNotesId = SELFTEST_PREFIX + Utilities.getUuid();
  var noNotes = createTask_({ id: noNotesId, title: SELFTEST_PREFIX + 'no notes probe', owner: 'jaz' }, 'selftest');
  assert_(noNotes.notes === '', 'a task created without notes stores a blank notes cell');

  deleteRecordById_(TABS.TASKS, id, 'selftest');
  deleteRecordById_(TABS.TASKS, noNotesId, 'selftest');
  Logger.log('live task notes: pass');
}

// ---------------------------------------------------------------------------
// Live: acknowledge/commit (feature 019 US2) — transition, idempotency, reassign reset,
// authorization, and the create/update guard against client-supplied ackBy/ackAt.
// ---------------------------------------------------------------------------

function liveAcknowledge_() {
  var id = SELFTEST_PREFIX + Utilities.getUuid();
  var task = createTask_({ id: id, title: SELFTEST_PREFIX + 'ack probe', owner: 'max' }, 'selftest');
  assert_(task.ackBy === '', 'a newly created task starts unacknowledged');

  // 1. The assignee (max) acknowledges → changed:true, ackBy/ackAt set, one log row.
  var r1 = acknowledgeTask_({ id: id }, 'max');
  assert_(r1.changed === true, 'acknowledge by the owner returns changed:true');
  assert_(r1.task.ackBy === 'max', 'acknowledge stamps ackBy with the actor');
  assert_(r1.task.ackAt !== '', 'acknowledge stamps ackAt');
  assert_(countLogRows_(id, 'acknowledge') === 1, 'acknowledge appends exactly one ActivityLog row');

  // 2. Idempotent replay by the same actor → changed:false, no new log row.
  var r2 = acknowledgeTask_({ id: id }, 'max');
  assert_(r2.changed === false, 're-acknowledging is a no-change (idempotent)');
  assert_(countLogRows_(id, 'acknowledge') === 1, 'idempotent replay adds no ActivityLog row');

  // 3. Only the assignee may acknowledge — the assigner (jaz) is rejected.
  assertFails_('VALIDATION_FAILED', function () {
    acknowledgeTask_({ id: id }, 'jaz');
  }, 'acknowledge by a non-owner → VALIDATION_FAILED');

  // 4. Reassigning to a different owner resets acknowledgement (FR-011).
  var reassigned = updateTask_({ id: id, owner: 'jaz' }, 'selftest');
  assert_(reassigned.ackBy === '' && reassigned.ackAt === '', 'reassigning owner clears ackBy/ackAt');

  // 5. The new assignee (jaz) can now acknowledge fresh.
  var r5 = acknowledgeTask_({ id: id }, 'jaz');
  assert_(r5.changed === true, 'the new assignee can acknowledge after reassignment');
  assert_(r5.task.ackBy === 'jaz', 'acknowledge after reassignment stamps the new owner');

  // 6. `both`-owned and self-view tasks can never be acknowledged.
  var bothId = SELFTEST_PREFIX + Utilities.getUuid();
  createTask_({ id: bothId, title: SELFTEST_PREFIX + 'ack both probe', owner: 'both' }, 'selftest');
  assertFails_('VALIDATION_FAILED', function () {
    acknowledgeTask_({ id: bothId }, 'max');
  }, 'acknowledge on a "both"-owned task → VALIDATION_FAILED');

  // 7. ackBy/ackAt are server-managed — rejected on both create and update.
  assertFails_('BAD_REQUEST', function () {
    createTask_({ id: SELFTEST_PREFIX + Utilities.getUuid(), title: 'x', owner: 'max', ackBy: 'max' }, 'selftest');
  }, 'creating a task with client-supplied ackBy → BAD_REQUEST');
  assertFails_('BAD_REQUEST', function () {
    updateTask_({ id: id, ackBy: 'jaz' }, 'selftest');
  }, 'updating ackBy directly → BAD_REQUEST');
  assertFails_('BAD_REQUEST', function () {
    updateTask_({ id: id, ackAt: nowIso_() }, 'selftest');
  }, 'updating ackAt directly → BAD_REQUEST');

  deleteRecordById_(TABS.TASKS, id, 'selftest');
  deleteRecordById_(TABS.TASKS, bothId, 'selftest');
  Logger.log('live acknowledge: pass');
}

/** Test-only: hand-edit a single Settings row's value by key (Settings has no write API). */
function setSettingValue_(key, value) {
  var sheet = getSheet_(TABS.SETTINGS);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === key) {
      sheet.getRange(r + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, 'selftest']);
}

/**
 * feature 010 — web push: subscription store + message builders + best-effort gating.
 * No real network sends here (that needs an actual browser subscription); see
 * selfTestPush() for the crypto proof (RFC 8291 vector + VAPID roundtrip).
 */
function unitPush_() {
  // --- recipient routing (mirrors the retired feature 009 otherPerson_) ---------------------
  assert_(otherPerson_('max') === 'jaz', 'otherPerson_ of max is jaz');
  assert_(otherPerson_('jaz') === 'max', 'otherPerson_ of jaz is max');

  // --- device label heuristic -----------------------------------------------------------------
  assert_(deriveDeviceLabelFromUa_('Mozilla/5.0 (iPhone; CPU iPhone OS) ... Safari/604.1') === 'iPhone Safari',
    'deriveDeviceLabelFromUa_ recognizes iPhone Safari');
  assert_(deriveDeviceLabelFromUa_('Mozilla/5.0 (Macintosh) ... Chrome/120 Safari/537.36') === 'Mac Chrome',
    'deriveDeviceLabelFromUa_ recognizes Mac Chrome');

  // --- message formatting (FR-015 — byte-identical to the retired ntfy messages) -------------
  assert_(buildCompletionMessage_('max', 'Take out recycling') === 'Max completed: Take out recycling',
    'buildCompletionMessage_ names the completer and the task title');
  assert_(buildCompletionMessage_('jaz', '') === 'Jaz completed a task',
    'buildCompletionMessage_ falls back to a sensible message for a blank title');
  var longTitle = new Array(200).join('x');
  var longMessage = buildCompletionMessage_('max', longTitle);
  assert_(longMessage.length < longTitle.length, 'buildCompletionMessage_ clamps an unusually long title');
  assert_(buildAcknowledgeMessage_('max', 'Pick up the dog') === 'Max has it: Pick up the dog',
    'buildAcknowledgeMessage_ names the assignee and the task title');
  assert_(buildAcknowledgeMessage_('jaz', '') === 'Jaz has it',
    'buildAcknowledgeMessage_ falls back to a sensible message for a blank title');

  // --- subscription upsert/dedupe (endpoint-keyed, research R8) ------------------------------
  var endpoint = 'https://selftest.example/' + Utilities.getUuid();
  var sub1 = subscribeDevice_({ endpoint: endpoint, p256dh: 'p256dh-a', auth: 'auth-a', deviceLabel: 'Test Device' }, 'max');
  assert_(sub1.subscribed === true, 'subscribeDevice_ reports subscribed on first enable');
  var afterFirst = listSubscriptionsForPerson_('max').filter(function (s) { return s.endpoint === endpoint; });
  assert_(afterFirst.length === 1, 'subscribeDevice_ creates exactly one row for a new endpoint');
  var firstId = afterFirst[0].id;

  subscribeDevice_({ endpoint: endpoint, p256dh: 'p256dh-b', auth: 'auth-b', deviceLabel: 'Test Device' }, 'max');
  var afterSecond = listSubscriptionsForPerson_('max').filter(function (s) { return s.endpoint === endpoint; });
  assert_(afterSecond.length === 1 && afterSecond[0].id === firstId,
    'subscribeDevice_ upserts the same endpoint instead of creating a duplicate row');
  assert_(afterSecond[0].p256dh === 'p256dh-b', 'subscribeDevice_ refreshes the keys on upsert');

  var otherEndpoint = 'https://selftest.example/' + Utilities.getUuid();
  subscribeDevice_({ endpoint: otherEndpoint, p256dh: 'p256dh-c', auth: 'auth-c' }, 'max');
  assert_(listSubscriptionsForPerson_('max').filter(function (s) {
    return s.endpoint === endpoint || s.endpoint === otherEndpoint;
  }).length === 2, 'a different endpoint creates a second, independent row');

  unsubscribeDevice_({ endpoint: endpoint });
  unsubscribeDevice_({ endpoint: otherEndpoint });
  assert_(listSubscriptionsForPerson_('max').filter(function (s) {
    return s.endpoint === endpoint || s.endpoint === otherEndpoint;
  }).length === 0, 'unsubscribeDevice_ removes the row');
  unsubscribeDevice_({ endpoint: endpoint }); // idempotent: unsubscribing again is a no-op, not an error

  // --- best-effort gating: disabled and no-devices paths never reach UrlFetchApp -------------
  var fakeTaskDisabled = { id: SELFTEST_PREFIX + 'push-disabled-' + Utilities.getUuid(), title: 'disabled-path task' };
  setSettingValue_('pushEnabled', 'FALSE');
  pushCompletion_(fakeTaskDisabled, 'max'); // must not throw, must not POST
  var disabledLog = readActivityFeed_({ limit: 100 }).filter(function (e) { return e.targetId === fakeTaskDisabled.id; });
  assert_(disabledLog.length === 1 && disabledLog[0].detail.indexOf('disabled') !== -1,
    'pushCompletion_ logs a skip and sends nothing when pushEnabled is FALSE');
  setSettingValue_('pushEnabled', 'TRUE');

  var fakeTaskNoDevices = { id: SELFTEST_PREFIX + 'push-nodevices-' + Utilities.getUuid(), title: 'no-devices task', owner: 'jaz' };
  pushAcknowledge_(fakeTaskNoDevices); // recipient is max; assume no real subscriptions -> must not throw, must not POST
  var noDevicesLog = readActivityFeed_({ limit: 100 }).filter(function (e) { return e.targetId === fakeTaskNoDevices.id; });
  assert_(noDevicesLog.length === 1 &&
    (noDevicesLog[0].detail.indexOf('no devices') !== -1 || noDevicesLog[0].detail.indexOf('pushed') !== -1),
    'pushAcknowledge_ logs a skip (or a real send) without throwing');

  Logger.log('unit push: pass');
}

/**
 * feature 010 — the crypto proof: encryptPayload_ reproduces the RFC 8291 §5 published
 * test vector byte-for-byte (salt/server-keypair injected via encryptPayload_'s test-only
 * opts), and a VAPID JWT signed by vapidHeaders_ verifies against its own public key. This
 * is the load-bearing check that the vendored SJCL crypto (research R1) is wired correctly —
 * runnable from the editor, no device needed. Public name so it appears in the Run menu.
 */
function selfTestPush() {
  // --- RFC 8291 §5 / Appendix A worked example (fixed inputs, exact expected outputs) --------
  var uaPublicB64 = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  var asPrivateB64 = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
  var asPublicB64 = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
  var saltB64 = 'DGv6ra1nlYgDCS1FRnbzlw';
  var authSecretB64 = 'BTBZMqHH6r4Tts7J_aSIgg';
  var plaintext = 'When I grow up, I want to be a watermelon';
  var expectedWireBody = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

  var wireBytes = encryptPayload_(plaintext, uaPublicB64, authSecretB64, {
    saltBits: sjcl.codec.base64url.toBits(saltB64),
    serverPrivateBits: sjcl.codec.base64url.toBits(asPrivateB64)
  });
  var wireB64 = sjcl.codec.base64url.fromBits(bytesToBits_(wireBytes));
  assert_(wireB64 === expectedWireBody,
    'encryptPayload_ reproduces the RFC 8291 test vector byte-for-byte; as_public was ' + asPublicB64);

  // --- VAPID (RFC 8292): generate, sign, and verify a JWT against its own public key ---------
  var kp = generateVapidKeys_();
  assert_(kp.publicKey.length > 0 && kp.privateKey.length > 0, 'generateVapidKeys_ returns a keypair');
  var headers = vapidHeaders_('https://web.push.apple.com/some/path', kp.publicKey, kp.privateKey,
    'mailto:selftest@example.com');
  assert_(headers.Authorization.indexOf('vapid t=') === 0, 'vapidHeaders_ builds a vapid Authorization header');
  var parts = headers.Authorization.match(/t=([^,]+),/)[1].split('.');
  assert_(parts.length === 3, 'the VAPID JWT has header.payload.signature');
  var signingInput = parts[0] + '.' + parts[1];
  var hash = sjcl.hash.sha256.hash(sjcl.codec.utf8String.toBits(signingInput));
  var sigBits = sjcl.codec.base64url.toBits(parts[2]);
  var pubRaw = sjcl.codec.base64url.toBits(kp.publicKey);
  var pubPoint = sjcl.ecc.curves.c256.fromBits(sjcl.bitArray.bitSlice(pubRaw, 8));
  var pub = new sjcl.ecc.ecdsa.publicKey(sjcl.ecc.curves.c256, pubPoint);
  assert_(pub.verify(hash, sigBits), 'the VAPID JWT signature verifies against its own public key');
  var payload = JSON.parse(Utilities.newBlob(
    Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  assert_(payload.aud === 'https://web.push.apple.com', 'the JWT aud is the endpoint origin, not the full URL');

  Logger.log('selfTestPush: pass (RFC 8291 vector + VAPID roundtrip)');
}

// ---------------------------------------------------------------------------
// Live: someday force-rank (feature 021, contracts/api-021.md)
// ---------------------------------------------------------------------------

function liveTasksRank_() {
  var pfx = SELFTEST_PREFIX + 'rank-';
  var actor = 'selftest';
  var a = createTask_({ title: pfx + 'a', owner: 'both' }, actor).id;
  var b = createTask_({ title: pfx + 'b', owner: 'both' }, actor).id;
  var c = createTask_({ title: pfx + 'c', owner: 'both' }, actor).id;

  function rankOf(id) {
    return listRecords_(TABS.TASKS).filter(function (t) { return t.id === id; })[0].somedayRank;
  }

  var logsBefore = countLogRows_('someday-rank', 'rank-someday');

  var result = rankTasks_({ order: [c, a, b] }, actor);
  assert_(result.ranked === 3, 'rankTasks_ ranks all 3 submitted ids');
  assert_(rankOf(c) === '1' && rankOf(a) === '2' && rankOf(b) === '3',
    'dense 1-based ranks assigned in submitted order');
  assert_(countLogRows_('someday-rank', 'rank-someday') === logsBefore + 1,
    'rank appends exactly one rank-someday log row, regardless of rows changed');

  // Idempotent replay: same order in, same ranks out, no data drift — but still logs the
  // explicit re-rank action (contracts/api-021.md: "no partial/corrupt order… safe to re-run").
  var replay = rankTasks_({ order: [c, a, b] }, actor);
  assert_(replay.ranked === 3 && rankOf(a) === '2',
    'idempotent replay: same ranked count, ranks unchanged');
  assert_(countLogRows_('someday-rank', 'rank-someday') === logsBefore + 2,
    'idempotent replay still logs the explicit re-rank (not a silent no-op)');

  // Re-rank with 'b' dropped (e.g. scheduled away): 'a'/'c' get fresh dense positions and
  // 'b's stale rank is cleared rather than left phantom (FR-021).
  rankTasks_({ order: [a, c] }, actor);
  assert_(rankOf(a) === '1' && rankOf(c) === '2', 'new order re-ranked densely');
  assert_(rankOf(b) === '', 'a rank absent from the new order is cleared, not left stale');

  // Unknown ids in the submitted order are skipped, not an error (list may have drifted).
  var withUnknown = rankTasks_({ order: [a, 'not-a-real-id-' + Utilities.getUuid(), c] }, actor);
  assert_(withUnknown.ranked === 2, 'unknown ids in order are skipped, not counted');

  // Empty order clears every rank in one call.
  var cleared = rankTasks_({ order: [] }, actor);
  assert_(cleared.ranked === 0 && rankOf(a) === '' && rankOf(c) === '',
    'empty order clears all ranks (ranked: 0)');

  assertFails_('VALIDATION_FAILED', function () { rankTasks_({}, actor); },
    'missing order is rejected');
  assertFails_('VALIDATION_FAILED', function () { rankTasks_({ order: 'not-an-array' }, actor); },
    'non-array order is rejected');

  assert_(isWriteAction_('tasks.rank'), 'tasks.rank is classified as a write action (shared-account acting-person gate)');

  [a, b, c].forEach(function (id) { deleteRecordById_(TABS.TASKS, id, actor); });
  Logger.log('live tasks.rank: pass');
}

// ---------------------------------------------------------------------------
// Live: Grocery & household lists (feature 024, contracts/api-024.md)
// ---------------------------------------------------------------------------

function countListItemRows_(listId) {
  return listRecords_(TABS.LIST_ITEMS).filter(function (i) { return i.listId === listId; }).length;
}

function liveListsCrud_() {
  var actor = 'selftest';
  var listId = SELFTEST_PREFIX + Utilities.getUuid();

  var created = createList_({ id: listId, name: 'Selftest Groceries' }, actor).list;
  assert_(created.id === listId && created.name === 'Selftest Groceries', 'lists.create stores name');

  assertFails_('BAD_REQUEST', function () { createList_({ id: listId, owner: 'max' }, actor); },
    'unknown field rejected on lists.create');
  assertFails_('VALIDATION_FAILED', function () { createList_({}, actor); },
    'missing name rejected on lists.create');

  // Cascade: deleting a list removes every ListItem row that belonged to it.
  var itemA = createListItem_({ listId: listId, name: 'Milk' }, actor).item;
  var itemB = createListItem_({ listId: listId, name: 'Eggs' }, actor).item;
  assert_(countListItemRows_(listId) === 2, 'two items created on the list');

  deleteList_({ id: listId }, actor);
  assert_(countListItemRows_(listId) === 0, 'deleting a list cascades to delete its items');
  assert_(listRecords_(TABS.LISTS).filter(function (l) { return l.id === listId; }).length === 0,
    'the list row itself is gone');

  assertFails_('NOT_FOUND', function () { deleteList_({ id: 'not-a-real-list-' + Utilities.getUuid() }, actor); },
    'deleting a non-existent list is NOT_FOUND');

  Logger.log('live Lists CRUD: pass');
}

function liveListItemsCrud_() {
  var actor = 'selftest';
  var listId = SELFTEST_PREFIX + Utilities.getUuid();
  createList_({ id: listId, name: 'Selftest Hardware' }, actor);

  // New items always start 'need'; a non-'need' create status is rejected.
  var milk = createListItem_({ listId: listId, name: 'Milk' }, actor).item;
  assert_(milk.status === 'need', 'new item defaults to need');
  assert_(milk.section === '' && milk.staple === 'FALSE' && milk.note === '',
    'section/staple/note default to blank/FALSE/blank');
  assertFails_('BAD_REQUEST', function () {
    createListItem_({ listId: listId, name: 'Bogus', status: 'stocked' }, actor);
  }, 'non-need create status is rejected');
  assertFails_('NOT_FOUND', function () {
    createListItem_({ listId: 'not-a-real-list-' + Utilities.getUuid(), name: 'X' }, actor);
  }, 'creating an item on an unknown list is NOT_FOUND');

  // Reuse-and-flip: re-adding the same name (case/whitespace-insensitive) never
  // duplicates — it flips the existing row to need instead (research R3).
  toggleListItem_({ id: milk.id }, actor); // → stocked
  var beforeCount = countListItemRows_(listId);
  var reused = createListItem_({ listId: listId, name: '  MILK ' }, actor).item;
  assert_(reused.id === milk.id, 'reuse-and-flip returns the existing row, not a new one');
  assert_(reused.status === 'need', 'reuse-and-flip flips the existing row to need');
  assert_(countListItemRows_(listId) === beforeCount, 'reuse-and-flip creates no duplicate row');
  var logsAfterFlip = countLogRows_(milk.id, 'list-item-need');
  var reusedAgain = createListItem_({ listId: listId, name: 'Milk' }, actor).item;
  assert_(reusedAgain.status === 'need' &&
    countLogRows_(milk.id, 'list-item-need') === logsAfterFlip,
    're-adding an already-need item is a true no-op: no new log row');

  // listItems.toggle flips need⇄stocked and is idempotent-safe by construction.
  var toStocked = toggleListItem_({ id: milk.id }, actor);
  assert_(toStocked.changed === true && toStocked.item.status === 'stocked', 'toggle flips need→stocked');
  var toNeed = toggleListItem_({ id: milk.id }, actor);
  assert_(toNeed.changed === true && toNeed.item.status === 'need', 'toggle flips stocked→need');
  assertFails_('NOT_FOUND', function () { toggleListItem_({ id: 'nope-' + Utilities.getUuid() }, actor); },
    'toggling an unknown item is NOT_FOUND');

  // listItems.update: section/staple/note editable; status/listId are not (use toggle;
  // moving between lists isn't supported).
  var updated = updateListItem_({ id: milk.id, section: 'dairy', staple: 'TRUE', note: '2 bags' }, actor).item;
  assert_(updated.section === 'dairy' && updated.staple === 'TRUE' && updated.note === '2 bags',
    'update patches section/staple/note');
  assertFails_('BAD_REQUEST', function () { updateListItem_({ id: milk.id, status: 'stocked' }, actor); },
    'status via listItems.update is rejected (use listItems.toggle)');
  assertFails_('BAD_REQUEST', function () { updateListItem_({ id: milk.id, listId: 'other' }, actor); },
    'listId via listItems.update is rejected');

  // listItems.list optionally filters by listId.
  var eggs = createListItem_({ listId: listId, name: 'Eggs' }, actor).item;
  assert_(listListItems_({ listId: listId }).items.length === 2, 'listItems.list filters to one list');
  assert_(listListItems_({}).items.filter(function (i) { return i.listId === listId; }).length === 2,
    'listItems.list with no filter still includes this list\'s items');

  // Outright delete (distinct from toggling to stocked).
  deleteListItem_({ id: eggs.id }, actor);
  assert_(countListItemRows_(listId) === 1, 'listItems.delete removes the row outright');

  assert_(isWriteAction_('listItems.toggle') && isWriteAction_('listItems.create'),
    'listItems write actions are classified as writes (shared-account acting-person gate)');

  deleteList_({ id: listId }, actor); // cleans up milk's row too
  Logger.log('live ListItems CRUD: pass');
}
