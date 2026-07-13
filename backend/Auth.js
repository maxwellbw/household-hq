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

// Household session tokens (feature 018 rev. 2026-07-12). GIS silent re-auth proved
// unreliable in the field (iOS Safari ITP, Chrome FedCM declines), so after the first
// Google sign-in the backend mints its own HMAC-signed, 30-day token; `auth.whoami`
// re-mints on every call, giving a sliding window. The token carries only email +
// display name — the allowlist is still resolved live on every request, so removing
// an email locks that person out immediately. Rotating the SESSION_SECRET script
// property invalidates every outstanding session at once.
var SESSION_TOKEN_PREFIX = 'hqs1';
var SESSION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, renewed on each whoami
var SESSION_SECRET_PROP = 'SESSION_SECRET';

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

/** The signing secret from Script Properties, auto-created on first use. */
function sessionSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty(SESSION_SECRET_PROP);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(SESSION_SECRET_PROP, secret);
  }
  return secret;
}

/** URL-safe base64 without padding (token must survive JSON + URL contexts). */
function b64Url_(data) {
  return Utilities.base64EncodeWebSafe(data).replace(/=+$/, '');
}

function signSessionPayload_(payloadB64, secret) {
  return b64Url_(Utilities.computeHmacSha256Signature(SESSION_TOKEN_PREFIX + '.' + payloadB64, secret));
}

/** Mint `hqs1.<base64url payload>.<base64url hmac>` expiring TTL from now. */
function mintSessionToken_(email, displayName) {
  var payloadB64 = b64Url_(JSON.stringify({
    e: String(email || '').trim().toLowerCase(),
    n: String(displayName || ''),
    x: Date.now() + SESSION_TOKEN_TTL_MS
  }));
  return SESSION_TOKEN_PREFIX + '.' + payloadB64 + '.' + signSessionPayload_(payloadB64, sessionSecret_());
}

function isSessionToken_(token) {
  return String(token).indexOf(SESSION_TOKEN_PREFIX + '.') === 0;
}

/**
 * Verify a household session token and return tokeninfo-shaped claims so the
 * caller flows through the same resolveIdentity_ path as a Google ID token.
 * Tampering/garbage → INVALID_CREDENTIAL; a genuine expiry → UNAUTHENTICATED
 * (both send the client back to the sign-in wall, never a loop).
 */
function verifySessionToken_(token, secret) {
  var parts = String(token).split('.');
  if (parts.length !== 3 || parts[2] !== signSessionPayload_(parts[1], secret)) {
    authReject_('INVALID_CREDENTIAL', 'Session is not valid. Please sign in again.');
  }
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  } catch (e) {
    authReject_('INVALID_CREDENTIAL', 'Session is not valid. Please sign in again.');
  }
  if (!payload || !payload.e) {
    authReject_('INVALID_CREDENTIAL', 'Session is not valid. Please sign in again.');
  }
  if (!(Number(payload.x) > Date.now())) {
    authReject_('UNAUTHENTICATED', 'Session expired. Please sign in again.', payload.e);
  }
  return { email: payload.e, name: payload.n || '', email_verified: 'true' };
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
  var trimmed = String(token).trim();
  var claims = isSessionToken_(trimmed)
    ? verifySessionToken_(trimmed, sessionSecret_())
    : verifyIdToken_(trimmed);
  var identity = resolveIdentity_(claims);
  identity.actor = resolveWriteActor_(identity, action, payload);
  return identity;
}

/**
 * auth.whoami payload (FR-009): who the caller is, and whether the client must ask
 * "Max or Jaz?". Always includes a freshly minted session token (018 rev.) — the client
 * calls whoami on every boot, so each visit slides the 30-day window forward.
 */
function whoami_(identity) {
  return {
    identity: identity.identity,
    displayName: identity.displayName,
    email: identity.email,
    needsActingPerson: identity.identity === 'shared',
    sessionToken: mintSessionToken_(identity.email, identity.displayName)
  };
}
