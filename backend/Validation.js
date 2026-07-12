/**
 * Validation.js — value + payload validation (FR-014).
 *
 * Two jobs:
 *   1. isValidType_() — cell-level checks shared by write validation (reject) and read
 *      warnings (surface, don't drop — FR-020).
 *   2. Payload validators (requireFields_, rejectUnknownFields_, validateFields_) that
 *      reject an invalid write whole, naming the offending field via VALIDATION_FAILED.
 *
 * All validators throw AppError_ (defined in Api.js); throwing aborts the write before
 * the Sheet is touched, so no partial writes and no ActivityLog row (FR-019).
 */

// ---------------------------------------------------------------------------
// Cell-level type checks
// ---------------------------------------------------------------------------

/** True if `value` (a non-empty string) satisfies `type`. */
function isValidType_(type, value) {
  switch (type) {
    case 'owner': return OWNERS.indexOf(value) >= 0;
    case 'status': return STATUSES.indexOf(value) >= 0;
    case 'cadence': return CADENCES.indexOf(value) >= 0;
    case 'date': return isIsoDate_(value);
    case 'datetime': return isIsoDateTime_(value);
    case 'int': return /^-?\d+$/.test(value);
    case 'posint': return /^\d+$/.test(value) && Number(value) >= 1;
    case 'month': return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 12;
    case 'text': return true;
    default: return true;
  }
}

/** `YYYY-MM-DD`, a real calendar date. */
function isIsoDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return !!m && isRealYmd_(+m[1], +m[2], +m[3]);
}

/** `YYYY-MM-DDTHH:mm` local (no offset — research D6), a real calendar date + time. */
function isIsoDateTime_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return false;
  return isRealYmd_(+m[1], +m[2], +m[3]) && +m[4] <= 23 && +m[5] <= 59;
}

function isRealYmd_(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  var dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

// ---------------------------------------------------------------------------
// Payload validators (write path)
// ---------------------------------------------------------------------------

/** Every field in `fields` must be present and non-empty on `payload`. */
function requireFields_(payload, fields) {
  fields.forEach(function (f) {
    var v = payload[f];
    if (v === undefined || v === null || String(v).trim() === '') {
      fail_('VALIDATION_FAILED', 'Missing required field "' + f + '".', f);
    }
  });
}

/** Any payload key not a known header for `tabName` is a client mistake (BAD_REQUEST). */
function rejectUnknownFields_(tabName, payload) {
  var allowed = HEADERS[tabName];
  Object.keys(payload).forEach(function (k) {
    if (allowed.indexOf(k) < 0) {
      fail_('BAD_REQUEST', 'Unknown field "' + k + '" for ' + tabName + '.');
    }
  });
}

/**
 * Validate every provided typed field on `payload` against FIELD_TYPES[tabName].
 * Empty optional fields pass. Throws VALIDATION_FAILED naming the first bad field.
 */
function validateFields_(tabName, payload) {
  var types = FIELD_TYPES[tabName] || {};
  Object.keys(types).forEach(function (field) {
    if (!payload.hasOwnProperty(field)) return;
    var val = String(payload[field]).trim();
    if (val === '') return;
    if (!isValidType_(types[field], val)) {
      fail_('VALIDATION_FAILED',
        'Field "' + field + '" has an invalid value: "' + val + '".', field);
    }
  });
}

/**
 * Season-window rule for Recurring (data-model.md): seasonStart/seasonEnd must both be
 * set or both blank; each 1–12; wrap-around (start > end) is legal. Provided for
 * feature 004's write path and exercised by SelfTest; Recurring is read-only in 001.
 */
function validateSeasonWindow_(seasonStart, seasonEnd) {
  var s = String(seasonStart == null ? '' : seasonStart).trim();
  var e = String(seasonEnd == null ? '' : seasonEnd).trim();
  if (s === '' && e === '') return; // year-round
  if (s === '' || e === '') {
    fail_('VALIDATION_FAILED', 'seasonStart and seasonEnd must both be set or both blank.',
      s === '' ? 'seasonStart' : 'seasonEnd');
  }
  if (!isValidType_('month', s)) fail_('VALIDATION_FAILED', 'seasonStart must be a month 1–12.', 'seasonStart');
  if (!isValidType_('month', e)) fail_('VALIDATION_FAILED', 'seasonEnd must be a month 1–12.', 'seasonEnd');
}
