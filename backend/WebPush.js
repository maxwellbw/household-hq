/**
 * WebPush.js — the only file that calls into the vendored Sjcl.js (feature 010).
 * Implements exactly two RFCs, nothing more:
 *   - RFC 8292 (VAPID): ES256-signed JWT + `Authorization: vapid t=…,k=…` header.
 *   - RFC 8291 (Web Push encryption) over RFC 8188 (aes128gcm single-record framing).
 *
 * Apps Script has no window/document, so SJCL's random.js DOM entropy collectors are
 * never invoked; seedEntropy_ feeds real randomness (Utilities.getUuid()) into
 * sjcl.random before every operation that needs it, at SJCL_PARANOIA (6 ⇒ 256 bits
 * required) so a seeding bug throws sjcl.exception.notReady instead of silently
 * producing weak keys/nonces.
 *
 * Byte-exact correctness is proven against the RFC 8291 §5 published test vector in
 * SelfTest.js's selfTestPush(), via the {salt, serverPrivate} test-injection point on
 * encryptPayload_.
 */

var SJCL_PARANOIA = 6; // sjcl.random.isReady(6) requires >=256 bits of seeded entropy
var WEBPUSH_CURVE = sjcl.ecc.curves.c256;
var WEBPUSH_RECORD_SIZE = 4096; // rs; single-record messages, matches the RFC 8291 vector

// ---------------------------------------------------------------------------
// Entropy (Apps Script has no window/document — see file header)
// ---------------------------------------------------------------------------

/** Seed sjcl.random with real randomness from Utilities.getUuid(). Safe to call often. */
function seedEntropy_() {
  for (var i = 0; i < 4; i++) {
    var hex = Utilities.getUuid().replace(/-/g, '');
    sjcl.random.addEntropy(sjcl.codec.hex.toBits(hex), 120, 'apps-script-uuid');
  }
}

// ---------------------------------------------------------------------------
// Byte array <-> sjcl bitArray (Apps Script/UrlFetchApp speak byte arrays)
// ---------------------------------------------------------------------------

function bitsToBytes_(bits) {
  var hex = sjcl.codec.hex.fromBits(bits);
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  return bytes;
}

function bytesToBits_(bytes) {
  var hex = bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  return sjcl.codec.hex.toBits(hex);
}

// ---------------------------------------------------------------------------
// Raw uncompressed EC point (0x04 || X || Y, 65 bytes for P-256) <-> sjcl objects
// ---------------------------------------------------------------------------

/** An elGamal/ecdsa public key's raw SEC1 uncompressed-point bits (520 bits, 65 bytes). */
function publicKeyToRawBits_(pub) {
  return sjcl.bitArray.concat([sjcl.bitArray.partial(8, 0x04)], pub._point.toBits());
}

/** Parse a subscription's base64url p256dh (65 raw bytes) into an elGamal public key. */
function parseP256dh_(p256dhB64url) {
  var full = sjcl.codec.base64url.toBits(p256dhB64url);
  var xy = sjcl.bitArray.bitSlice(full, 8); // drop the 0x04 tag byte
  var point = WEBPUSH_CURVE.fromBits(xy);
  return new sjcl.ecc.elGamal.publicKey(WEBPUSH_CURVE, point);
}

// ---------------------------------------------------------------------------
// VAPID keygen (R2) — run once by setupPush(); WebPush.js never rotates keys itself.
// ---------------------------------------------------------------------------

/** { publicKey, privateKey } as base64url strings (raw point / raw scalar). */
function generateVapidKeys_() {
  seedEntropy_();
  var kp = sjcl.ecc.ecdsa.generateKeys(WEBPUSH_CURVE, SJCL_PARANOIA);
  return {
    publicKey: sjcl.codec.base64url.fromBits(publicKeyToRawBits_(kp.pub)),
    privateKey: sjcl.codec.base64url.fromBits(kp.sec.get())
  };
}

// ---------------------------------------------------------------------------
// VAPID JWT (RFC 8292)
// ---------------------------------------------------------------------------

function base64urlJson_(obj) {
  return sjcl.codec.base64url.fromBits(sjcl.codec.utf8String.toBits(JSON.stringify(obj)));
}

/** Scheme+host of a push endpoint URL, e.g. "https://web.push.apple.com" (the JWT `aud`). */
function endpointOrigin_(endpointUrl) {
  var m = /^https?:\/\/[^\/]+/.exec(String(endpointUrl));
  if (!m) fail_('VALIDATION_FAILED', 'Push endpoint is not a valid URL.', 'endpoint');
  return m[0];
}

/**
 * `{ Authorization: 'vapid t=<jwt>, k=<pubkey>' }` for one push endpoint. `exp` is 12h out
 * (comfortably < the RFC 8292 24h ceiling); a fresh JWT is signed per call — callers cache
 * per origin within one send batch rather than re-deriving this per subscription.
 */
function vapidHeaders_(endpointUrl, vapidPublicKeyB64, vapidPrivateKeyB64, vapidSubject) {
  seedEntropy_();
  var header = base64urlJson_({ typ: 'JWT', alg: 'ES256' });
  var payload = base64urlJson_({
    aud: endpointOrigin_(endpointUrl),
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapidSubject
  });
  var signingInput = header + '.' + payload;
  var hash = sjcl.hash.sha256.hash(sjcl.codec.utf8String.toBits(signingInput));
  var exponent = sjcl.bn.fromBits(sjcl.codec.base64url.toBits(vapidPrivateKeyB64));
  var sec = new sjcl.ecc.ecdsa.secretKey(WEBPUSH_CURVE, exponent);
  var sigBits = sec.sign(hash, SJCL_PARANOIA); // raw R||S — exactly JWS ES256's format
  var jwt = signingInput + '.' + sjcl.codec.base64url.fromBits(sigBits);
  return {
    Authorization: 'vapid t=' + jwt + ', k=' + vapidPublicKeyB64
  };
}

// ---------------------------------------------------------------------------
// Payload encryption (RFC 8291 over RFC 8188 aes128gcm, single record)
// ---------------------------------------------------------------------------

/**
 * Encrypt `plaintext` (a UTF-8 string) for one subscription. Returns the raw wire body as
 * a byte array: salt(16) || recordSize(4 BE) || keyidLen(1) || serverPublicRaw(65) ||
 * ciphertext+tag. `opts` (test-only) lets selfTestPush() inject the RFC 8291 §5 vector's
 * fixed salt/server-keypair to prove byte-exact correctness without a device.
 *
 * @param {string} plaintext
 * @param {string} p256dhB64url  subscription's p256dh (base64url, 65 raw bytes)
 * @param {string} authB64url    subscription's auth secret (base64url, 16 raw bytes)
 * @param {{saltBits?: Array, serverPrivateBits?: Array}} [opts]
 * @return {number[]} raw bytes ready for UrlFetchApp's `payload`
 */
function encryptPayload_(plaintext, p256dhB64url, authB64url, opts) {
  opts = opts || {};
  seedEntropy_();

  var uaPublic = parseP256dh_(p256dhB64url);
  var uaPublicRaw = publicKeyToRawBits_(uaPublic); // 65 bytes, needed in the HKDF context
  var authSecretBits = sjcl.codec.base64url.toBits(authB64url);

  // Application-server (sender) ephemeral keypair — fresh per message (RFC 8291 §3.1),
  // unless a test vector injects a fixed one.
  var serverSec, serverPub;
  if (opts.serverPrivateBits) {
    var exponent = sjcl.bn.fromBits(opts.serverPrivateBits);
    serverSec = new sjcl.ecc.elGamal.secretKey(WEBPUSH_CURVE, exponent);
    serverPub = new sjcl.ecc.elGamal.publicKey(WEBPUSH_CURVE, WEBPUSH_CURVE.G.mult(exponent));
  } else {
    var kp = sjcl.ecc.elGamal.generateKeys(WEBPUSH_CURVE, SJCL_PARANOIA);
    serverSec = kp.sec;
    serverPub = kp.pub;
  }
  var serverPublicRaw = publicKeyToRawBits_(serverPub);

  var saltBits = opts.saltBits || sjcl.random.randomWords(4, SJCL_PARANOIA); // 16 bytes

  // RFC 8291 §3.4 — raw (undigested) ECDH X-coordinate, NOT sjcl's own hashed .dh().
  var ecdhSecret = serverSec.dhJavaEc(uaPublic);

  // Stage 1 (RFC 8291 §3.4): combine ECDH + the subscription's auth secret into one IKM.
  var webpushInfo = sjcl.bitArray.concat(
    sjcl.codec.utf8String.toBits('WebPush: info\0'),
    sjcl.bitArray.concat(uaPublicRaw, serverPublicRaw)
  );
  var ikm = sjcl.misc.hkdf(ecdhSecret, 256, authSecretBits, webpushInfo, sjcl.hash.sha256);

  // Stage 2 (RFC 8188 §2.1) — the record's own salt derives the actual CEK/nonce from ikm.
  var cekBits = sjcl.misc.hkdf(
    ikm, 128, saltBits, sjcl.codec.utf8String.toBits('Content-Encoding: aes128gcm\0'), sjcl.hash.sha256);
  var nonceBits = sjcl.misc.hkdf(
    ikm, 96, saltBits, sjcl.codec.utf8String.toBits('Content-Encoding: nonce\0'), sjcl.hash.sha256);

  // Single record ⇒ the plaintext gets the RFC 8188 §2 "last record" delimiter (0x02)
  // appended before encryption. sjcl.mode.gcm.encrypt appends the 16-byte auth tag itself.
  var plaintextBits = sjcl.bitArray.concat(
    sjcl.codec.utf8String.toBits(plaintext),
    [sjcl.bitArray.partial(8, 0x02)]);
  var aes = new sjcl.cipher.aes(cekBits);
  var ciphertextBits = sjcl.mode.gcm.encrypt(aes, plaintextBits, nonceBits);

  var recordSizeBits = bytesToBits_([
    (WEBPUSH_RECORD_SIZE >>> 24) & 0xff, (WEBPUSH_RECORD_SIZE >>> 16) & 0xff,
    (WEBPUSH_RECORD_SIZE >>> 8) & 0xff, WEBPUSH_RECORD_SIZE & 0xff
  ]);
  var keyIdLenBits = [sjcl.bitArray.partial(8, 65)]; // P-256 uncompressed point is always 65 bytes

  var header = sjcl.bitArray.concat(
    saltBits,
    sjcl.bitArray.concat(recordSizeBits,
      sjcl.bitArray.concat(keyIdLenBits, serverPublicRaw)));

  return bitsToBytes_(sjcl.bitArray.concat(header, ciphertextBits));
}
