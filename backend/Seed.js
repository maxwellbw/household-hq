/**
 * Seed.js — one-time (re-runnable) starter pack for the recurring chore engine (feature
 * 015). `seedRecurringPack()` appends `SEED_PACK` (Config.js) as ordinary Recurring rows —
 * run manually from the Apps Script editor, like `setupDatabase()` / `installRecurringTrigger()`.
 * Not an API action, not a trigger handler.
 *
 * Identity is a per-chore `seedKey`, not title (research R2): a chore is "already applied"
 * if its key is in the `recurringSeedApplied` Settings ledger OR is the `seedKey` of a live
 * Recurring row. The ledger is what makes deletion permanent — once a key is applied it
 * stays in the ledger even after its row is hand-deleted, so a re-run never resurrects it.
 * Household edits (including a rename) are preserved because matching never looks at title.
 *
 * Each newly-seeded row goes through the existing `createRecord_` (locked, UUID id), which
 * already appends its own `create` ActivityLog row — the same mechanism the recurring
 * generator uses per occurrence (Recurring.js). A no-op run makes no writes and logs nothing.
 */

/** Anchor rules referenced by SEED_PACK (Config.js) — see data-model.md for the full table. */
function computeSeedAnchor_(anchorRule, today) {
  switch (anchorRule) {
    case 'today': return today;
    case 'today+7': return addDays_(today, 7);
    case 'fall-oct15': return nextMonthDayOnOrAfter_(today, 10, 15);
    case 'fall-nov1': return nextMonthDayOnOrAfter_(today, 11, 1);
    default:
      fail_('VALIDATION_FAILED', 'seedRecurringPack: unknown anchorRule "' + anchorRule + '".');
  }
}

/** The next YYYY-MM-DD occurrence of `month`/`day` on or after `today` (this year, else next). */
function nextMonthDayOnOrAfter_(today, month, day) {
  var year = +today.substring(0, 4);
  var candidate = ymd_(year, month, day);
  return candidate >= today ? candidate : ymd_(year + 1, month, day);
}

/** `; `-delimited ledger string -> a { key: true } set. Blank/whitespace entries dropped. */
function parseAppliedKeys_(value) {
  var out = {};
  String(value || '').split(';').forEach(function (part) {
    var key = part.trim();
    if (key !== '') out[key] = true;
  });
  return out;
}

/** A { key: true } set -> a stable, sorted `; `-delimited ledger string. */
function serializeAppliedKeys_(set) {
  return Object.keys(set).sort().join('; ');
}

/**
 * Append any pack chore not yet applied. Idempotent (Principle V): identity is the seed
 * key, so re-runs, hand-edits, and hand-deletions never produce a duplicate or a
 * resurrection. A chore whose creation fails is logged and skipped without aborting the rest
 * (mirrors `generateRecurringTasks`'s per-rule isolation).
 *
 * @param {Array} [pack] Defaults to the real `SEED_PACK`. SelfTest passes a small isolated
 *   pack so it can exercise this exact mechanism against the shared `recurringSeedApplied`
 *   ledger without permanently seeding production chores as a side effect of testing.
 */
function seedRecurringPack(pack) {
  pack = pack || SEED_PACK;
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var existingRules = listRecords_(TABS.RECURRING);
  var applied = parseAppliedKeys_(readSettingsMap_()['recurringSeedApplied']);
  existingRules.forEach(function (r) {
    var key = String(r.seedKey || '').trim();
    if (key !== '') applied[key] = true;
  });

  var addedCount = 0;
  var skippedCount = 0;
  var newlyApplied = [];

  pack.forEach(function (chore) {
    if (applied[chore.seedKey]) { skippedCount++; return; }
    try {
      var rec = {
        title: chore.title,
        cadence: chore.cadence,
        anchorDate: computeSeedAnchor_(chore.anchorRule, today),
        defaultOwner: chore.defaultOwner,
        lastGenerated: '',
        seedKey: chore.seedKey
      };
      if (chore.seasonStart != null) rec.seasonStart = chore.seasonStart;
      if (chore.seasonEnd != null) rec.seasonEnd = chore.seasonEnd;
      createRecord_(TABS.RECURRING, rec, 'system');
      newlyApplied.push(chore.seedKey);
      addedCount++;
    } catch (err) {
      console.error('seedRecurringPack: chore "' + chore.seedKey + '" failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  if (newlyApplied.length > 0) {
    newlyApplied.forEach(function (key) { applied[key] = true; });
    setSettingValue_('recurringSeedApplied', serializeAppliedKeys_(applied));
    Logger.log('seedRecurringPack: added ' + addedCount + ', skipped ' + skippedCount + '.');
  } else {
    Logger.log('seedRecurringPack: already seeded, no changes (skipped ' + skippedCount + ').');
  }
}
