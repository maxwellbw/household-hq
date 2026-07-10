/**
 * Ntfy.js — instant completion pings via ntfy.sh (feature 009). When a task really
 * transitions open→done, POST a one-line push to the *other* person's private ntfy topic
 * (clarify: recipient is always the household member who did NOT complete it). Best-effort
 * only: `pingCompletion_` never throws and never affects the completion it hangs off of
 * (called from `completeTask_` in Api.js, inside the existing `if (result.changed)` guard —
 * Principle V's idempotency for free, no ledger needed).
 *
 * Pure helpers: otherPerson_, ntfyTopicFor_, buildPingMessage_ (no network, unit-testable)
 * Send:         postToNtfy_ (thin UrlFetchApp wrapper)
 * Brain:        pingCompletion_ (gate on enabled/topic, send, always log the outcome)
 */

var NTFY_MAX_TITLE_LEN = 120;

/** The household member who did NOT complete the task — always the ping recipient (FR-003). */
function otherPerson_(person) {
  return person === 'max' ? 'jaz' : 'max';
}

/** Which Settings key holds `recipient`'s private topic. */
function ntfyTopicFor_(recipient, settings) {
  var key = recipient === 'max' ? 'ntfyTopicMax' : 'ntfyTopicJaz';
  return String(settings[key] || '').trim();
}

/** `"Max completed: Take out recycling"` — with sensible empty/long-title fallbacks. */
function buildPingMessage_(completer, title) {
  var name = completer === 'max' ? 'Max' : 'Jaz';
  var t = String(title || '').trim();
  if (t === '') return name + ' completed a task';
  if (t.length > NTFY_MAX_TITLE_LEN) t = t.slice(0, NTFY_MAX_TITLE_LEN - 1) + '…';
  return name + ' completed: ' + t;
}

/** POST `message` to ntfy.sh's `topic`. Never throws — returns {ok, code} either way. */
function postToNtfy_(topic, message) {
  try {
    var resp = UrlFetchApp.fetch(NTFY_BASE_URL + '/' + encodeURIComponent(topic), {
      method: 'post',
      payload: message,
      headers: { Title: 'Household HQ', Tags: 'white_check_mark' },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    return { ok: code >= 200 && code < 300, code: code };
  } catch (e) {
    return { ok: false, code: 0, error: String(e && e.message || e) };
  }
}

/**
 * Best-effort completion ping (FR-001..FR-010). Called only when a task really transitioned
 * open→done. Gates on the on/off Settings flag and a blank recipient topic before ever
 * touching the network; every outcome (sent, skipped, failed) appends one ActivityLog row.
 * Guaranteed not to throw, so a caller never needs to catch anything here.
 */
function pingCompletion_(task, completer) {
  try {
    var settings = readSettingsMap_();
    if (!isEnabled_(settings, 'ntfyEnabled')) {
      appendLog_('system', 'ntfy-ping', task.id, 'ntfy skipped (disabled)');
      return;
    }

    var recipient = otherPerson_(completer);
    var topic = ntfyTopicFor_(recipient, settings);
    if (topic === '') {
      appendLog_('system', 'ntfy-ping', task.id, 'ntfy skipped (topic blank)');
      return;
    }

    var message = buildPingMessage_(completer, task.title);
    var result = postToNtfy_(topic, message);
    var recipientName = recipient === 'max' ? 'Max' : 'Jaz';
    if (result.ok) {
      appendLog_('system', 'ntfy-ping', task.id,
        'pinged ' + recipientName + ': "' + (task.title || '') + '"');
    } else if (result.code) {
      appendLog_('system', 'ntfy-ping', task.id, 'ntfy failed (HTTP ' + result.code + ')');
    } else {
      appendLog_('system', 'ntfy-ping', task.id, 'ntfy failed (' + (result.error || 'unknown') + ')');
    }
  } catch (e) {
    // Absolute last resort — a completion must never fail because of this side effect.
  }
}
