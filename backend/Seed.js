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
 *
 * Feature 027 adds three sibling seed functions — `seedLists()`, `seedTemplates()`,
 * `seedEvents()` — for the household's real shopping lists, birthdays/anniversaries, and
 * prep checklists, structurally mirroring `seedRecurringPack()` (own pack, own seedKey, own
 * Settings applied ledger). `seedHousehold()` below runs all four in one editor call.
 */

/**
 * Anchor rules referenced by the seed packs (Config.js) — see data-model.md for the full
 * table. Feature 027 adds two regex-parsed forms: `today+Nmo` (N calendar months out —
 * used to stagger the six-month cleans into distinct months) and `monthday-MM-DD` (the
 * next occurrence of that month/day on or after today — reuses `nextMonthDayOnOrAfter_`,
 * same as the existing `fall-*` rules, for birthdays and fixed-date yearly tasks).
 */
function computeSeedAnchor_(anchorRule, today) {
  var monthsOut = /^today\+(\d+)mo$/.exec(anchorRule);
  if (monthsOut) return addMonthsClamped_(today, +monthsOut[1]);
  var monthDay = /^monthday-(\d{2})-(\d{2})$/.exec(anchorRule);
  if (monthDay) return nextMonthDayOnOrAfter_(today, +monthDay[1], +monthDay[2]);
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

/**
 * Seed the household's real shopping lists + items (feature 027, docs/seed-data.md §1).
 * Same idempotency shape as `seedRecurringPack()` (per-item seedKey + Settings ledger), but
 * writes two related tabs: lists first (so newly-created ids are available for their
 * items), then items resolved by `listSeedKey`. Bypasses `createList_`/`createListItem_` —
 * those enforce rules meant for user-initiated adds (e.g. new items always start "need",
 * name-based reuse-and-flip) that a one-time historical load must not apply (research R1).
 *
 * @param {Object} [pack] Defaults to the real `LIST_SEED_PACK`. SelfTest passes a small
 *   isolated pack (own `lists`/`items`) so it can exercise this mechanism without
 *   permanently seeding the production lists.
 */
function seedLists(pack) {
  pack = pack || LIST_SEED_PACK;
  var applied = parseAppliedKeys_(readSettingsMap_()['listSeedApplied']);
  listRecords_(TABS.LISTS).forEach(function (l) {
    var key = String(l.seedKey || '').trim();
    if (key !== '') applied[key] = true;
  });
  listRecords_(TABS.LIST_ITEMS).forEach(function (i) {
    var key = String(i.seedKey || '').trim();
    if (key !== '') applied[key] = true;
  });

  var listIdBySeedKey = {};
  listRecords_(TABS.LISTS).forEach(function (l) {
    var key = String(l.seedKey || '').trim();
    if (key !== '') listIdBySeedKey[key] = l.id;
  });

  var addedCount = 0;
  var skippedCount = 0;
  var newlyApplied = [];

  pack.lists.forEach(function (list) {
    if (applied[list.seedKey]) { skippedCount++; return; }
    try {
      var rec = createRecord_(TABS.LISTS, { name: list.name, seedKey: list.seedKey }, 'system');
      listIdBySeedKey[list.seedKey] = rec.id;
      newlyApplied.push(list.seedKey);
      addedCount++;
    } catch (err) {
      console.error('seedLists: list "' + list.seedKey + '" failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  pack.items.forEach(function (item) {
    if (applied[item.seedKey]) { skippedCount++; return; }
    var listId = listIdBySeedKey[item.listSeedKey];
    if (!listId) {
      console.error('seedLists: item "' + item.seedKey + '" references unknown list "' +
        item.listSeedKey + '" (its list may have been hand-deleted); skipped.');
      return;
    }
    try {
      createRecord_(TABS.LIST_ITEMS, {
        listId: listId, name: item.name, status: item.status,
        section: item.section || '', staple: item.staple || 'FALSE', note: '',
        seedKey: item.seedKey
      }, 'system');
      newlyApplied.push(item.seedKey);
      addedCount++;
    } catch (err) {
      console.error('seedLists: item "' + item.seedKey + '" failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  if (newlyApplied.length > 0) {
    newlyApplied.forEach(function (key) { applied[key] = true; });
    setSettingValue_('listSeedApplied', serializeAppliedKeys_(applied));
    Logger.log('seedLists: added ' + addedCount + ', skipped ' + skippedCount + '.');
  } else {
    Logger.log('seedLists: already seeded, no changes (skipped ' + skippedCount + ').');
  }
}

/**
 * Seed the household's real birthdays + anniversaries (feature 027, docs/seed-data.md
 * §2-§3) as RecurringEvents rules. Same idempotency shape as `seedRecurringPack()`. Each
 * pack entry carries either a literal historical `anchorDate` (anniversaries, so the
 * ordinal base year is correct) or an `anchorRule` resolved via `computeSeedAnchor_` the
 * same way SEED_PACK's chores are (birthdays' `monthday-MM-DD` — the next future
 * occurrence). Bypasses `createRecurringEvent_`'s validation/field-shape rules, mirroring
 * `seedRecurringPack()`'s direct-write approach (research R1).
 *
 * @param {Array} [pack] Defaults to the real `EVENT_SEED_PACK`.
 */
function seedEvents(pack) {
  pack = pack || EVENT_SEED_PACK;
  var today = Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
  var applied = parseAppliedKeys_(readSettingsMap_()['eventSeedApplied']);
  listRecords_(TABS.RECURRING_EVENTS).forEach(function (r) {
    var key = String(r.seedKey || '').trim();
    if (key !== '') applied[key] = true;
  });

  var addedCount = 0;
  var skippedCount = 0;
  var newlyApplied = [];

  pack.forEach(function (rule) {
    if (applied[rule.seedKey]) { skippedCount++; return; }
    try {
      var anchorDate = rule.anchorDate || computeSeedAnchor_(rule.anchorRule, today);
      createRecord_(TABS.RECURRING_EVENTS, {
        title: rule.title,
        cadence: rule.cadence,
        anchorDate: anchorDate,
        defaultOwner: rule.defaultOwner,
        templateId: rule.templateId || '',
        lastGenerated: '',
        seedKey: rule.seedKey
      }, 'system');
      newlyApplied.push(rule.seedKey);
      addedCount++;
    } catch (err) {
      console.error('seedEvents: rule "' + rule.seedKey + '" failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  if (newlyApplied.length > 0) {
    newlyApplied.forEach(function (key) { applied[key] = true; });
    setSettingValue_('eventSeedApplied', serializeAppliedKeys_(applied));
    Logger.log('seedEvents: added ' + addedCount + ', skipped ' + skippedCount + '.');
  } else {
    Logger.log('seedEvents: already seeded, no changes (skipped ' + skippedCount + ').');
  }
}

/**
 * Seed the household's real prep-checklist rows (feature 027, docs/seed-data.md §2 prep +
 * §8) as TaskTemplates. Same idempotency shape as the other seed functions. Covers both
 * the eight per-birthday single-row eventTypes (matched by `templateId` on an
 * EVENT_SEED_PACK birthday row — research R6) and the multi-row `guests-arriving` /
 * `leaving-trip` eventTypes attached to one-off events by hand.
 *
 * @param {Array} [pack] Defaults to the real `TEMPLATE_SEED_PACK`.
 */
function seedTemplates(pack) {
  pack = pack || TEMPLATE_SEED_PACK;
  var applied = parseAppliedKeys_(readSettingsMap_()['templateSeedApplied']);
  listRecords_(TABS.TEMPLATES).forEach(function (t) {
    var key = String(t.seedKey || '').trim();
    if (key !== '') applied[key] = true;
  });

  var addedCount = 0;
  var skippedCount = 0;
  var newlyApplied = [];

  pack.forEach(function (step) {
    if (applied[step.seedKey]) { skippedCount++; return; }
    try {
      createRecord_(TABS.TEMPLATES, {
        eventType: step.eventType,
        taskTitle: step.taskTitle,
        offsetDays: step.offsetDays,
        defaultOwner: step.defaultOwner,
        seedKey: step.seedKey
      }, 'system');
      newlyApplied.push(step.seedKey);
      addedCount++;
    } catch (err) {
      console.error('seedTemplates: step "' + step.seedKey + '" failed: ' +
        (err && err.stack ? err.stack : err));
    }
  });

  if (newlyApplied.length > 0) {
    newlyApplied.forEach(function (key) { applied[key] = true; });
    setSettingValue_('templateSeedApplied', serializeAppliedKeys_(applied));
    Logger.log('seedTemplates: added ' + addedCount + ', skipped ' + skippedCount + '.');
  } else {
    Logger.log('seedTemplates: already seeded, no changes (skipped ' + skippedCount + ').');
  }
}

/**
 * Run every feature-027 seed pack in one editor call: lists, then templates, then events
 * (templates before events is tidy — birthday events reference their template's eventType
 * — though not required, since prep generation tolerates a missing template and self-heals
 * once it exists), then the recurring-task pack last. Each function is independently
 * idempotent and safe to re-run on its own; this is purely a convenience wrapper.
 */
function seedHousehold() {
  seedLists();
  seedTemplates();
  seedEvents();
  seedRecurringPack();
  Logger.log('seedHousehold: done.');
}
