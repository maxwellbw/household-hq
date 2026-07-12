/**
 * Setup.js — one-time (re-runnable) database provisioning (FR-021, research D7).
 *
 * Run manually from the Apps Script editor, not exposed as an API action. For each of
 * the six tabs it creates the tab if missing, writes the header row only if row 1 is
 * empty, forces plain-text formatting so Sheets never coerces dates/UUIDs (research D6),
 * and freezes row 1. For a tab that already has headers, it appends any header named in
 * `HEADERS[tab]` but missing from row 1 (feature 005 research — the general column
 * migration that lands e.g. Events' `prepGeneratedFor` without disturbing existing
 * columns/data). It seeds Settings with labeled keys. It never deletes or clears, and a
 * second run changes nothing — safe to re-run forever.
 */

function setupDatabase() {
  var ss = openDb_();
  var order = [TABS.EVENTS, TABS.TASKS, TABS.TEMPLATES, TABS.RECURRING, TABS.ACTIVITY_LOG,
    TABS.SETTINGS, TABS.LISTS, TABS.LIST_ITEMS, TABS.RECURRING_EVENTS];
  var changed = false;

  order.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab);
    if (!sheet) {
      sheet = ss.insertSheet(tab);
      changed = true;
    }
    var headers = HEADERS[tab];
    // Plain-text format across the sheet BEFORE writing headers, so nothing is coerced.
    var cols = Math.max(headers.length, sheet.getMaxColumns());
    sheet.getRange(1, 1, sheet.getMaxRows(), cols).setNumberFormat('@');
    if (String(sheet.getRange(1, 1).getValue()).trim() === '') {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      changed = true;
    } else if (migrateHeaders_(sheet, headers)) {
      changed = true;
    }
    if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  });

  if (seedSettings_(ss)) changed = true;

  // Remove Sheets' default empty "Sheet1" if it isn't one of ours and is untouched.
  var def = ss.getSheetByName('Sheet1');
  if (def && order.indexOf('Sheet1') < 0 && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
    changed = true;
  }

  SpreadsheetApp.flush();
  // Log only when something was actually provisioned, so a no-op second run stays a no-op.
  if (changed) appendLog_('system', 'provision', '(database)', 'setupDatabase provisioned tabs/headers/settings');
  Logger.log(changed ? 'setupDatabase: provisioning applied.' : 'setupDatabase: already provisioned, no changes.');
}

/**
 * Append to `sheet`'s row 1 any header name from `expectedHeaders` not already present
 * (case/whitespace-insensitive match). Existing columns, order, and data are untouched —
 * new headers land after the last existing column. Plain-text formats the new cells first
 * so a later write can't be coerced. Returns true if it appended any (feature 005 research —
 * the general column-migration path; idempotent, safe to re-run).
 */
function migrateHeaders_(sheet, expectedHeaders) {
  var lastCol = sheet.getLastColumn();
  var existing = {};
  if (lastCol > 0) {
    sheet.getRange(1, 1, 1, lastCol).getValues()[0].forEach(function (name) {
      var n = String(name).trim();
      if (n !== '') existing[n] = true;
    });
  }
  var missing = expectedHeaders.filter(function (h) { return !existing[h]; });
  if (missing.length === 0) return false;
  var startCol = lastCol + 1;
  var range = sheet.getRange(1, startCol, 1, missing.length);
  range.setNumberFormat('@');
  range.setValues([missing]);
  return true;
}

/** Append any Settings seed key that is not already present. Returns true if it added any. */
function seedSettings_(ss) {
  var sheet = ss.getSheetByName(TABS.SETTINGS);
  var existing = {};
  var last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      var key = String(r[0]).trim();
      if (key !== '') existing[key] = true;
    });
  }
  var added = false;
  SETTINGS_SEED.forEach(function (entry) {
    if (!existing[entry[0]]) {
      // Plain-text write so values like "10:00" aren't coerced (research D6).
      writeRowAsText_(sheet, sheet.getLastRow() + 1, entry);
      added = true;
    }
  });
  return added;
}
