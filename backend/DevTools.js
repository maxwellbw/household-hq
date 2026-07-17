/**
 * DevTools.js — developer-only entry points (Phase 0 tooling, 2026-07-16).
 *
 * Run from the Apps Script editor or `clasp run` — never reachable through the
 * web API (Api.js dispatches only whitelisted actions). Public names (no trailing
 * underscore) so the editor Run menu and the Apps Script API can invoke them.
 */

/**
 * Mint a short-lived household session token for development, so a dev browser
 * can sign in without Google OAuth: paste the returned token into
 * localStorage['hq.sessionToken'] on the deployed app and reload — the normal
 * auth.whoami restore path takes it from there.
 *
 * Uses Max's allowlisted email from Settings and a 7-day TTL (vs the normal 30)
 * so stray dev tokens age out quickly. Revoke all tokens anytime by rotating the
 * SESSION_SECRET script property.
 */
/**
 * Sweep self-test residue out of the live Sheet. Suites clean up after themselves on
 * success, but an assertion failure aborts mid-run and strands `selftest-` rows (and
 * seed-ledger keys) in production. Safe to run anytime: only touches rows whose
 * id/seedKey/title/name/eventType/taskTitle starts with SELFTEST_PREFIX, and only
 * ledger keys with the same prefix. Returns a per-tab count of removals.
 */
function cleanupSelfTestResidue() {
  var MARKER_FIELDS = ['id', 'seedKey', 'title', 'name', 'eventType', 'taskTitle'];
  var isResidue = function (rec) {
    return MARKER_FIELDS.some(function (f) {
      return String(rec[f] || '').indexOf(SELFTEST_PREFIX) === 0;
    });
  };
  var counts = {};
  Object.keys(TABS).forEach(function (key) {
    var tab = TABS[key];
    if (tab === TABS.SETTINGS || tab === TABS.ACTIVITY_LOG) return;
    var residue = listRecords_(tab).filter(isResidue);
    residue.forEach(function (rec) {
      if (tab === TABS.EVENTS) deleteEvent_({ id: rec.id }, 'selftest'); // cascades prep + mirror
      else deleteRecordById_(tab, rec.id, 'selftest');
    });
    if (residue.length) counts[tab] = residue.length;
  });
  ['recurringSeedApplied', 'listSeedApplied', 'eventSeedApplied', 'templateSeedApplied'].forEach(function (ledger) {
    var applied = parseAppliedKeys_(readSettingsMap_()[ledger]);
    var kept = {};
    var dropped = 0;
    Object.keys(applied).forEach(function (k) {
      if (k.indexOf(SELFTEST_PREFIX) === 0) dropped++;
      else kept[k] = true;
    });
    if (dropped) {
      setSettingValue_(ledger, serializeAppliedKeys_(kept));
      counts['ledger:' + ledger] = dropped;
    }
  });
  Logger.log('cleanupSelfTestResidue: ' + JSON.stringify(counts));
  return counts;
}

function mintDevSessionToken() {
  var DEV_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var allow = readAllowlist_();
  if (!allow.maxEmail) throw new Error('mintDevSessionToken: maxEmail is not set in Settings.');
  var payloadB64 = b64Url_(JSON.stringify({
    e: allow.maxEmail,
    n: 'Max (dev)',
    x: Date.now() + DEV_TTL_MS
  }));
  var token = SESSION_TOKEN_PREFIX + '.' + payloadB64 + '.' + signSessionPayload_(payloadB64, sessionSecret_());
  Logger.log(token);
  return token;
}
