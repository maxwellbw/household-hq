/**
 * Lists.js — Grocery & household lists (feature 024, contracts/api-024.md).
 *
 * Two tabs, no owner field (research R2 — every list/item is implicitly shared). Reuses
 * the generic Sheets.js CRUD helpers throughout; the only bespoke logic here is the
 * reuse-and-flip create path (research R3) and the dedicated status-toggle writer
 * (research R4, mirroring setTaskLifecycle_'s already-there-yet short-circuit).
 */

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function listLists_() {
  return { lists: listRecords_(TABS.LISTS) };
}

function createList_(payload, actor) {
  rejectUnknownFields_(TABS.LISTS, payload);
  requireFields_(payload, REQUIRED_ON_CREATE.Lists);
  var rec = fullRecord_(TABS.LISTS, payload);
  return { list: createRecord_(TABS.LISTS, rec, actor) };
}

/** Deletes the list, then cascades to every ListItem row that belonged to it (mirrors
 *  deleteEvent_'s cascade to its prep Tasks — parent delete is the NOT_FOUND gate). */
function deleteList_(payload, actor) {
  requireFields_(payload, ['id']);
  var id = String(payload.id).trim();
  var result = deleteRecordById_(TABS.LISTS, id, actor);
  listRecords_(TABS.LIST_ITEMS).forEach(function (item) {
    if (item.listId === id) deleteRecordById_(TABS.LIST_ITEMS, item.id, actor);
  });
  return { id: result };
}

// ---------------------------------------------------------------------------
// List items
// ---------------------------------------------------------------------------

function listListItems_(payload) {
  var items = listRecords_(TABS.LIST_ITEMS);
  var listId = payload && payload.listId != null ? String(payload.listId).trim() : '';
  if (listId) items = items.filter(function (item) { return item.listId === listId; });
  return { items: items };
}

/**
 * Write path shared by the reuse-and-flip create case and `listItems.toggle` (research
 * R4). Inside the lock: if already at `targetStatus`, no-change (no write, no log —
 * mirrors setTaskLifecycle_). Otherwise flips `status` and logs 'list-item-need' or
 * 'list-item-stocked'.
 */
function setListItemStatus_(id, targetStatus, actor) {
  return withLock_(function () {
    var t = readTableForWrite_(TABS.LIST_ITEMS);
    var rec = findRecord_(t, id);
    if (!rec) fail_('NOT_FOUND', 'No ' + TABS.LIST_ITEMS + ' record with id "' + id + '".');
    if (rec.status === targetStatus) {
      return { item: stripInternal_(rec), changed: false };
    }
    var merged = stripInternal_(rec);
    merged.status = targetStatus;
    writeRowAsText_(t.sheet, rec._row, buildRowArray_(t, merged, t.values[rec._row - 1]));
    appendLog_(actor, targetStatus === 'need' ? 'list-item-need' : 'list-item-stocked',
      id, merged.name || '');
    return { item: merged, changed: true };
  });
}

/**
 * `listItems.create` (contracts/api-024.md, research R3): a name match (trimmed,
 * case-insensitive) against an existing item on the same list reuses and flips that row
 * to `need` instead of creating a duplicate — leaving its section/staple/note untouched.
 * Otherwise creates a new row, always starting `need` regardless of any client-supplied
 * status (mirrors createTask_ rejecting a non-`open` create status).
 */
function createListItem_(payload, actor) {
  rejectUnknownFields_(TABS.LIST_ITEMS, payload);
  requireFields_(payload, REQUIRED_ON_CREATE.ListItems);
  if (payload.hasOwnProperty('status') && String(payload.status).trim() !== '' &&
      String(payload.status).trim() !== 'need') {
    fail_('BAD_REQUEST', 'New list items always start "need"; use listItems.toggle afterwards.', 'status');
  }
  validateFields_(TABS.LIST_ITEMS, payload);

  var listId = String(payload.listId).trim();
  var listExists = listRecords_(TABS.LISTS).some(function (l) { return l.id === listId; });
  if (!listExists) fail_('NOT_FOUND', 'No ' + TABS.LISTS + ' record with id "' + listId + '".');

  var nameLower = String(payload.name).trim().toLowerCase();
  var existing = listRecords_(TABS.LIST_ITEMS).filter(function (item) {
    return item.listId === listId && String(item.name).trim().toLowerCase() === nameLower;
  })[0];
  if (existing) {
    return { item: setListItemStatus_(existing.id, 'need', actor).item };
  }

  var rec = fullRecord_(TABS.LIST_ITEMS, payload);
  rec.status = 'need';
  if (!rec.staple) rec.staple = 'FALSE';
  return { item: createRecord_(TABS.LIST_ITEMS, rec, actor) };
}

/** `listItems.update`: name/section/staple/note only — status has its own dedicated
 *  action (mirrors tasks.update rejecting lifecycle fields), and listId never changes
 *  after creation (moving an item between lists isn't a use case this feature covers). */
function updateListItem_(payload, actor) {
  rejectUnknownFields_(TABS.LIST_ITEMS, payload);
  requireFields_(payload, ['id']);
  if (payload.hasOwnProperty('status')) {
    fail_('BAD_REQUEST', 'Use listItems.toggle to change status; "status" is not editable via listItems.update.', 'status');
  }
  if (payload.hasOwnProperty('listId')) {
    fail_('BAD_REQUEST', 'listId cannot be changed via listItems.update.', 'listId');
  }
  validateFields_(TABS.LIST_ITEMS, payload);
  var patch = mutablePatch_(TABS.LIST_ITEMS, payload);
  return { item: updateRecordById_(TABS.LIST_ITEMS, String(payload.id).trim(), patch, actor) };
}

/** `listItems.toggle` (FR-005, research R4): flips need⇄stocked. No payload beyond `id` —
 *  the server determines the new value from the current one. */
function toggleListItem_(payload, actor) {
  requireFields_(payload, ['id']);
  var id = String(payload.id).trim();
  var existing = listRecords_(TABS.LIST_ITEMS).filter(function (item) { return item.id === id; })[0];
  if (!existing) fail_('NOT_FOUND', 'No ' + TABS.LIST_ITEMS + ' record with id "' + id + '".');
  var target = existing.status === 'need' ? 'stocked' : 'need';
  return setListItemStatus_(id, target, actor);
}

/** Outright removal — distinct from toggling to `stocked` (routine cycling never
 *  deletes, FR-006); used for "we don't buy that anymore." */
function deleteListItem_(payload, actor) {
  requireFields_(payload, ['id']);
  return { id: deleteRecordById_(TABS.LIST_ITEMS, String(payload.id).trim(), actor) };
}
