/**
 * Sheets.js — the Sheet-as-DB engine.
 *
 * The single place that touches SpreadsheetApp. Everything reads a whole tab once
 * (getDataRange().getValues()), operates in memory, and writes back in one batch
 * (CLAUDE.md Sheets rule). Columns are mapped by header name, never by position
 * (research D3). Mutations serialize through the script lock (research D4).
 *
 * Read layer:  getSheet_, buildHeaderMap_, rowToRecord_, readTable_, listRecords_
 * Write layer: withLock_, findRecord_, buildRowArray_, createRecord_,
 *              updateRecordById_, deleteRecordById_
 * Resilience:  readTableForWrite_ (blank-ID adoption, FR-022), _warnings (FR-020)
 */

// ---------------------------------------------------------------------------
// Spreadsheet access
// ---------------------------------------------------------------------------

function openDb_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** A tab by name; a missing tab is a schema problem, not an empty result. */
function getSheet_(tabName) {
  var sheet = openDb_().getSheetByName(tabName);
  if (!sheet) fail_('SCHEMA_MISMATCH', 'Tab "' + tabName + '" is missing. Run setupDatabase().');
  return sheet;
}

function tabHasId_(tabName) {
  return ID_TABS.indexOf(tabName) >= 0;
}

// ---------------------------------------------------------------------------
// Header mapping (research D3, FR-020)
// ---------------------------------------------------------------------------

/**
 * headerName → 0-based column index, restricted to the tab's expected headers so
 * hand-added extra columns are ignored (but preserved on write). A missing or renamed
 * required header fails loudly with SCHEMA_MISMATCH rather than misreading positionally.
 */
function buildHeaderMap_(tabName, headerRow) {
  var present = {};
  headerRow.forEach(function (name, i) {
    var n = String(name).trim();
    if (n !== '' && !present.hasOwnProperty(n)) present[n] = i;
  });
  var map = {};
  HEADERS[tabName].forEach(function (name) {
    if (!present.hasOwnProperty(name)) {
      fail_('SCHEMA_MISMATCH', 'Tab "' + tabName + '" is missing required header "' + name + '".');
    }
    map[name] = present[name];
  });
  return map;
}

// ---------------------------------------------------------------------------
// Row <-> record
// ---------------------------------------------------------------------------

function isBlankRow_(row) {
  return row.every(function (c) { return c === '' || c === null || c === undefined; });
}

/**
 * A flat record keyed by header name ('' for empty cells). Rows with unparseable typed
 * cells are returned intact with a `_warnings` array rather than dropped (FR-020).
 * `_row` (1-based sheet row) and `_blankId` are internal; stripInternal_ removes them.
 */
function rowToRecord_(tabName, headerMap, row) {
  var rec = {};
  Object.keys(headerMap).forEach(function (name) {
    var v = row[headerMap[name]];
    rec[name] = (v === null || v === undefined) ? '' : String(v).trim();
  });
  var types = FIELD_TYPES[tabName] || {};
  var warnings = [];
  Object.keys(types).forEach(function (field) {
    var val = rec[field];
    if (val === '' || val === undefined) return;
    if (!isValidType_(types[field], val)) {
      warnings.push('Field "' + field + '" has an invalid value: "' + val + '"');
    }
  });
  if (warnings.length) rec._warnings = warnings;
  return rec;
}

/** Copy of a record without internal bookkeeping keys (keeps user-facing _warnings). */
function stripInternal_(rec) {
  var out = {};
  Object.keys(rec).forEach(function (k) {
    if (k !== '_row' && k !== '_blankId') out[k] = rec[k];
  });
  return out;
}

// ---------------------------------------------------------------------------
// Table read (lock-free)
// ---------------------------------------------------------------------------

/**
 * Read a whole tab once. Returns { sheet, values, headerRow, headerMap, idCol,
 * records, hasBlankIds }. Pure read — never writes (adoption is readTableForWrite_).
 */
function readTable_(tabName) {
  var sheet = getSheet_(tabName);
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) fail_('SCHEMA_MISMATCH', 'Tab "' + tabName + '" has no header row.');
  var headerRow = values[0];
  var headerMap = buildHeaderMap_(tabName, headerRow);
  var idCol = headerMap.hasOwnProperty('id') ? headerMap['id'] : -1;
  var records = [];
  var hasBlankIds = false;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (isBlankRow_(row)) continue; // ignore fully-empty spacer rows
    var rec = rowToRecord_(tabName, headerMap, row);
    rec._row = r + 1; // 1-based sheet row
    if (idCol >= 0 && String(row[idCol]).trim() === '') {
      rec._blankId = true;
      hasBlankIds = true;
    }
    records.push(rec);
  }
  return {
    sheet: sheet, values: values, headerRow: headerRow, headerMap: headerMap,
    idCol: idCol, records: records, hasBlankIds: hasBlankIds
  };
}

function findRecord_(table, id) {
  for (var i = 0; i < table.records.length; i++) {
    if (table.records[i].id === id) return table.records[i];
  }
  return null;
}

/**
 * All records of a tab as API-shaped objects. Adopts blank-ID rows first (FR-022) —
 * that write needs the lock, so only lock when adoption is actually required.
 */
function listRecords_(tabName) {
  var t = readTable_(tabName);
  if (t.hasBlankIds) {
    withLock_(function () { readTableForWrite_(tabName); });
    t = readTable_(tabName);
  }
  return t.records.map(stripInternal_);
}

// ---------------------------------------------------------------------------
// Locking (research D4, FR-018)
// ---------------------------------------------------------------------------

/**
 * Run `fn` under the script lock, which serializes across both users and triggers —
 * the only writers that will ever exist (Principle I). BUSY on timeout is retry-safe
 * (creates are idempotent). Reads never call this.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    fail_('BUSY', 'The database is busy; retry in a moment.');
  }
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Blank-ID adoption (FR-022) — assumes the caller holds the lock
// ---------------------------------------------------------------------------

/**
 * Like readTable_, but first adopts any hand-added row whose id cell is blank: assign a
 * UUID, write it back, and append an `adopt-id` ActivityLog row (actor `system`). Called
 * at the start of every mutation so writes operate on fully-identified rows. Idempotent —
 * a row that already has an id is untouched. MUST be called inside withLock_.
 */
function readTableForWrite_(tabName) {
  var t = readTable_(tabName);
  if (!t.hasBlankIds || t.idCol < 0) return t;
  t.records.forEach(function (rec) {
    if (!rec._blankId) return;
    var id = Utilities.getUuid();
    t.sheet.getRange(rec._row, t.idCol + 1).setValue(id);
    rec.id = id;
    rec._blankId = false;
    t.values[rec._row - 1][t.idCol] = id;
    appendLog_('system', 'adopt-id', id,
      'Assigned id to hand-added row in ' + tabName + (rec.title ? ' ("' + rec.title + '")' : ''));
  });
  t.hasBlankIds = false;
  return t;
}

// ---------------------------------------------------------------------------
// Mutations (research D3/D4/D5) — each appends exactly one ActivityLog row on success
// ---------------------------------------------------------------------------

/** Full-width row array: known fields by mapped index, extras preserved/blank. */
function buildRowArray_(table, record, existingRowArr) {
  var arr = existingRowArr ? existingRowArr.slice() : [];
  if (!existingRowArr) {
    for (var i = 0; i < table.headerRow.length; i++) arr[i] = '';
  }
  Object.keys(table.headerMap).forEach(function (name) {
    if (record.hasOwnProperty(name)) arr[table.headerMap[name]] = record[name];
  });
  return arr;
}

/**
 * Write a row as plain text (research D6). Forcing `@` on the exact target range right
 * before writing is the reliable guard: without it Sheets coerces ISO strings like
 * "2026-07-20" into Date objects (even in a column pre-formatted `@`), which then
 * round-trip as locale dates and break FR-009/FR-010. All values are stringified so a
 * stray Date object can never be stored.
 */
function writeRowAsText_(sheet, rowNumber, arr) {
  var strings = arr.map(function (v) {
    return (v === null || v === undefined) ? '' : String(v);
  });
  var range = sheet.getRange(rowNumber, 1, 1, strings.length);
  range.setNumberFormat('@');
  range.setValues([strings]);
}

/**
 * Create a record. Client-supplied id makes retries idempotent (FR-017/D5): if the id
 * already exists, the existing record is returned as success, not a duplicate.
 * `record` must be a full, validated object; `record.id` may be '' to auto-generate.
 */
function createRecord_(tabName, record, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(tabName);
    var id = String(record.id || '').trim();
    if (id) {
      var existing = findRecord_(t, id);
      if (existing) return stripInternal_(existing); // idempotent replay
    } else {
      id = Utilities.getUuid();
    }
    record.id = id;
    writeRowAsText_(t.sheet, t.sheet.getLastRow() + 1, buildRowArray_(t, record, null));
    appendLog_(actor, 'create', id, record.title || '');
    return stripInternal_(record);
  });
}

/**
 * Partial update by id. `patch` is a validated set of header fields to change; only
 * those columns are written (extras and unmentioned fields untouched). `invariant`, if
 * given, validates the merged record before the write (e.g. end >= start) and may throw.
 */
function updateRecordById_(tabName, id, patch, actor, invariant) {
  return withLock_(function () {
    var t = readTableForWrite_(tabName);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + tabName + ' record with id "' + id + '".');
    var merged = stripInternal_(rec);
    Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
    if (invariant) invariant(merged);
    var rowArr = buildRowArray_(t, merged, t.values[rec._row - 1]);
    writeRowAsText_(t.sheet, rec._row, rowArr);
    appendLog_(actor, 'update', id, merged.title || '');
    return stripInternal_(merged);
  });
}

/** Hard delete by id; the ActivityLog row (with the record's title) is the record. */
function deleteRecordById_(tabName, id, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(tabName);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + tabName + ' record with id "' + id + '".');
    t.sheet.deleteRow(rec._row);
    appendLog_(actor, 'delete', id, rec.title || '');
    return id;
  });
}

// ---------------------------------------------------------------------------
// Settings (key–value; read-only via API in 001)
// ---------------------------------------------------------------------------

/** { key: value } for every Settings row with a non-empty key. */
function readSettingsMap_() {
  var t = readTable_(TABS.SETTINGS);
  var out = {};
  t.records.forEach(function (rec) {
    var key = String(rec.key || '').trim();
    if (key !== '') out[key] = rec.value;
  });
  return out;
}

var _tzCache = null;

/** Household timezone from Settings, falling back to the script tz then the default. */
function getTimezone_() {
  if (_tzCache) return _tzCache;
  try {
    var tz = readSettingsMap_()['timezone'];
    _tzCache = (tz && String(tz).trim()) || Session.getScriptTimeZone() || DEFAULT_TIMEZONE;
  } catch (e) {
    _tzCache = Session.getScriptTimeZone() || DEFAULT_TIMEZONE;
  }
  return _tzCache;
}

/** Current instant as `YYYY-MM-DDTHH:mm` in the household timezone (research D6). */
function nowIso_() {
  return Utilities.formatDate(new Date(), getTimezone_(), "yyyy-MM-dd'T'HH:mm");
}
