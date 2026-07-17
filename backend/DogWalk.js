/**
 * DogWalk.js — the weather-aware dog-walk window finder (feature 011).
 *
 * A daily trigger reads free/busy from both work calendars (Google-native, or an
 * Outlook/Exchange ICS subscribed into Google Calendar — research R4) + the shared Household
 * calendar over a rolling ~14-day (real-forecast) horizon, subtracts an ignore-list,
 * intersects the mutual-free time with an Open-Meteo hourly forecast, and books the
 * longest walk (60/45/30 min) closest to midday as two single-guest invites on the
 * household account's own calendar — recorded as one row in the DogWalks ledger. Never
 * auto-cancels: a booked window that turns bad is moved; if nothing good remains, the day
 * is flagged `needs-decision` and both users are pushed. See specs/011-dog-walk-finder/.
 *
 * Settings/parse:  readDogWalkSettings_, parseIgnoreList_, parseDurations_,
 *                  parseWmoSnowIce_, hhmmToMinutes_, walkDateTime_, isoWithOffset_,
 *                  parseIsoWithOffset_
 * Ledger:          readDogWalkRows_, findRow_, upsertDogWalkRow_
 * Availability:    fetchAllSourceEvents_ (fetchWorkCalEvents_/fetchHouseholdEvents_),
 *                  computeAvailability_, mergeIntervals_/subtractFromInterval_/unionInterval_
 * Weather:         fetchForecast_, weatherGate_
 * Selection:       selectWindow_, secondWalkPlan_
 * Booking:         bookOrReconcileWalk_, ensureInviteEvent_, tagWalkEvent_, moveWalk_,
 *                  flagNeedsDecision_, sendDogWalkPush_
 * Run-loop:        runDogWalkFinder, processDogWalkDay_, resolveSlot_, isFrozen_,
 *                  ownWindowOf_, sameWindow_
 * Trigger:         installDogWalkTrigger
 * Reader:          listUpcomingDogWalks_
 */

// ---------------------------------------------------------------------------
// Settings + parse helpers
// ---------------------------------------------------------------------------

/** Typed dog-walk config from Settings (data-model.md), every value blank/invalid-safe. */
function readDogWalkSettings_() {
  var map = readSettingsMap_();
  return {
    timezone: getTimezone_(),
    lat: numOrNull_(map.householdLat),
    lon: numOrNull_(map.householdLon),
    autoBook: isEnabled_(map, 'dogWalkAutoBook'),
    maxWorkCalId: String(map.maxWorkCalId || '').trim(),
    jazWorkCalId: String(map.jazWorkCalId || '').trim(),
    maxWorkEmail: String(map.maxWorkEmail || '').trim(),
    jazWorkEmail: String(map.jazWorkEmail || '').trim(),
    ignoreList: parseIgnoreList_(map.dogWalkIgnoreList),
    title: String(map.dogWalkTitle || '').trim() || 'Booked',
    earliestStart: String(map.dogWalkEarliestStart || '').trim() || '08:00',
    latestStart: String(map.dogWalkLatestStart || '').trim() || '16:00',
    durationsMin: parseDurations_(map.dogWalkDurationsMin),
    bandStart: String(map.dogWalkMiddayBandStart || '').trim() || '09:00',
    bandEnd: String(map.dogWalkMiddayBandEnd || '').trim() || '12:00',
    secondTriggerBefore: String(map.dogWalkSecondTriggerBefore || '').trim() || '09:00',
    secondAfter: String(map.dogWalkSecondAfter || '').trim() || '13:00',
    secondDurationMin: Number(map.dogWalkSecondDurationMin) > 0 ? Number(map.dogWalkSecondDurationMin) : 30,
    reliableDays: Number(map.dogWalkReliableDays) > 0 ? Number(map.dogWalkReliableDays) : 14,
    outerDays: Number(map.dogWalkOuterDays) > 0 ? Number(map.dogWalkOuterDays) : 21,
    weatherHeatF: map.weatherHeatF !== undefined && String(map.weatherHeatF).trim() !== '' ? Number(map.weatherHeatF) : 80,
    weatherColdFloorF: map.weatherColdFloorF !== undefined && String(map.weatherColdFloorF).trim() !== '' ? Number(map.weatherColdFloorF) : 20,
    weatherPrecipPct: map.weatherPrecipPct !== undefined && String(map.weatherPrecipPct).trim() !== '' ? Number(map.weatherPrecipPct) : 50
  };
}

/** A finite number, or `null` for blank/undefined/non-numeric (e.g. a coordinate a human
 *  pasted in DMS like `44°03'56.1"N` — Number() would yield NaN; we want a clean "unset"
 *  so `fetchForecast_` reports coordinates-unset rather than firing a NaN request). */
function numOrNull_(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

/** `;`-split, trim, lowercase (FR-002 case-insensitive ignore-list). */
function parseIgnoreList_(str) {
  return String(str || '').split(';')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s !== ''; });
}

/** `"60,45,30"` -> `[60,45,30]`, preference order preserved; falls back to the default. */
function parseDurations_(str) {
  var parsed = String(str || '').split(',')
    .map(function (s) { return parseInt(s.trim(), 10); })
    .filter(function (n) { return !isNaN(n) && n > 0; });
  return parsed.length ? parsed : [60, 45, 30];
}

/** The fixed snow/ice/freezing WMO weathercode set (research R5) as a code->true map. */
function parseWmoSnowIce_() {
  var set = {};
  DOG_WALK_WMO_SNOW_ICE.forEach(function (code) { set[code] = true; });
  return set;
}

/** `"HH:MM"` -> minutes from midnight; malformed input is treated as midnight (0). */
function hhmmToMinutes_(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return 0;
  return (+m[1]) * 60 + (+m[2]);
}

/** `ymd` + `"HH:MM"` -> a household-tz wall-clock Date (reuses CalendarSync.js's datetime
 *  parser rather than duplicating it — Principle IV). */
function walkDateTime_(ymd, hhmm) {
  return parseHouseholdDatetime_(ymd + 'T' + hhmm);
}

/** A Date -> `"YYYY-MM-DDTHH:mm:ss±HH:MM"` in `timezone` (data-model.md ISO-with-offset). */
function isoWithOffset_(date, timezone) {
  return Utilities.formatDate(date, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * The inverse of `isoWithOffset_`. Because the string was written using the household tz's
 * own offset, its wall-clock fields already ARE household-local time — reconstructing a
 * local Date from those fields (ignoring the numeric offset itself) mirrors
 * `parseHouseholdDatetime_`'s convention and needs no timezone math. Returns null on a
 * malformed/blank string.
 */
function parseIsoWithOffset_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})[+-]\d{2}:\d{2}$/.exec(String(iso || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/** `"HH:mm-HH:mm"` in the household tz, for ActivityLog detail strings. */
function formatWindow_(plan) {
  var tz = getTimezone_();
  return Utilities.formatDate(plan.windowStart, tz, 'HH:mm') + '-' + Utilities.formatDate(plan.windowEnd, tz, 'HH:mm');
}

// ---------------------------------------------------------------------------
// DogWalks ledger read/upsert (natural key: date + slot, never row position)
// ---------------------------------------------------------------------------

function readDogWalkRows_() {
  return listRecords_(TABS.DOG_WALKS);
}

function findRow_(rows, ymd, slot) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].date === ymd && rows[i].slot === slot) return rows[i];
  }
  return null;
}

/**
 * Upsert a DogWalks row by its natural (date, slot) key — never by row position.
 * `fields` must include `date`/`slot`; any other DogWalks header may be set. Always
 * stamps `updatedAt`. `withLock_`-wrapped (Principle V). Does not itself append to
 * ActivityLog — callers log their own specific verb (book/move/suggest/needs-decision).
 */
function upsertDogWalkRow_(fields) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.DOG_WALKS);
    var existing = null;
    for (var i = 0; i < t.records.length; i++) {
      if (t.records[i].date === fields.date && t.records[i].slot === fields.slot) {
        existing = t.records[i];
        break;
      }
    }
    var merged = existing ? stripInternal_(existing) : { id: fields.id || Utilities.getUuid() };
    Object.keys(fields).forEach(function (k) { merged[k] = fields[k]; });
    merged.updatedAt = nowIso_();
    if (existing) {
      writeRowAsText_(t.sheet, existing._row, buildRowArray_(t, merged, t.values[existing._row - 1]));
    } else {
      writeRowAsText_(t.sheet, t.sheet.getLastRow() + 1, buildRowArray_(t, merged, null));
    }
    return merged;
  });
}

// ---------------------------------------------------------------------------
// Availability: work calendars + Household calendar, minus ignore-list (research R3/R4)
// ---------------------------------------------------------------------------

/** One source calendar's events, normalized to plain `{title, start, end, allDay}` objects
 *  so `computeAvailability_` never touches `CalendarApp` directly (pure/testable). Returns
 *  `null` when the calendar id is blank or unreadable — the fail-safe signal (FR-022). */
function fetchWorkCalEvents_(calId, rangeStart, rangeEnd) {
  var id = String(calId || '').trim();
  if (id === '') return null;
  try {
    var cal = CalendarApp.getCalendarById(id);
    if (!cal) return null;
    return cal.getEvents(rangeStart, rangeEnd).map(function (e) {
      return { title: e.getTitle(), start: e.getStartTime(), end: e.getEndTime(), allDay: e.isAllDayEvent() };
    });
  } catch (e) {
    return null;
  }
}

/** The shared Household calendar is a soft source (FR-001 adds it, but it's not one of the
 *  two required work calendars) — unset/unreadable just means no extra constraint. */
function fetchHouseholdEvents_(rangeStart, rangeEnd) {
  var cal = getHouseholdCalendar_();
  if (!cal) return [];
  try {
    return cal.getEvents(rangeStart, rangeEnd).map(function (e) {
      return { title: e.getTitle(), start: e.getStartTime(), end: e.getEndTime(), allDay: e.isAllDayEvent() };
    });
  } catch (e) {
    return [];
  }
}

/** All three sources over the whole horizon, fetched once each (research R8). Both work
 *  calendars read through `fetchWorkCalEvents_`: Google-native calendars directly, and
 *  Outlook/Exchange calendars via a Google Calendar "From URL" subscription that Google
 *  expands (recurrence, timezones, titles) before we ever read it (research R4). */
function fetchAllSourceEvents_(settings, rangeStart, rangeEnd) {
  return {
    max: fetchWorkCalEvents_(settings.maxWorkCalId, rangeStart, rangeEnd),
    jaz: fetchWorkCalEvents_(settings.jazWorkCalId, rangeStart, rangeEnd),
    household: fetchHouseholdEvents_(rangeStart, rangeEnd)
  };
}

function mergeIntervals_(intervals) {
  if (intervals.length === 0) return [];
  var sorted = intervals.slice().sort(function (a, b) { return a.start - b.start; });
  var out = [{ start: sorted[0].start, end: sorted[0].end }];
  for (var i = 1; i < sorted.length; i++) {
    var last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      if (sorted[i].end > last.end) last.end = sorted[i].end;
    } else {
      out.push({ start: sorted[i].start, end: sorted[i].end });
    }
  }
  return out;
}

/** `base` minus every (sorted, merged) interval in `busy`, clipped to `base`. */
function subtractFromInterval_(base, busy) {
  var free = [];
  var cursor = base.start;
  busy.forEach(function (b) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start < base.end ? b.start : base.end });
    if (b.end > cursor) cursor = b.end;
  });
  if (cursor < base.end) free.push({ start: cursor, end: base.end });
  return free.filter(function (iv) { return iv.end > iv.start; });
}

/** Add `extra` as free time and re-merge (used to union back a walk's own window). */
function unionInterval_(freeList, extra) {
  return mergeIntervals_(freeList.concat([extra]));
}

/**
 * Mutual-free intervals for `ymd` within [earliestStart, latestStart] (household tz):
 * the day's window minus the union of timed busy blocks across max/jaz/household, minus
 * ignore-listed titles (case-insensitive), with `ownWindow` (a day's own already-booked
 * walk, from the ledger — not the gcal tag, which doesn't propagate to guest copies;
 * research R2/R3) unioned back in as free. **All-day events never block** (research R4,
 * confirmed against real calendars 2026-07-14): they're day-context — other people's
 * PTO/OOO, on-call rotations, household to-dos — not time commitments that preclude a short
 * midday walk. Returns `null` (calendar-unreadable, FR-022) when either work calendar source
 * is unconfigured/unreadable.
 */
function computeAvailability_(sourceEventsByCal, ymd, settings, ownWindow) {
  if (sourceEventsByCal.max === null || sourceEventsByCal.jaz === null) return null;

  var dayStart = walkDateTime_(ymd, settings.earliestStart);
  var dayEnd = walkDateTime_(ymd, settings.latestStart);
  if (dayEnd <= dayStart) return [];

  var busy = [];
  ['max', 'jaz', 'household'].forEach(function (key) {
    (sourceEventsByCal[key] || []).forEach(function (ev) {
      if (ev.allDay) return; // day-context, not a time commitment — never blocks (research R4)
      if (ev.title && settings.ignoreList.indexOf(String(ev.title).trim().toLowerCase()) >= 0) return;
      var s = ev.start;
      var e = ev.end;
      if (e <= dayStart || s >= dayEnd) return;
      busy.push({ start: s < dayStart ? dayStart : s, end: e > dayEnd ? dayEnd : e });
    });
  });

  var free = subtractFromInterval_({ start: dayStart, end: dayEnd }, mergeIntervals_(busy));
  if (ownWindow) free = unionInterval_(free, ownWindow);
  return free;
}

// ---------------------------------------------------------------------------
// Weather (research R5)
// ---------------------------------------------------------------------------

var DOG_WALK_FETCH_MAX_ATTEMPTS_ = 3;
var DOG_WALK_FETCH_RETRY_SLEEP_MS_ = 500;

// Test seam (feature 029 US6): the sole point that calls UrlFetchApp for the forecast, so
// selfTestDogWalk can swap it out to inject a transient failure without hitting the
// network. Never reassigned outside tests.
var dogWalkFetch_ = function (url) {
  return UrlFetchApp.fetch(url, { muteHttpExceptions: true });
};

/** One Open-Meteo hourly forecast fetch -> `{"YYYY-MM-DDTHH": {temp, precipProb, code}}`.
 *  Returns `null` if the forecast is genuinely unavailable (missing coords, or every
 *  attempt below fails) so callers can defer affected days rather than book/flag against a
 *  fabricated forecast (research R5). Retries a transient fetch failure (thrown exception
 *  or non-200) up to DOG_WALK_FETCH_MAX_ATTEMPTS_ times with a short backoff — trigger-driven
 *  runs otherwise see more transient failures than manual runs and defer everything (feature
 *  029 US6). Logs the specific failure mode (coords unset / HTTP code / exception message /
 *  malformed JSON) so a genuine failure is diagnosable from the execution log, not just an
 *  ambiguous catch-all. */
function fetchForecast_(settings) {
  if (settings.lat == null || settings.lon == null) {
    Logger.log('fetchForecast_: coordinates unset.');
    return null;
  }
  var url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + encodeURIComponent(settings.lat)
    + '&longitude=' + encodeURIComponent(settings.lon)
    + '&hourly=temperature_2m,precipitation_probability,weathercode'
    + '&temperature_unit=fahrenheit'
    + '&timezone=' + encodeURIComponent(settings.timezone)
    + '&forecast_days=16';

  var lastReason = 'unknown';
  for (var attempt = 1; attempt <= DOG_WALK_FETCH_MAX_ATTEMPTS_; attempt++) {
    try {
      var resp = dogWalkFetch_(url);
      var code = resp.getResponseCode();
      if (code !== 200) {
        lastReason = 'non-200 response (HTTP ' + code + ')';
      } else {
        var data = JSON.parse(resp.getContentText());
        var hourly = data && data.hourly;
        if (!hourly || !hourly.time) {
          lastReason = 'malformed forecast JSON (missing hourly.time)';
        } else {
          var map = {};
          hourly.time.forEach(function (t, i) {
            map[String(t).substring(0, 13)] = {
              temp: hourly.temperature_2m[i],
              precipProb: hourly.precipitation_probability[i],
              code: hourly.weathercode[i]
            };
          });
          return map;
        }
      }
    } catch (e) {
      lastReason = 'exception (' + (e && e.message ? e.message : e) + ')';
    }
    Logger.log('fetchForecast_: attempt ' + attempt + '/' + DOG_WALK_FETCH_MAX_ATTEMPTS_ + ' failed — ' + lastReason);
    if (attempt < DOG_WALK_FETCH_MAX_ATTEMPTS_) Utilities.sleep(DOG_WALK_FETCH_RETRY_SLEEP_MS_);
  }
  Logger.log('fetchForecast_: all ' + DOG_WALK_FETCH_MAX_ATTEMPTS_ + ' attempts failed — ' + lastReason);
  return null;
}

/**
 * True iff every hour `[windowStart, windowEnd)` overlaps passes all four gates: not over
 * the heat ceiling, not under the cold floor, precip probability below threshold, and no
 * snow/ice/freezing WMO code (research R5). A missing forecast (`null`) or a missing hour
 * both fail closed — never books/keeps a walk on incomplete weather data.
 */
function weatherGate_(forecast, windowStart, windowEnd, settings) {
  if (!forecast) return false;
  var wmoSet = parseWmoSnowIce_();
  var tz = settings.timezone;
  var cursor = new Date(windowStart.getTime());
  cursor.setMinutes(0, 0, 0);
  while (cursor < windowEnd) {
    var key = Utilities.formatDate(cursor, tz, "yyyy-MM-dd'T'HH");
    var metrics = forecast[key];
    if (!metrics) return false;
    if (Number(metrics.temp) > settings.weatherHeatF) return false;
    if (Number(metrics.temp) < settings.weatherColdFloorF) return false;
    if (Number(metrics.precipProb) >= settings.weatherPrecipPct) return false;
    if (wmoSet[Number(metrics.code)]) return false;
    cursor = new Date(cursor.getTime() + 3600000);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Window selection (research R9): longest-fitting duration, then band + closest-to-midday
// ---------------------------------------------------------------------------

var DOG_WALK_NOON_MIN = 12 * 60;

/**
 * R9: pick the longest duration (in `durationsMin` order) that has ANY eligible
 * (mutual-free ∩ weather-good, when `forecast` is given) window, then among windows of
 * that duration prefer the 9–12 band over outside it, then closest to noon, then earliest.
 * `forecast` may be omitted (US1, weather-agnostic); a real forecast object gates US2+.
 */
function selectWindow_(freeIntervals, forecast, durationsMin, settings) {
  var bandStartMin = hhmmToMinutes_(settings.bandStart);
  var bandEndMin = hhmmToMinutes_(settings.bandEnd);

  for (var di = 0; di < durationsMin.length; di++) {
    var durationMin = durationsMin[di];
    var bestInBand = null, bestAny = null;
    for (var i = 0; i < freeIntervals.length; i++) {
      var got = bestCandidatesForDuration_(freeIntervals[i], forecast, durationMin, bandStartMin, bandEndMin, settings);
      if (got.inBand && (!bestInBand || got.inBand.dist < bestInBand.dist ||
          (got.inBand.dist === bestInBand.dist && got.inBand.start < bestInBand.start))) bestInBand = got.inBand;
      if (got.any && (!bestAny || got.any.dist < bestAny.dist ||
          (got.any.dist === bestAny.dist && got.any.start < bestAny.start))) bestAny = got.any;
    }
    var winner = bestInBand || bestAny;
    if (winner) {
      return {
        windowStart: winner.start,
        windowEnd: new Date(winner.start.getTime() + durationMin * 60000),
        durationMin: durationMin
      };
    }
  }
  return null;
}

/**
 * The best candidate start within one free interval for a fixed `durationMin`, scanning at
 * `DOG_WALK_STEP_MIN` granularity (plus the interval's exact last-possible start) so
 * non-contiguous weather-good sub-windows are found without complex interval math. Returns
 * `{inBand, any}` — the best in-band and best any-tier candidate (each `{start, dist}`,
 * dist = minutes from noon), or nulls when nothing fits/passes weather.
 */
function bestCandidatesForDuration_(iv, forecast, durationMin, bandStartMin, bandEndMin, settings) {
  var lenMs = iv.end - iv.start;
  if (lenMs < durationMin * 60000) return { inBand: null, any: null };
  var lastStartMs = iv.end.getTime() - durationMin * 60000;
  var starts = [];
  for (var t = iv.start.getTime(); t <= lastStartMs; t += DOG_WALK_STEP_MIN * 60000) starts.push(t);
  if (starts.length === 0 || starts[starts.length - 1] !== lastStartMs) starts.push(lastStartMs);

  var inBand = null, any = null;
  starts.forEach(function (startMs) {
    var startDate = new Date(startMs);
    var endDate = new Date(startMs + durationMin * 60000);
    if (forecast !== null && forecast !== undefined && !weatherGate_(forecast, startDate, endDate, settings)) return;
    var startMin = startDate.getHours() * 60 + startDate.getMinutes();
    var dist = Math.abs(DOG_WALK_NOON_MIN - startMin);
    var candidate = { start: startDate, dist: dist };
    if (!any || dist < any.dist || (dist === any.dist && startDate < any.start)) any = candidate;
    if (startMin >= bandStartMin && startMin <= bandEndMin &&
        (!inBand || dist < inBand.dist || (dist === inBand.dist && startDate < inBand.start))) inBand = candidate;
  });
  return { inBand: inBand, any: any };
}

/**
 * FR-009: when the primary walk starts before `secondTriggerBefore`, find a
 * `secondDurationMin` window starting at/after `secondAfter`, weather-gated the same way;
 * else `null`. No band preference — earliest eligible after the cutoff wins (no clarify
 * addressed a tie-break here; earliest is the simplest, most predictable default).
 */
function secondWalkPlan_(primaryPlan, freeIntervals, forecast, settings) {
  if (!primaryPlan) return null;
  var primaryStartMin = primaryPlan.windowStart.getHours() * 60 + primaryPlan.windowStart.getMinutes();
  if (primaryStartMin >= hhmmToMinutes_(settings.secondTriggerBefore)) return null;

  var afterMin = hhmmToMinutes_(settings.secondAfter);
  var durationMin = settings.secondDurationMin;
  var best = null;

  freeIntervals.forEach(function (iv) {
    var lenMs = iv.end - iv.start;
    if (lenMs < durationMin * 60000) return;
    var lastStartMs = iv.end.getTime() - durationMin * 60000;
    var starts = [];
    for (var t = iv.start.getTime(); t <= lastStartMs; t += DOG_WALK_STEP_MIN * 60000) starts.push(t);
    if (starts.length === 0 || starts[starts.length - 1] !== lastStartMs) starts.push(lastStartMs);

    starts.forEach(function (startMs) {
      var startDate = new Date(startMs);
      var startMin = startDate.getHours() * 60 + startDate.getMinutes();
      if (startMin < afterMin) return;
      var endDate = new Date(startMs + durationMin * 60000);
      if (forecast && !weatherGate_(forecast, startDate, endDate, settings)) return;
      if (!best || startDate < best) best = startDate;
    });
  });

  if (!best) return null;
  return { windowStart: best, windowEnd: new Date(best.getTime() + durationMin * 60000), durationMin: durationMin };
}

// ---------------------------------------------------------------------------
// Booking (research R1/R2): two single-guest invites on the household account's own calendar
// ---------------------------------------------------------------------------

function tagWalkEvent_(calEvent, id, person) {
  calEvent.setTag('hhqKind', 'dogwalk');
  calEvent.setTag('hhqId', id);
  calEvent.setTag('hhqPerson', person);
}

/**
 * Ensure one person's single-guest invite reflects `plan`'s window. Reconciles in place
 * (no duplicate) when `existingId` still resolves; creates fresh when there was never an
 * id; and — per spec Assumptions — does NOT recreate an id that no longer resolves (a
 * user's manual deletion is respected, not force-recreated).
 */
function ensureInviteEvent_(cal, existingId, plan, title, email, dogWalkId, person) {
  var existing = existingId ? resolveGcalEvent_(cal, existingId) : null;
  if (existing) {
    existing.setTime(plan.windowStart, plan.windowEnd);
    return existingId;
  }
  if (existingId) return '';
  var created = cal.createEvent(title, plan.windowStart, plan.windowEnd, { guests: email, sendInvites: true });
  tagWalkEvent_(created, dogWalkId, person);
  return created.getId();
}

/**
 * Book (or idempotently reconcile) one (date, slot). Suggest-only mode (`!settings.autoBook`)
 * skips invite creation entirely and writes `status='suggested'`; flipping the flag on a
 * later run upgrades a suggested row to booked (existing blank ids just get created then).
 * `existingRow` (if any) supplies the row/invite identity so retries never duplicate.
 */
function bookOrReconcileWalk_(existingRow, plan, settings) {
  var id = existingRow ? existingRow.id : Utilities.getUuid();
  var isSuggestOnly = !settings.autoBook;
  var maxId = existingRow ? existingRow.maxGcalEventId : '';
  var jazId = existingRow ? existingRow.jazGcalEventId : '';

  if (!isSuggestOnly) {
    var cal = CalendarApp.getDefaultCalendar();
    if (settings.maxWorkEmail) maxId = ensureInviteEvent_(cal, maxId, plan, settings.title, settings.maxWorkEmail, id, 'max');
    if (settings.jazWorkEmail) jazId = ensureInviteEvent_(cal, jazId, plan, settings.title, settings.jazWorkEmail, id, 'jaz');
  }

  var status = isSuggestOnly ? 'suggested' : 'booked';
  var row = upsertDogWalkRow_({
    id: id, date: plan.ymd, slot: plan.slot, status: status,
    windowStart: isoWithOffset_(plan.windowStart, settings.timezone),
    windowEnd: isoWithOffset_(plan.windowEnd, settings.timezone),
    durationMin: plan.durationMin, maxGcalEventId: maxId, jazGcalEventId: jazId, reason: ''
  });
  appendLog_('system', isSuggestOnly ? 'dogwalk-suggest' : 'dogwalk-book', row.id,
    plan.ymd + ' ' + plan.slot + ' walk ' + (isSuggestOnly ? 'suggested' : 'booked') + ' ' + formatWindow_(plan));
  return row;
}

/** US3: move both stored invites to `plan`'s new window; ledger stays `booked`. Never
 *  called on a genuinely unchanged window (the caller only invokes this on real change),
 *  so every call here is itself the notable event — always pushes. */
function moveWalk_(row, plan, settings) {
  var cal = CalendarApp.getDefaultCalendar();
  if (row.maxGcalEventId) {
    var maxEvt = resolveGcalEvent_(cal, row.maxGcalEventId);
    if (maxEvt) maxEvt.setTime(plan.windowStart, plan.windowEnd);
  }
  if (row.jazGcalEventId) {
    var jazEvt = resolveGcalEvent_(cal, row.jazGcalEventId);
    if (jazEvt) jazEvt.setTime(plan.windowStart, plan.windowEnd);
  }
  var updated = upsertDogWalkRow_({
    id: row.id, date: row.date, slot: row.slot, status: 'booked',
    windowStart: isoWithOffset_(plan.windowStart, settings.timezone),
    windowEnd: isoWithOffset_(plan.windowEnd, settings.timezone),
    durationMin: plan.durationMin, maxGcalEventId: row.maxGcalEventId, jazGcalEventId: row.jazGcalEventId,
    reason: '', notifiedAt: nowIso_()
  });
  appendLog_('system', 'dogwalk-move', updated.id, row.date + ' ' + row.slot + ' walk moved to ' + formatWindow_(plan));
  sendDogWalkPush_(row.date, row.slot, 'move', null);
  return updated;
}

/**
 * Flag (date, slot) needing a manual decision (FR-019/FR-017). Never touches an existing
 * booked walk's window/invite ids (never-cancel) — only status/reason flip. `notifiedAt`
 * guards against re-pushing the same unresolved reason every run (only a genuinely new
 * flag, or a changed reason, sends a push).
 */
function flagNeedsDecision_(existingRow, ymd, slot, reason, settings) {
  var shouldNotify = !(existingRow && existingRow.status === 'needs-decision' && existingRow.reason === reason);
  var row = upsertDogWalkRow_({
    id: existingRow ? existingRow.id : Utilities.getUuid(),
    date: ymd, slot: slot, status: 'needs-decision', reason: reason,
    windowStart: existingRow ? existingRow.windowStart : '',
    windowEnd: existingRow ? existingRow.windowEnd : '',
    durationMin: existingRow ? existingRow.durationMin : '',
    maxGcalEventId: existingRow ? existingRow.maxGcalEventId : '',
    jazGcalEventId: existingRow ? existingRow.jazGcalEventId : '',
    notifiedAt: shouldNotify ? nowIso_() : (existingRow ? existingRow.notifiedAt : '')
  });
  appendLog_('system', 'dogwalk-needs-decision', row.id, ymd + ' ' + slot + ' needs a decision (' + reason + ')');
  if (shouldNotify) sendDogWalkPush_(ymd, slot, 'needs-decision', reason);
  return row;
}

/** Best-effort push to both people (reuses Push.js; never throws) — silent on first
 *  booking per FR-020, called only from `moveWalk_`/`flagNeedsDecision_`. */
function sendDogWalkPush_(ymd, slot, kind, reason) {
  var label = slot === 'second' ? 'second dog walk' : 'dog walk';
  var text = kind === 'move'
    ? 'The ' + label + ' on ' + ymd + ' was moved (weather).'
    : ymd + ' needs a dog-walk decision (' + reason + ').';
  ['max', 'jaz'].forEach(function (person) {
    sendPushToPerson_(person, ymd, text, {
      title: 'Household HQ', body: text, url: '?dogwalk=' + ymd, tag: 'dogwalk-' + ymd + '-' + slot
    });
  });
}

// ---------------------------------------------------------------------------
// Run-loop state machine (research R10)
// ---------------------------------------------------------------------------

/** FR-018: a row whose stored window has already started is frozen — never re-evaluated,
 *  moved, or flagged. */
function isFrozen_(row) {
  if (!row || !row.windowStart) return false;
  if (row.status !== 'booked' && row.status !== 'needs-decision') return false;
  var start = parseIsoWithOffset_(row.windowStart);
  return !!start && start.getTime() <= Date.now();
}

/** The day's own already-booked window, to union back as free (research R2/R3) — only
 *  meaningful for a `booked` row with a real window. */
function ownWindowOf_(row) {
  if (!row || row.status !== 'booked' || !row.windowStart || !row.windowEnd) return null;
  var s = parseIsoWithOffset_(row.windowStart), e = parseIsoWithOffset_(row.windowEnd);
  return (s && e) ? { start: s, end: e } : null;
}

function sameWindow_(plan, existingRow) {
  var existingStart = parseIsoWithOffset_(existingRow.windowStart);
  var existingEnd = parseIsoWithOffset_(existingRow.windowEnd);
  return !!existingStart && !!existingEnd &&
    plan.windowStart.getTime() === existingStart.getTime() &&
    plan.windowEnd.getTime() === existingEnd.getTime();
}

/**
 * The full per-(day,slot) state machine (research R10): calendar-unreadable fail-safe,
 * still-eligible no-op, move, book/suggest, or flag needs-decision. Returns the window
 * actually in force after this call (Date-based `{windowStart, windowEnd, durationMin}`),
 * or `null` if nothing is in force (unreadable / no eligible window and none previously
 * booked) — used by the caller to decide whether a second walk applies.
 */
function resolveSlot_(ymd, slot, existingRow, plan, avail, settings) {
  if (avail === null) {
    flagNeedsDecision_(existingRow, ymd, slot, 'calendar-unreadable', settings);
    return null;
  }

  if (existingRow && existingRow.status === 'booked') {
    if (plan && sameWindow_(plan, existingRow)) {
      return {
        windowStart: parseIsoWithOffset_(existingRow.windowStart),
        windowEnd: parseIsoWithOffset_(existingRow.windowEnd),
        durationMin: Number(existingRow.durationMin)
      };
    }
    if (plan) {
      moveWalk_(existingRow, plan, settings);
      return plan;
    }
    flagNeedsDecision_(existingRow, ymd, slot, 'forecast-turned-bad', settings);
    // Never-cancel: the walk stays exactly where it was — still "in force" for the
    // second-walk trigger's purposes.
    return {
      windowStart: parseIsoWithOffset_(existingRow.windowStart),
      windowEnd: parseIsoWithOffset_(existingRow.windowEnd),
      durationMin: Number(existingRow.durationMin)
    };
  }

  if (!plan) {
    var reason = avail.length === 0 ? 'no-mutual-free' : 'no-good-weather';
    flagNeedsDecision_(existingRow, ymd, slot, reason, settings);
    return null;
  }

  bookOrReconcileWalk_(existingRow, { ymd: ymd, slot: slot, windowStart: plan.windowStart, windowEnd: plan.windowEnd, durationMin: plan.durationMin }, settings);
  return plan;
}

/** One in-range weekday: resolve the primary slot, then (only when a primary is in force)
 *  the second slot per FR-009. An existing second row is only touched when a primary is in
 *  force this run — never cancelled outright, just left as-is otherwise. */
function processDogWalkDay_(ymd, rows, sourceEvents, forecast, settings) {
  var primaryRow = findRow_(rows, ymd, 'primary');
  if (isFrozen_(primaryRow)) return;

  var primaryAvail = computeAvailability_(sourceEvents, ymd, settings, ownWindowOf_(primaryRow));
  var primaryPlan = primaryAvail === null ? null : selectWindow_(primaryAvail, forecast, settings.durationsMin, settings);
  var primaryEffective = resolveSlot_(ymd, 'primary', primaryRow, primaryPlan, primaryAvail, settings);

  var secondRow = findRow_(rows, ymd, 'second');
  if (isFrozen_(secondRow)) return;
  if (!primaryEffective) return;

  var secondAvail = computeAvailability_(sourceEvents, ymd, settings, ownWindowOf_(secondRow));
  var secondPlan = secondAvail === null ? null : secondWalkPlan_(primaryEffective, secondAvail, forecast, settings);
  if (!secondPlan && !secondRow) return; // FR-009: no trigger/no window and never booked -> skip silently
  resolveSlot_(ymd, 'second', secondRow, secondPlan, secondAvail, settings);
}

/**
 * Trigger handler / editor-runnable entry point (no trailing underscore — CLAUDE.md).
 * Reads Settings + the DogWalks ledger once, fetches each source calendar's events for the
 * whole horizon once, fetches Open-Meteo once, then plans every in-range weekday. Safe to
 * re-run (idempotent) and safe under overlapping runs (writes are `withLock_`-wrapped).
 * A day's failure is isolated so it can't abort the rest (mirrors syncCalendar/
 * generateRecurringTasks — Apps Script triggers get no user to report an error to).
 */
function runDogWalkFinder() {
  var settings = readDogWalkSettings_();
  var forecast = fetchForecast_(settings);
  if (!forecast) {
    Logger.log('runDogWalkFinder: forecast unavailable after retries; deferring all days this run (see fetchForecast_ log above for the specific reason).');
    return;
  }

  var today = todayYmd_();
  var horizonEnd = addDays_(today, settings.reliableDays);
  var rangeStart = walkDateTime_(today, '00:00');
  var rangeEnd = walkDateTime_(addDays_(horizonEnd, 1), '00:00');
  var sourceEvents = fetchAllSourceEvents_(settings, rangeStart, rangeEnd);
  var rows = readDogWalkRows_();

  for (var offset = 0; offset <= settings.reliableDays; offset++) {
    var ymd = addDays_(today, offset);
    var dow = walkDateTime_(ymd, '12:00').getDay(); // 0=Sun..6=Sat; noon avoids DST-edge ambiguity
    if (dow === 0 || dow === 6) continue; // FR-005: weekends out of scope entirely
    try {
      processDogWalkDay_(ymd, rows, sourceEvents, forecast, settings);
    } catch (err) {
      console.error('runDogWalkFinder: day ' + ymd + ' failed: ' + (err && err.stack ? err.stack : err));
    }
  }
  // Weekdays from horizonEnd to today+outerDays are deferred silently (research R6) —
  // simply never reached by this loop until they slide within reliableDays on a later run.
}

/**
 * Install the single nightly trigger for `runDogWalkFinder`. Idempotent: removes any
 * existing trigger for the same handler first. Run manually from the Apps Script editor
 * after deploy (mirrors `installCalendarTrigger`/`installRecurringTrigger`).
 */
function installDogWalkTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runDogWalkFinder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runDogWalkFinder')
    .timeBased()
    .atHour(DOG_WALK_TRIGGER_HOUR)
    .everyDays(1)
    .create();
  Logger.log('installDogWalkTrigger: nightly trigger installed at hour ' + DOG_WALK_TRIGGER_HOUR);
}

// ---------------------------------------------------------------------------
// Setup diagnostic (editor-runnable) — confirm each configured calendar actually reads
// ---------------------------------------------------------------------------

/**
 * Read-only setup checker (no trailing underscore — editor-runnable). For each configured
 * source calendar (`maxWorkCalId`, `jazWorkCalId`, Household) it reads the next 7 days and
 * logs whether it resolved, the event count, how many are all-day, and a few sample
 * titles/times — so calendar-id typos, free/busy-only readability, and all-day noise are all
 * visible before the first real `runDogWalkFinder()`. Writes nothing; safe to run anytime.
 */
function checkDogWalkCalendars() {
  var settings = readDogWalkSettings_();
  var rangeStart = walkDateTime_(todayYmd_(), '00:00');
  var rangeEnd = walkDateTime_(addDays_(todayYmd_(), 7), '00:00');
  var tz = settings.timezone;

  [['maxWorkCalId', settings.maxWorkCalId], ['jazWorkCalId', settings.jazWorkCalId]].forEach(function (pair) {
    var label = pair[0], id = pair[1];
    if (id === '') { Logger.log(label + ': (blank — not configured)'); return; }
    var events = fetchWorkCalEvents_(id, rangeStart, rangeEnd);
    if (events === null) {
      Logger.log(label + ' = "' + id + '": UNREADABLE (getCalendarById returned null or threw) — ' +
        'every in-range day would flag calendar-unreadable. Fix the id or the sharing access.');
      return;
    }
    logCalendarSample_(label + ' = "' + id + '"', events, tz);
  });

  var household = fetchHouseholdEvents_(rangeStart, rangeEnd);
  logCalendarSample_('Household calendar', household, tz);
  Logger.log('checkDogWalkCalendars: done (read-only; the finder wrote nothing).');
}

/** Log a one-source summary for `checkDogWalkCalendars` — count, all-day count, samples. */
function logCalendarSample_(label, events, tz) {
  var allDay = events.filter(function (e) { return e.allDay; }).length;
  Logger.log(label + ': READABLE — ' + events.length + ' event(s) in the next 7 days, ' +
    allDay + ' all-day.');
  events.slice(0, 8).forEach(function (e) {
    var when = e.allDay ? '(all-day)'
      : Utilities.formatDate(e.start, tz, 'EEE HH:mm') + '-' + Utilities.formatDate(e.end, tz, 'HH:mm');
    Logger.log('   • "' + (e.title || '(no title)') + '" ' + when);
  });
}

// ---------------------------------------------------------------------------
// Reader (contracts/dogwalks-api.md — dogwalks.list)
// ---------------------------------------------------------------------------

/** Today-forward DogWalks rows shaped to the `dogwalks.list` response type. */
function listUpcomingDogWalks_() {
  var today = todayYmd_();
  return readDogWalkRows_()
    .filter(function (r) { return r.date >= today; })
    .sort(function (a, b) { return a.date === b.date ? String(a.slot).localeCompare(b.slot) : a.date.localeCompare(b.date); })
    .map(function (r) {
      return {
        id: r.id, date: r.date, slot: r.slot, status: r.status,
        windowStart: r.windowStart || null, windowEnd: r.windowEnd || null,
        durationMin: r.durationMin ? Number(r.durationMin) : null,
        reason: r.reason || null
      };
    });
}
