/**
 * Auth.js — feature 002 identity verification + allowlist (contracts/auth.md).
 *
 * doPost gates every action except the public `ping` through authenticate_(): verify the
 * caller's Google ID token, resolve the verified email against the Settings allowlist to a
 * canonical person (`max`/`jaz`), and — when the shared household account performs a
 * write — require a confirmed acting-person. No local crypto: Google's `tokeninfo`
 * endpoint does the signature/expiry/clock-skew checks (research A1/A2). Rejections are
 * logged for the maintainer (FR-013) and carry no household data (FR-013/SC-004).
 */

var TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
var GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Log a rejection (maintainer-visible only, FR-013) then throw the structured error. */
function authReject_(code, message, email) {
  console.warn('AUTH_REJECT ' + code + ' ' + (email || '-'));
  fail_(code, message);
}

/**
 * Verify a Google ID token via `tokeninfo` and return its claims, or reject with
 * INVALID_CREDENTIAL. A 200 from tokeninfo means Google validated the signature and
 * expiry; we still bind `aud` to our client, require a Google issuer, and require a
 * verified email (research A2).
 */
function verifyIdToken_(token) {
  var resp;
  try {
    resp = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(token), { muteHttpExceptions: true });
  } catch (e) {
    authReject_('INVALID_CREDENTIAL', 'Credential could not be verified.');
  }
  if (resp.getResponseCode() !== 200) {
    authReject_('INVALID_CREDENTIAL', 'Credential is invalid or expired.');
  }
  var claims;
  try {
    claims = JSON.parse(resp.getContentText());
  } catch (e) {
    authReject_('INVALID_CREDENTIAL', 'Credential is invalid.');
  }
  if (claims.aud !== OAUTH_CLIENT_ID) authReject_('INVALID_CREDENTIAL', 'Credential audience mismatch.');
  if (GOOGLE_ISSUERS.indexOf(String(claims.iss)) === -1) authReject_('INVALID_CREDENTIAL', 'Credential issuer invalid.');
  if (String(claims.email_verified) !== 'true') authReject_('INVALID_CREDENTIAL', 'Credential email not verified.');
  if (!claims.email) authReject_('INVALID_CREDENTIAL', 'Credential is missing an email.');
  return claims;
}

/**
 * The allowlist from Settings: the two personal emails and the shared account(s), each
 * trimmed and lower-cased. Any read failure surfaces as an empty list so callers fail
 * closed (FR-005).
 */
function readAllowlist_() {
  var settings;
  try {
    settings = readSettingsMap_();
  } catch (e) {
    return { maxEmail: '', jazEmail: '', shared: [] };
  }
  var lower = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var shared = lower(settings.sharedEmails).split(';')
    .map(function (e) { return e.trim(); })
    .filter(function (e) { return e !== ''; });
  return { maxEmail: lower(settings.maxEmail), jazEmail: lower(settings.jazEmail), shared: shared };
}

/** Resolve verified claims against the live Settings allowlist (see matchIdentity_). */
function resolveIdentity_(claims) {
  return matchIdentity_(claims, readAllowlist_());
}

/**
 * Pure resolver: verified claims + allowlist → { identity, actor, email, displayName }.
 * `actor` is the canonical person for personal accounts, or `null` for the shared account
 * (resolved to a person later, only on a write — A5). Fails closed on an empty allowlist
 * (ALLOWLIST_MISCONFIGURED, FR-005/SC-006) and rejects non-matching emails (FORBIDDEN,
 * FR-003). No network — unit-testable with synthetic inputs (SelfTest.js).
 */
function matchIdentity_(claims, lists) {
  var email = String(claims.email || '').trim().toLowerCase();
  var displayName = String(claims.name || '');

  if (lists.maxEmail === '' && lists.jazEmail === '' && lists.shared.length === 0) {
    authReject_('ALLOWLIST_MISCONFIGURED', 'The allowlist is not configured.', email);
  }
  if (email && email === lists.maxEmail) {
    return { identity: 'max', actor: 'max', email: email, displayName: displayName };
  }
  if (email && email === lists.jazEmail) {
    return { identity: 'jaz', actor: 'jaz', email: email, displayName: displayName };
  }
  if (email && lists.shared.indexOf(email) !== -1) {
    return { identity: 'shared', actor: null, email: email, displayName: displayName };
  }
  authReject_('FORBIDDEN', 'Not authorized.', email);
}

/**
 * Pure: settle the acting person for a resolved identity + action. Personal callers keep
 * their `actor`; a shared-account **write** requires `payload.actingPerson` ∈ {max, jaz}
 * (FR-014/A5), else ACTING_PERSON_REQUIRED. Returns the concrete `actor`.
 */
function resolveWriteActor_(identity, action, payload) {
  if (identity.identity !== 'shared' || !isWriteAction_(action)) return identity.actor;
  var ap = payload && payload.actingPerson != null ? String(payload.actingPerson).trim().toLowerCase() : '';
  if (ap !== 'max' && ap !== 'jaz') {
    authReject_('ACTING_PERSON_REQUIRED', 'Confirm Max or Jaz for this shared-account change.', identity.email);
  }
  return ap;
}

/**
 * The full gate for a non-`ping` action: require a token (FR-001), verify it, resolve the
 * identity, and settle the acting person for shared-account writes. Returns the resolved
 * identity with a concrete `actor`; throws a structured AppError_ on any rejection.
 */
function authenticate_(action, token, payload) {
  if (!token || String(token).trim() === '') authReject_('UNAUTHENTICATED', 'Sign-in required.');
  var claims = verifyIdToken_(String(token).trim());
  var identity = resolveIdentity_(claims);
  identity.actor = resolveWriteActor_(identity, action, payload);
  return identity;
}

/** auth.whoami payload (FR-009): who the caller is, and whether the client must ask "Max or Jaz?". */
function whoami_(identity) {
  return {
    identity: identity.identity,
    displayName: identity.displayName,
    email: identity.email,
    needsActingPerson: identity.identity === 'shared'
  };
}
