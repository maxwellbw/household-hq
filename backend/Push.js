/**
 * Push.js — web push (feature 010). Replaces Ntfy.js (feature 009): the same two
 * completion/acknowledge events now deliver a native, closed-app push instead of an
 * ntfy.sh ping. Web push fully replaces ntfy per the feature's clarify — there is no
 * fallback channel, so a recipient with no enabled device gets nothing for that event.
 *
 * Subscription store: subscribeDevice_ (endpoint-keyed upsert), unsubscribeDevice_,
 *   listSubscriptionsForPerson_, prunePushSubscription_.
 * Config:              pushConfig_ (vapidPublicKey + pushEnabled for the client).
 * Message builders:    buildCompletionMessage_, buildAcknowledgeMessage_ (text byte-identical
 *                       to the retired ntfy strings).
 * Send:                sendWebPush_ (one subscription), pushCompletion_/pushAcknowledge_
 *                       (fan out to a recipient's devices; gate on pushEnabled; never throw).
 */

var PUSH_MAX_TITLE_LEN = 120;

// ---------------------------------------------------------------------------
// Config (push.config)
// ---------------------------------------------------------------------------

function pushConfig_() {
  var settings = readSettingsMap_();
  var vapidPublicKey = String(settings.vapidPublicKey || '').trim();
  return {
    vapidPublicKey: vapidPublicKey,
    pushEnabled: isEnabled_(settings, 'pushEnabled')
  };
}

// ---------------------------------------------------------------------------
// Subscription store (push.subscribe / push.unsubscribe) — research R8
// ---------------------------------------------------------------------------

/** Approximate device label from a User-Agent string, e.g. "iPhone Safari", "Mac Chrome". */
function deriveDeviceLabelFromUa_(ua) {
  ua = String(ua || '');
  var platform = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : 'Device';
  var browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /CriOS\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  return platform + ' ' + browser;
}

function findSubscriptionByEndpoint_(t, endpoint) {
  for (var i = 0; i < t.records.length; i++) {
    if (t.records[i].endpoint === endpoint) return t.records[i];
  }
  return null;
}

/**
 * Upsert the calling device's subscription (endpoint-keyed, idempotent — research R8).
 * `person` is always the verified `actor`, never client-supplied.
 */
function subscribeDevice_(payload, actor) {
  requireFields_(payload, ['endpoint', 'p256dh', 'auth']);
  var endpoint = String(payload.endpoint).trim();
  var p256dh = String(payload.p256dh).trim();
  var auth = String(payload.auth).trim();
  var deviceLabel = String(payload.deviceLabel || '').trim() || 'Device';
  if (endpoint === '' || p256dh === '' || auth === '') {
    fail_('VALIDATION_FAILED', 'endpoint, p256dh, and auth are all required.', 'endpoint');
  }

  return withLock_(function () {
    var t = readTableForWrite_(TABS.PUSH_SUBSCRIPTIONS);
    var existing = findSubscriptionByEndpoint_(t, endpoint);
    var now = nowIso_();
    if (existing) {
      var merged = stripInternal_(existing);
      merged.person = actor;
      merged.p256dh = p256dh;
      merged.auth = auth;
      merged.deviceLabel = deviceLabel;
      merged.lastUsedAt = now;
      writeRowAsText_(t.sheet, existing._row, buildRowArray_(t, merged, t.values[existing._row - 1]));
      appendLog_(actor, 'push-subscribe', merged.id, 'refreshed ' + deviceLabel);
      return { subscribed: true, deviceLabel: deviceLabel };
    }
    var rec = {
      id: Utilities.getUuid(), person: actor, endpoint: endpoint, p256dh: p256dh, auth: auth,
      deviceLabel: deviceLabel, createdAt: now, lastUsedAt: now
    };
    writeRowAsText_(t.sheet, t.sheet.getLastRow() + 1, buildRowArray_(t, rec, null));
    appendLog_(actor, 'push-subscribe', rec.id, 'enabled ' + deviceLabel);
    return { subscribed: true, deviceLabel: deviceLabel };
  });
}

/** Remove the calling device's subscription. No-op (still ok:true) if it's already gone. */
function unsubscribeDevice_(payload) {
  requireFields_(payload, ['endpoint']);
  var endpoint = String(payload.endpoint).trim();
  return withLock_(function () {
    var t = readTableForWrite_(TABS.PUSH_SUBSCRIPTIONS);
    var existing = findSubscriptionByEndpoint_(t, endpoint);
    if (existing) {
      t.sheet.deleteRow(existing._row);
      appendLog_(existing.person, 'push-unsubscribe', existing.id, 'disabled ' + (existing.deviceLabel || ''));
    }
    return { unsubscribed: true };
  });
}

function listSubscriptionsForPerson_(person) {
  return listRecords_(TABS.PUSH_SUBSCRIPTIONS).filter(function (s) { return s.person === person; });
}

/** Remove a dead subscription (404/410 from the push service) after a send attempt. */
function prunePushSubscription_(id) {
  withLock_(function () {
    var t = readTableForWrite_(TABS.PUSH_SUBSCRIPTIONS);
    var rec = findRecord_(t, id);
    if (!rec) return; // already gone
    t.sheet.deleteRow(rec._row);
    appendLog_('system', 'push-notify', id, 'pruned dead device (' + (rec.deviceLabel || '') + ')');
  });
}

// ---------------------------------------------------------------------------
// Message builders (byte-identical to the retired ntfy strings — FR-015)
// ---------------------------------------------------------------------------

function otherPerson_(person) {
  return person === 'max' ? 'jaz' : 'max';
}

function truncateTitle_(title) {
  var t = String(title || '').trim();
  if (t.length > PUSH_MAX_TITLE_LEN) t = t.slice(0, PUSH_MAX_TITLE_LEN - 1) + '…';
  return t;
}

/** `"Max completed: Take out recycling"` — same fallback rules as the retired ntfy message. */
function buildCompletionMessage_(completer, title) {
  var name = completer === 'max' ? 'Max' : 'Jaz';
  var t = truncateTitle_(title);
  return t === '' ? name + ' completed a task' : name + ' completed: ' + t;
}

/** `"Max has it: Pick up the dog"` (feature 019 US2) — same fallback rules. */
function buildAcknowledgeMessage_(assignee, title) {
  var name = assignee === 'max' ? 'Max' : 'Jaz';
  var t = truncateTitle_(title);
  return t === '' ? name + ' has it' : name + ' has it: ' + t;
}

// ---------------------------------------------------------------------------
// Send (best-effort, never throws — mirrors the retired Ntfy.js guarantee)
// ---------------------------------------------------------------------------

/**
 * Send one encrypted push to one subscription. Returns { ok, code } like the retired
 * postToNtfy_; on 404/410 (gone) the caller prunes the dead row.
 */
function sendWebPush_(sub, messageObj, vapidPublicKey, vapidPrivateKey, vapidSubject) {
  var body = encryptPayload_(JSON.stringify(messageObj), sub.p256dh, sub.auth);
  var headers = vapidHeaders_(sub.endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject);
  headers['Content-Encoding'] = 'aes128gcm';
  headers['TTL'] = '60';
  try {
    var resp = UrlFetchApp.fetch(sub.endpoint, {
      method: 'post',
      contentType: 'application/octet-stream',
      headers: headers,
      payload: body,
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    return { ok: code >= 200 && code < 300, code: code };
  } catch (e) {
    return { ok: false, code: 0, error: String(e && e.message || e) };
  }
}

/**
 * Fan out one message to every enabled device of `recipient`. Gates on the household
 * pushEnabled switch; skips (with a log line) when disabled or the recipient has no
 * devices; prunes dead subscriptions; appends exactly one summary push-notify log line.
 * Guaranteed not to throw — a caller never needs to catch anything here.
 */
function sendPushToPerson_(recipient, taskId, messageText, message) {
  try {
    var settings = readSettingsMap_();
    if (!isEnabled_(settings, 'pushEnabled')) {
      appendLog_('system', 'push-notify', taskId, 'push skipped (disabled)');
      return;
    }
    var subs = listSubscriptionsForPerson_(recipient);
    if (subs.length === 0) {
      appendLog_('system', 'push-notify', taskId, 'push skipped (no devices)');
      return;
    }
    var vapidPublicKey = String(settings.vapidPublicKey || '').trim();
    var vapidPrivateKey = String(settings.vapidPrivateKey || '').trim();
    var vapidSubject = String(settings.vapidSubject || '').trim();
    if (vapidPublicKey === '' || vapidPrivateKey === '') {
      appendLog_('system', 'push-notify', taskId, 'push skipped (VAPID not configured; run setupPush())');
      return;
    }

    var recipientName = recipient === 'max' ? 'Max' : 'Jaz';
    var sent = 0, failed = 0, pruned = 0;
    subs.forEach(function (sub) {
      var result = sendWebPush_(sub, message, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (result.ok) {
        sent++;
      } else if (result.code === 404 || result.code === 410) {
        prunePushSubscription_(sub.id);
        pruned++;
      } else {
        failed++;
      }
    });

    var detail = 'pushed ' + recipientName + ' (' + sent + '/' + subs.length + ' devices): "' + messageText + '"';
    if (pruned) detail += '; pruned ' + pruned;
    if (failed) detail += '; ' + failed + ' failed';
    appendLog_('system', 'push-notify', taskId, detail);
  } catch (e) {
    // Absolute last resort — a completion/acknowledge must never fail because of this side effect.
  }
}

/** Best-effort completion push (replaces feature 009's pingCompletion_). Never throws. */
function pushCompletion_(task, completer) {
  var recipient = otherPerson_(completer);
  var text = buildCompletionMessage_(completer, task.title);
  sendPushToPerson_(recipient, task.id, text, {
    title: 'Household HQ', body: text, url: '?task=' + task.id, tag: task.id
  });
}

/** Best-effort acknowledge push (feature 019 US2; replaces feature 009's pingAcknowledge_). */
function pushAcknowledge_(task) {
  var recipient = otherPerson_(task.owner);
  var text = buildAcknowledgeMessage_(task.owner, task.title);
  sendPushToPerson_(recipient, task.id, text, {
    title: 'Household HQ', body: text, url: '?task=' + task.id, tag: task.id
  });
}
