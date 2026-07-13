# Research: PWA Install + Web Push (010)

Phase 0 decisions. Each: **Decision / Rationale / Alternatives considered**. The load-bearing
one is R1 (can Web Push crypto run in Apps Script at all).

---

## R1 — Web Push cryptography inside Apps Script

**Decision**: Yes, feasible, by vendoring **SJCL** (Stanford JavaScript Crypto Library) as a
single pure-JS source file `backend/Sjcl.js`, and building a thin `backend/WebPush.js` adapter
that implements the two Web Push crypto obligations on top of it:

- **VAPID / RFC 8292** — a JWT signed with **ECDSA P-256 (ES256)** plus the raw public key,
  sent as `Authorization: vapid t=<jwt>, k=<base64url pubkey>`. Uses `sjcl.ecc.ecdsa` on
  `sjcl.ecc.curves.c256`.
- **Payload / RFC 8291 (aes128gcm, RFC 8188 framing)** — server generates an ephemeral P-256
  keypair, does **ECDH** with the subscription's `p256dh`, runs **HKDF-SHA256** to derive the
  content-encryption key + nonce, then **AES-128-GCM** encrypts the (padded) plaintext. Uses
  `sjcl.ecc.elGamal`/curve ops for ECDH, `sjcl.misc.hkdf`, `sjcl.cipher.aes` + `sjcl.mode.gcm`.

**Why this is the whole ballgame**: Apps Script's `Utilities` provides only
`computeHmacSha256Signature`, `computeRsaSha256Signature`, and `computeDigest` — **no ECDSA,
no ECDH, no AES-GCM**. There is no other native path, no npm, and (per the constitution) no
server to offload to. So *some* vendored EC crypto is unavoidable for this feature to exist.

**Validation without a device**: RFC 8291 §5 publishes a **complete worked example with fixed
inputs and expected ciphertext**. `WebPush.js` will expose an internal
`encryptPayload_(plaintext, uaPublic, authSecret, {salt, serverKeys})` that accepts injected
salt + ephemeral keys, and `selfTestPush()` will feed it the RFC's fixed values and assert the
exact expected output. That turns "did we implement the spec correctly" into a deterministic
unit test that runs in the Apps Script editor (no iPhone, no live push service needed). VAPID
signing is non-deterministic (random `k`), so it's validated by a **sign-then-verify roundtrip**
using SJCL's own verifier plus a structural check of the JWT header/claims.

**Provenance & debuggability**: `Sjcl.js` gets a header comment pinning the version, upstream
URL, and license (SJCL is MIT/BSD). All feature code calls the small readable `WebPush.js`
adapter, never SJCL directly, so our surface stays inspectable. Recorded as the single
Constitution Principle-IV exception in plan Complexity Tracking.

**Alternatives considered**:
- *Hand-roll P-256 + AES-GCM* — rejected: hundreds of lines of subtle curve/field math, the
  least debuggable option, exactly what Principle IV warns against.
- *`@noble/curves` bundled to one file* — clean and modern but needs a build step to produce a
  single Apps-Script file; SJCL ships as a ready single file with no toolchain.
- *Payload-less "tickle" push + SW fetches content* — still needs ES256 VAPID (so still needs
  the vendored EC lib), and adds a network round-trip on every push that fails offline. Worse
  for the iOS reliability target (SC-004); rejected. We send the content **in** the encrypted
  payload so the notification renders even if the backend is unreachable.
- *Relay/microservice (e.g., a tiny Cloud Function using the `web-push` npm lib)* — violates
  "no servers / free-tier" (Principle III).

**Residual risk**: SJCL must actually load and run on the Apps Script V8 runtime, and our
framing must match the RFC byte-for-byte. Both are retired by running `selfTestPush()` in the
editor during quickstart (R7). If SJCL misbehaves on V8, fallback is the equivalent
single-file EC implementation, same adapter surface — no design change.

---

## R2 — VAPID key generation & storage

**Decision**: Generate the P-256 VAPID keypair **once** via an editor-run `setupPush()`
(`sjcl.ecc.ecdsa.generateKeys(c256)`), and store, in the **Settings tab**:
`vapidPublicKey` (base64url raw 65-byte point), `vapidPrivateKey` (base64url scalar), and
`vapidSubject` (default `mailto:household@example.com`). `setupPush()` is idempotent —
it refuses to overwrite existing keys unless forced, so re-running never rotates keys and
never invalidates live subscriptions.

**Rationale**: Keeping keys in the Sheet honours Principle II (single, hand-inspectable source
of truth; no Script-Properties shadow store that could drift). The keypair is write-once
operational config, comparable to the committed script/deployment IDs. The public key is not
secret; the private key's trust boundary is the Sheet itself, which already holds the email
allowlist and is access-controlled to the two users. All three keys are **Sheet-only** (not in
`EDITABLE_SETTINGS`) so the 020 Settings editor never exposes them.

**Alternatives considered**: private key in `PropertiesService` Script Properties — rejected as
a secondary store contravening Principle II, for no real security gain given the Sheet is the
existing trust boundary. Bake the public key into the frontend build — rejected in favour of a
`push.getConfig` API call so a key regeneration doesn't require a frontend redeploy.

---

## R3 — Service worker strategy (offline shell) & scope on GitHub Pages

**Decision**: A **hand-written** `frontend/public/sw.js` (copied verbatim to `dist/sw.js` →
served at `/household-hq/sw.js`), registered from `main.tsx` with
`navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')`. **No `vite-plugin-pwa`.**
Caching is **runtime**, not build-time precache:
- Navigations: network-first, fall back to the cached shell (`index.html`), then to a tiny
  inline offline card if even that is missing.
- Hashed `/household-hq/assets/*`: cache-first (they're immutable per build hash).
- A `CACHE_VERSION` constant is bumped on structural SW changes; `activate` deletes old caches;
  `self.skipWaiting()` + `clients.claim()` so a new deploy takes over promptly (satisfies FR-005
  "no stale UI").

**Rationale**: The offline requirement is modest — "shell renders + graceful offline state,"
not offline data. Runtime caching avoids the central headache of a hand-written SW on Vite:
**hashed asset filenames change every build**, so a static precache list would need build-time
generation (i.e., the plugin). Network-first navigation also means online users always get the
latest HTML, sidestepping the classic "PWA served me an old build" trap. Staying plugin-free
keeps the build boring and transparent (Principle IV) and adds zero npm deps.

**Scope correctness**: manifest `scope`/`start_url` are already `/household-hq/`; the SW at the
Pages subpath root controls that scope. Verified the built `index.html` resolves
`%BASE_URL%` → `/household-hq/` correctly, so registration URLs line up.

**Alternatives considered**: `vite-plugin-pwa` (Workbox) — robust precache + auto SW, but a new
build dependency, generated/opaque SW, and more than this small shell needs. Reconsider only if
true offline-data caching is ever required. Build-time precache list by hand — brittle against
hashed filenames.

---

## R4 — iOS install & push preconditions

**Decision**: Treat **installed-PWA-on-iOS-16.4+** as the gating condition for enabling push on
iOS, and detect it in the UI. `lib/push.ts` computes a capability state:
- `unsupported` — no `serviceWorker`/`PushManager`/`Notification` (e.g., iOS Safari **tab**, not
  installed): the control explains "Add Household HQ to your Home Screen first, then open it from
  there to enable notifications."
- `blocked` — `Notification.permission === 'denied'`: explain re-enabling in device Settings.
- `default`/`granted` — offer Enable / show Enabled+Disable.

Detect standalone launch via `window.matchMedia('(display-mode: standalone)').matches ||
navigator.standalone === true`.

**Rationale**: On iOS, `PushManager` is only present inside an installed PWA; offering a prompt
that cannot succeed is the dead-button anti-pattern FR-012 forbids. This mapping makes every
state actionable.

**Alternatives considered**: attempt `subscribe()` and interpret the throw — worse UX (a failed
prompt) and unreliable across engines; feature-detection up front is cleaner.

---

## R5 — Icons & manifest completeness

**Decision**: Add real PNGs generated from the existing `icon.svg`: `icon-192.png`,
`icon-512.png`, a dedicated **maskable** `icon-maskable-512.png` (glyph inset to the safe zone
so Android/adaptive masks don't clip it), and `apple-touch-icon.png` (180×180, opaque warm
background, no transparency — iOS renders transparency as black). Manifest `icons` lists the
192/512 `any` plus the 512 `maskable`; `index.html` adds
`<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png">` and
`<meta name="apple-mobile-web-app-capable" content="yes">` +
`apple-mobile-web-app-status-bar-style` + `apple-mobile-web-app-title`.

**Rationale**: iOS ignores SVG manifest icons and the `manifest` `icons` for the home-screen
glyph, using `apple-touch-icon` instead — the current SVG-only manifest is exactly why install
shows a blurry screenshot (SC-002). Maskable + `any` covers Android/desktop adaptive icons.

**Generation**: render PNGs from `icon.svg` at build-prep time and commit them to
`frontend/public/` (a one-off; committing binaries keeps the runtime build dependency-free). If
no rasterizer is available in-repo, generate via a short throwaway step and commit the outputs.

**Alternatives considered**: reference only the SVG — insufficient for iOS. Generate PNGs at
build time via a plugin — adds a dependency for a one-off asset set.

---

## R6 — Retiring ntfy (feature 009) & migration

**Decision**: Replace, don't co-run. `Push.js` supersedes `Ntfy.js`:
- `pingCompletion_` → `pushCompletion_`, `pingAcknowledge_` → `pushAcknowledge_`, keeping the
  **exact** guarantees (never throw; sit inside `if (result.changed)`; log every outcome). The
  two Api.js call sites (`completeTask_`, the ack handler) switch to the `push*` names.
- Message builders `buildPingMessage_` / `buildAckMessage_` move into `Push.js` unchanged so the
  notification text is byte-identical to today's pings (FR-015).
- `Ntfy.js` is deleted; `unitNtfy_` removed from SelfTest.
- Settings: `ntfyEnabled` → superseded by `pushEnabled` (default TRUE, in `EDITABLE_SETTINGS`);
  `ntfyTopicMax`/`ntfyTopicJaz` dropped from `DEFAULT_SETTINGS`. Existing ntfy rows already in a
  live Sheet are simply no longer read — left for the user to delete by hand (they cause no
  behaviour). The `ntfyEnabled` case in the `settings.update` switch is removed.
- Log action label `ntfy-ping` → `push-notify`; add `push-subscribe`/`push-unsubscribe`.

**Consequence (from clarify)**: a recipient with **no** enabled device now gets nothing — there
is no ntfy fallback. The Settings notification control copy and quickstart make enabling push the
explicit first step so neither user silently goes dark.

**Rationale**: The clarified decision is a hard replace; leaving ntfy half-wired would be dead
config implying notifications still route through it (FR-019).

**Alternatives considered**: keep ntfy as fallback when a recipient has no subscription — richer
but re-introduces the ntfy topic config and two code paths the clarify explicitly rejected.

---

## R7 — Deep-link on notification tap

**Decision**: Push payload carries `{ title, body, url, tag }`. `url` is a same-origin app URL
with an entry param — `${BASE_URL}?task=<id>` (completion/ack both relate to a task); `tag` =
task id so repeat notifications about the same task coalesce. The SW `notificationclick` focuses
an existing client if one is open (and postMessages it the target) else `clients.openWindow(url)`.
On launch (and on that postMessage), `lib/deeplink.ts` reads `?task=`/`?date=`, opens the
relevant task/day, then strips the param via `history.replaceState` so a refresh doesn't re-open
it. Absent/unparseable param → Home dashboard (FR-020, US3 AC4).

**Rationale**: Both in-scope events are task-centric, so a single `?task=` entry param covers
them; `?date=` is included for forward use. Reusing an open client avoids duplicate windows.

**Alternatives considered**: hash routes — the app is currently single-view with param-driven
peeks; a query param is the smallest addition. Always-open-Home — rejected by clarify.

---

## R8 — Subscription identity, dedupe & pruning

**Decision**: The **endpoint URL is the natural key**. `push.subscribe` upserts under
`LockService`: if a row with that endpoint exists, update its keys/label/`lastUsedAt` (and
re-point `person` to the current signer); else insert a new row with a fresh UUID. Device label
is auto-derived from the `User-Agent` at subscribe time (e.g. "iPhone Safari", "Mac Chrome") —
approximate, no manual naming (clarify). Send fan-out reads the recipient's rows; on a `404`/`410`
from the push service the row is deleted (pruned) in a batched write after the fan-out.

**Rationale**: Browsers occasionally rotate the endpoint; keying on it prevents duplicate rows
that would double-notify (FR-011/FR-016/FR-017). Endpoint-keyed upsert + the `if (result.changed)`
guard make the whole path idempotent (Principle V).

**Alternatives considered**: random-UUID-only identity — risks duplicates on re-subscribe. Prune
lazily on next send only — chosen (no separate sweep trigger needed for two users).

---

## Resolved unknowns

All Technical-Context items are resolved; no `NEEDS CLARIFICATION` remain. The spec's flagged
technical risk (web-push crypto within Apps Script) is retired by R1 + the R7 quickstart
self-test. Open validation that needs real hardware (actual iPhone install + closed-app push) is
tracked in quickstart, consistent with the project's existing "clasp run unavailable in sandbox"
follow-up pattern.
