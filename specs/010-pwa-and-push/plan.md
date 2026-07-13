# Implementation Plan: PWA Install + Web Push

**Branch**: `010-pwa-and-push` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-pwa-and-push/spec.md`

## Summary

Turn Household HQ into a genuinely installable PWA and replace the feature-009 ntfy.sh
pings with real Web Push. Three slices: (1) a complete manifest + real PNG icons +
apple-touch-icon and a hand-written service worker that caches the app shell and lands the
installed icon signed-in; (2) a per-device opt-in that requests OS permission and stores a
Web Push subscription against `max`/`jaz`; (3) a backend that, for the same two events ntfy
handled (task open→done completion, "has it" ack), sends an encrypted Web Push to the
recipient's devices, deep-links on tap, and prunes dead subscriptions — with ntfy retired.

The one hard problem is that Web Push requires **ECDSA P-256** (VAPID, RFC 8292) and
**ECDH + AES-128-GCM** (payload, RFC 8291), none of which Apps Script's `Utilities` class
provides. Resolved by vendoring a single pure-JS crypto file (SJCL) behind a thin,
readable `WebPush.js` adapter and validating it against the RFC 8291 published test vector
in `SelfTest.js`. This is the only new backend "dependency" and is unavoidable on the
no-server / free-tier stack (see Constitution Check + research R1).

## Technical Context

**Language/Version**: Backend Apps Script (V8, ES2015+); Frontend TypeScript + React 19 on Vite 8.

**Primary Dependencies**: Backend stays npm-free; adds one **vendored pure-JS source file** (SJCL, `backend/Sjcl.js`) for P-256 ECDSA/ECDH + AES-GCM. Frontend adds no new npm deps — hand-written service worker in `frontend/public/sw.js`, no `vite-plugin-pwa`.

**Storage**: Google Sheet. New `PushSubscriptions` tab (one row per enabled device). Settings tab gains `pushEnabled`, `vapidPublicKey`, `vapidPrivateKey`, `vapidSubject`; retires `ntfyEnabled`, `ntfyTopicMax`, `ntfyTopicJaz`.

**Testing**: Backend `SelfTest.js` chunk `selfTestPush()` (RFC 8291 vector, VAPID sign/verify roundtrip, subscription upsert/dedupe/prune, message builders). Frontend Vitest for `lib/push.ts` helpers + `SettingsView` notification-control states.

**Target Platform**: Installed PWA on iOS 16.4+ Safari (primary, must-work); desktop Chrome/Edge (secondary). Un-installed browser tab must keep working unchanged.

**Project Type**: Web application (`/frontend` Vite app + `/backend` Apps Script), per repo layout.

**Performance Goals**: Installed-icon → signed-in Home < 3s (SC-001); push visible on a closed app within ~1 min in ≥9/10 tries on iPhone (SC-004). Send fan-out (≤~2 subscriptions/recipient) completes well within the 6-minute run budget.

**Constraints**: Free-tier only, no servers, backend dependency-free beyond the one vendored crypto file, `UrlFetchApp` for all HTTP, Sheet stays human-readable, every state change logged, generated writes idempotent + `LockService` where concurrent.

**Scale/Scope**: Two users, ~2 devices each. A handful of subscription rows, ever.

## Constitution Check

*GATE: evaluated before Phase 0 and re-checked after design.*

- **I. Two Users Forever** — ✅ Subscriptions key off `max`/`jaz` only; no roles, no registration, no device cap logic beyond "a person may have several." No tenancy.
- **II. The Sheet Is the Source of Truth** — ✅ Subscriptions and all VAPID config live in the Sheet as plain text (long base64url strings are still hand-inspectable and hand-deletable; deleting a subscription row disables that device). No shadow datastore — the VAPID private key lives in a Settings cell, **not** in Script Properties, precisely to avoid a secondary store that could drift. Endpoint is the natural dedupe key; IDs via `Utilities.getUuid()`; row position never used.
- **III. Free-Tier Only** — ✅ Web Push endpoints (Apple/Mozilla/Google push services) are free and keyless; VAPID keys are self-generated. Retiring ntfy removes a free dependency, adds no paid one.
- **IV. Boring and Debuggable** — ⚠️ **One justified exception**: a vendored pure-JS crypto library. Web Push cannot be built without EC crypto the platform lacks, and vendoring a single battle-tested file is *more* debuggable than hand-rolling P-256 curve math. Isolated behind `WebPush.js`, pinned with a provenance header, and verified against the RFC's own test vector. Recorded in Complexity Tracking.
- **V. Idempotent Generation** — ✅ Sends sit inside the existing `if (result.changed)` guard, so a re-run/re-complete never re-pushes. Subscription writes are endpoint-keyed upserts under `LockService`. Dead endpoints (404/410) are pruned.
- **VI. Every State Change Is Logged** — ✅ Subscribe/unsubscribe and each push outcome append to ActivityLog (new `push-notify` / `push-subscribe` actions), mirroring the retired `ntfy-ping` logging.
- **VII. Spec-Driven Development** — ✅ Full spec → clarify → plan chain on branch `010-pwa-and-push`; deviations written back to the spec.

**Gate result: PASS** with one recorded, justified exception (vendored crypto).

## Project Structure

### Documentation (this feature)

```text
specs/010-pwa-and-push/
├── plan.md              # This file
├── research.md          # Phase 0 — crypto feasibility, SW strategy, icons, migration
├── data-model.md        # Phase 1 — PushSubscriptions tab + Settings deltas
├── quickstart.md        # Phase 1 — editor setup, self-test, real-iPhone validation
├── contracts/
│   ├── api-push.md      # push.getConfig / push.subscribe / push.unsubscribe
│   └── service-worker.md# SW cache + push + notificationclick contract, push payload shape
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── Sjcl.js              # NEW — vendored pure-JS crypto (P-256 ECDSA/ECDH, AES-GCM), provenance header
├── WebPush.js           # NEW — thin adapter: generateVapidKeys_, vapidHeaders_, encryptPayload_
├── Push.js              # NEW — replaces Ntfy.js: subscription CRUD, sendWebPush_, pushCompletion_/pushAcknowledge_, message builders
├── Ntfy.js              # REMOVED — retired per FR-019
├── Api.js               # EDIT — swap ping* calls → push*; add push.getConfig/subscribe/unsubscribe actions; drop ntfyEnabled settings case
├── Config.js            # EDIT — add vapid*/pushEnabled defaults + EDITABLE_SETTINGS; retire ntfy* keys; add push action verbs / log labels
├── Sheets.js            # EDIT — register PushSubscriptions tab + headers
├── Setup.js             # EDIT — create PushSubscriptions tab; setupPush() generates VAPID keypair once
└── SelfTest.js          # EDIT — remove unitNtfy_; add selfTestPush() (RFC vector, VAPID roundtrip, sub upsert/prune)

frontend/
├── public/
│   ├── sw.js            # NEW — hand-written service worker (cache shell, push, notificationclick)
│   ├── manifest.webmanifest  # EDIT — add PNG + maskable icons
│   ├── icon-192.png / icon-512.png / icon-maskable-512.png / apple-touch-icon.png  # NEW
│   └── icon.svg         # existing source glyph
├── index.html           # EDIT — apple-touch-icon link + apple-mobile-web-app metas
└── src/
    ├── main.tsx         # EDIT — register service worker
    ├── lib/push.ts      # NEW — support detection, subscribe/unsubscribe, VAPID key fetch, device-label, base64url
    ├── lib/deeplink.ts  # NEW — read ?task=/?date= entry params on launch, then clean URL
    └── components/more/SettingsView.tsx  # EDIT — "Notifications on this device" control (on/off/blocked/unsupported)
```

**Structure Decision**: Existing two-app web layout. Backend gains three new files (one vendored, two authored) and retires `Ntfy.js`; frontend gains a service worker, a push helper module, icon assets, and one Settings control. No structural change to either app.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Vendored pure-JS crypto file (SJCL) in `/backend` — a "dependency beyond the decided stack" (Principle IV) | Web Push mandates ECDSA P-256 (VAPID) + ECDH + AES-128-GCM; Apps Script `Utilities` offers only HMAC/RSA/digest, so the feature is impossible without EC crypto | (a) Hand-rolling P-256 curve math + AES-GCM is far more code and far less debuggable — the opposite of Principle IV. (b) A relay/microservice to sign+encrypt violates "no servers / free-tier." (c) Payload-less "tickle" pushes still require ECDSA VAPID, so they don't avoid the vendored lib. Isolating one audited file behind `WebPush.js` and pinning it to the RFC 8291 test vector is the least-clever option that works. |
