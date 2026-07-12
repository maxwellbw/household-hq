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

/**
 * Feature 003 lifecycle transition (complete/reopen). Reads the task's current status
 * *inside* the lock, so the decision to write-or-not is atomic against a concurrent
 * completer (research D2): if the task is already at `targetStatus`, it's a no-change —
 * the record is returned untouched with `changed:false` and NO ActivityLog row (FR-003).
 * Otherwise the status flips (done stamps completedBy/completedAt with `actor` + now; open
 * clears both), the row is written, and exactly one `logAction` row is appended (FR-015).
 *
 * @param {string} targetStatus 'done' (complete) or 'open' (reopen)
 * @param {string} logAction    'complete' or 'reopen' — the distinguishable feed action
 * @return {{task: Object, changed: boolean}}
 */
function setTaskLifecycle_(id, targetStatus, actor, logAction) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.TASKS);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + TABS.TASKS + ' record with id "' + id + '".');
    if (rec.status === targetStatus) {
      return { task: stripInternal_(rec), changed: false }; // idempotent no-change (FR-003)
    }
    var merged = stripInternal_(rec);
    merged.status = targetStatus;
    if (targetStatus === 'done') {
      merged.completedBy = actor;
      merged.completedAt = nowIso_();
    } else {
      merged.completedBy = '';
      merged.completedAt = '';
    }
    writeRowAsText_(t.sheet, rec._row, buildRowArray_(t, merged, t.values[rec._row - 1]));
    appendLog_(actor, logAction, id, merged.title || '');
    return { task: merged, changed: true };
  });
}

/**
 * Snooze a task (US3, feature 012). Inside the lock: if already snoozed to the same
 * dueDate, return unchanged (changed:false). Otherwise set status='snoozed', update
 * dueDate, append one snoozeHistory entry (<oldDue|∅>→<newDue> @ <nowIso>), write the
 * row, and log 'snooze'. History is append-only and never cleared.
 *
 * @return {{task: Object, changed: boolean}}
 */
function setTaskSnooze_(id, newDueDate, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.TASKS);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + TABS.TASKS + ' record with id "' + id + '".');
    if (rec.status === 'snoozed' && rec.dueDate === newDueDate) {
      return { task: stripInternal_(rec), changed: false };
    }
    var merged = stripInternal_(rec);
    var oldDue = String(rec.dueDate || '').trim() || '∅'; // ∅ when undated
    var entry = oldDue + '→' + newDueDate + ' @ ' + nowIso_(); // →
    var prev = String(rec.snoozeHistory || '').trim();
    merged.snoozeHistory = prev ? prev + ' | ' + entry : entry;
    merged.status = 'snoozed';
    merged.dueDate = newDueDate;
    writeRowAsText_(t.sheet, rec._row, buildRowArray_(t, merged, t.values[rec._row - 1]));
    appendLog_(actor, 'snooze', id, merged.title || '');
    return { task: merged, changed: true };
  });
}

/**
 * Acknowledge/commit to an assigned task (feature 019 US2, "I've got it"). Inside the lock:
 * if `ackBy` already equals `actor`, return unchanged (changed:false, idempotent replay —
 * mirrors setTaskSnooze_). Otherwise stamp ackBy/ackAt, write the row, and log 'acknowledge'.
 * Authorization (actor === owner, owner is a single person) is the caller's job (Api.js).
 *
 * @return {{task: Object, changed: boolean}}
 */
function setTaskAcknowledge_(id, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.TASKS);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + TABS.TASKS + ' record with id "' + id + '".');
    if (rec.ackBy === actor) {
      return { task: stripInternal_(rec), changed: false };
    }
    var merged = stripInternal_(rec);
    merged.ackBy = actor;
    merged.ackAt = nowIso_();
    writeRowAsText_(t.sheet, rec._row, buildRowArray_(t, merged, t.values[rec._row - 1]));
    appendLog_(actor, 'acknowledge', id, merged.title || '');
    return { task: merged, changed: true };
  });
}

/**
 * Unsnooze a task: return it to 'open' (snoozeHistory preserved). If already open,
 * no-change (changed:false). Logs 'unsnooze' on a real transition.
 *
 * @return {{task: Object, changed: boolean}}
 */
function setTaskUnsnooze_(id, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.TASKS);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + TABS.TASKS + ' record with id "' + id + '".');
    if (rec.status === 'open') {
      return { task: stripInternal_(rec), changed: false };
    }
    var merged = stripInternal_(rec);
    merged.status = 'open';
    writeRowAsText_(t.sheet, rec._row, buildRowArray_(t, merged, t.values[rec._row - 1]));
    appendLog_(actor, 'unsnooze', id, merged.title || '');
    return { task: merged, changed: true };
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
// Activity feed (feature 003 — read-only projection of ActivityLog; research D5)
// ---------------------------------------------------------------------------

/**
 * The ActivityLog as a bounded, newest-first feed. Pure read (no lock, never writes —
 * the log is append-only, FR-014). Order is append order **reversed**, not a timestamp
 * sort: `nowIso_` is minute-resolution so many rows share a minute, and row order is the
 * true sequence (research D5). Each entry is the five raw columns plus a composed,
 * human-readable `summary` that renders even when `targetId` no longer exists (FR-013).
 *
 * @param {{limit?: number, since?: string}} [opts] limit (default/max from Config) and an
 *        optional ISO `since` (keep entries with timestamp >= since).
 * @return {Object[]} newest-first feed entries (empty array on an empty log).
 */
function readActivityFeed_(opts) {
  opts = opts || {};
  var limit = Number(opts.limit);
  if (!(limit > 0)) limit = FEED_DEFAULT_LIMIT;
  limit = Math.min(limit, FEED_MAX_LIMIT);
  var since = opts.since != null ? String(opts.since).trim() : '';

  var t = readTable_(TABS.ACTIVITY_LOG);
  var out = [];
  for (var i = t.records.length - 1; i >= 0 && out.length < limit; i--) {
    var rec = t.records[i];
    if (since !== '' && !(String(rec.timestamp) >= since)) continue;
    out.push({
      timestamp: rec.timestamp,
      actor: rec.actor,
      action: rec.action,
      targetId: rec.targetId,
      detail: rec.detail,
      summary: composeFeedSummary_(rec.actor, rec.action, rec.detail)
    });
  }
  return out;
}

/** "Jaz completed 'Buy flea meds'" — unknown actor/action fall back to the raw value. */
function composeFeedSummary_(actor, action, detail) {
  var name = ACTOR_DISPLAY_NAMES[actor] || String(actor || '');
  var verb = ACTION_VERBS[action] || String(action || '');
  var title = String(detail || '').trim();
  return (name + ' ' + verb + (title !== '' ? " '" + title + "'" : '')).trim();
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

/**
 * Upsert a Settings row by key (feature 015): overwrite the value cell if the key already
 * has a row, else append a new `[key, value, '']` row. Plain-text write, like every other
 * Settings/Sheet mutation (research D6). Locked — Settings has no `id` column so this can't
 * go through createRecord_/updateRecordById_, but the same withLock_ serialization applies.
 */
function setSettingValue_(key, value) {
  withLock_(function () {
    var sheet = getSheet_(TABS.SETTINGS);
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = buildHeaderMap_(TABS.SETTINGS, headerRow);
    upsertSettingRow_(sheet, headerRow, map, key, value);
  });
}

/** Overwrite the value cell if `key` already has a row, else append `[key, value, '']`.
 *  Assumes the caller holds the Settings lock and has already fetched `sheet`/`headerRow`/`map`. */
function upsertSettingRow_(sheet, headerRow, map, key, value) {
  var last = sheet.getLastRow();
  var keyCol = map['key'];
  var valueCol = map['value'];
  for (var r = 2; r <= last; r++) {
    var rowKey = String(sheet.getRange(r, keyCol + 1).getValue()).trim();
    if (rowKey === key) {
      var cell = sheet.getRange(r, valueCol + 1);
      cell.setNumberFormat('@');
      cell.setValue(String(value));
      return;
    }
  }
  var arr = [];
  for (var i = 0; i < headerRow.length; i++) arr[i] = '';
  arr[keyCol] = key;
  arr[valueCol] = value;
  writeRowAsText_(sheet, sheet.getLastRow() + 1, arr);
}

/**
 * Upsert multiple Settings rows and append one ActivityLog row, atomically under one lock
 * (feature 020, FR-010/FR-012). `changes` is `{key: value}`; used by settings.update so the
 * whole save is atomic relative to other writers, mirroring the create/update record pattern
 * (appendLog_ runs inside the same lock as the write, per ActivityLog.js's contract).
 */
function setSettingValues_(changes, actor, detail) {
  withLock_(function () {
    var sheet = getSheet_(TABS.SETTINGS);
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var map = buildHeaderMap_(TABS.SETTINGS, headerRow);
    Object.keys(changes).forEach(function (key) {
      upsertSettingRow_(sheet, headerRow, map, key, changes[key]);
    });
    appendLog_(actor, 'settings-update', 'settings', detail);
  });
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
