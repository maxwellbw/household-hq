/**
 * ActivityLog.js — the append-only audit log (FR-006, FR-019, Principle VI).
 *
 * Exactly one row per successful state change. Application code only ever appends here —
 * never edits or deletes log rows. Callers invoke appendLog_ *after* their Sheet write
 * succeeds and inside the same lock, so a failed operation leaves no trace (the log
 * records what happened, not what was attempted).
 */

/**
 * Append one row: timestamp (household tz), actor, action, targetId, detail.
 * Columns are placed by header name so a hand-reordered ActivityLog still logs correctly.
 *
 * @param {string} actor    who did it (`system` for provisioning / blank-ID adoption)
 * @param {string} action   create | update | delete | adopt-id | provision
 * @param {string} targetId affected record's id (or a tab label for provision)
 * @param {string} [detail] human-readable summary (e.g. a deleted record's title)
 */
function appendLog_(actor, action, targetId, detail) {
  var sheet = getSheet_(TABS.ACTIVITY_LOG);
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = buildHeaderMap_(TABS.ACTIVITY_LOG, headerRow);
  var arr = [];
  for (var i = 0; i < headerRow.length; i++) arr[i] = '';
  arr[map['timestamp']] = nowIso_();
  arr[map['actor']] = actor;
  arr[map['action']] = action;
  arr[map['targetId']] = targetId;
  arr[map['detail']] = detail || '';
  // Plain-text write so the ISO timestamp isn't coerced into a Date (research D6).
  writeRowAsText_(sheet, sheet.getLastRow() + 1, arr);
}
