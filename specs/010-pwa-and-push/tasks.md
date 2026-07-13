---
description: "Task list for 010 — PWA Install + Web Push"
---

# Tasks: PWA Install + Web Push

**Input**: Design documents from `specs/010-pwa-and-push/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Included — the plan's Testing section calls for backend `selfTestPush()` (the crypto
must be proven against the RFC vector before any device work) and frontend Vitest for the push
helpers, matching the project's definition-of-done (`npm run build` clean, self-test passes).

**Organization**: By user story. US1 (install) and US2 (enable) are both P1; US3 (receive) is P2
and builds on the SW file from US1 and the subscription store from US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Paths are repo-relative. Backend = Apps Script (`/backend`, flat files); Frontend = Vite (`/frontend`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vendored crypto substrate and icon assets that later phases build on.

- [X] T001 Vendor SJCL as `backend/Sjcl.js` — a single pure-JS P-256 (ECDSA + ECDH) + AES-GCM + HKDF build, with a header comment pinning version, upstream URL, and license (research R1). No other backend deps. Confirm it parses/loads (a trivial `sjcl.codec.hex` call) without V8 errors.
- [X] T002 [P] Generate PNG icons from `frontend/public/icon.svg` into `frontend/public/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (glyph inset into the maskable safe zone), and `apple-touch-icon.png` (180×180, **opaque** warm `#FAF6F0` background — no transparency). Commit the binaries (research R5).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sheet tab, Settings schema, VAPID keygen, and one-time setup — required before either
P1 story can store or sign anything.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T003 Register the `PushSubscriptions` tab — **deviation**: `TABS`/`HEADERS` both live in `backend/Config.js` in this codebase (not `Sheets.js`, which is the generic engine); added there with `id, person, endpoint, p256dh, auth, deviceLabel, createdAt, lastUsedAt` (data-model.md).
- [X] T004 In `backend/Config.js` — **deviation**: the seed table is `SETTINGS_SEED` (not `DEFAULT_SETTINGS`); added `pushEnabled=TRUE`, `vapidPublicKey=''`, `vapidPrivateKey=''`, `vapidSubject='mailto:maxandjazmine@gmail.com'`; added `pushEnabled` to `EDITABLE_SETTINGS`; added ActivityLog action labels `push-notify`/`push-subscribe`/`push-unsubscribe`.
- [X] T005 Created `backend/WebPush.js` with `generateVapidKeys_()` → `{ publicKey, privateKey }` base64url via SJCL `sjcl.ecc.ecdsa.generateKeys(c256)`. Full file written in one pass (keygen + JWT + payload encryption together) rather than split across T005/T017 — no functional difference.
- [X] T006 `backend/Setup.js`: `setupDatabase()` creates the `PushSubscriptions` tab (idempotent, added to the `order` array); `setupPush()` generates the VAPID keypair only if blank.

**Checkpoint**: DB tab + settings exist; running `setupPush()` yields a `vapidPublicKey`.

---

## Phase 3: User Story 1 — Install to the home screen (Priority: P1) 🎯 MVP

**Goal**: A real installable PWA — correct icons, standalone signed-in launch, offline shell.

**Independent Test**: Add the built site to an iPhone home screen; icon is the app glyph (not a
screenshot); launching opens full-screen, warm background, lands signed-in on Home; airplane-mode
relaunch renders the cached shell.

- [X] T007 [P] [US1] Added `icon-192.png` + `icon-512.png` (`purpose:"any"`) and `icon-maskable-512.png` (`purpose:"maskable"`) to `manifest.webmanifest`; name/scope/start_url/display/colors unchanged.
- [X] T008 [P] [US1] Added `apple-touch-icon` link + `apple-mobile-web-app-*` metas to `index.html`.
- [X] T009 [US1] `frontend/public/sw.js` written with the full shell (install/activate/fetch) AND the push/notificationclick handlers together (T021 folded in) — no functional difference from doing it in two passes.
- [X] T010 [US1] Service worker registered in `main.tsx`, guarded + non-fatal on failure. Verified live: registers and activates at scope `/household-hq/` with zero console errors (dev server, browser check).

**Checkpoint**: Installs cleanly with the real glyph; offline launch shows the shell; signed-in
via 018. US1 shippable on its own.

---

## Phase 4: User Story 2 — Enable notifications on this device (Priority: P1)

**Goal**: A per-device opt-in that requests OS permission and stores/removes a subscription for
the signed-in person, with honest capability states.

**Independent Test**: On the installed iPhone PWA, Settings → Enable → Allow flips the control to
On and creates one `PushSubscriptions` row (person = you, label ≈ "iPhone Safari"); Disable removes
it; a normal Safari tab shows the "add to Home Screen first" state, not a dead button.

- [X] T011 [US2] `backend/Push.js` — `subscribeDevice_`/`unsubscribeDevice_`/`listSubscriptionsForPerson_`/`deriveDeviceLabelFromUa_`, endpoint-keyed upsert under `withLock_`, ActivityLog `push-subscribe`/`push-unsubscribe`.
- [X] T012 [US2] `push.config`/`push.subscribe`/`push.unsubscribe` registered in `Api.js` `HANDLERS`; also added `subscribe`/`unsubscribe` to `isWriteAction_` (Config.js) so shared-account callers confirm an acting person, matching every other write action.
- [X] T013 [P] [US2] `frontend/src/lib/push.ts` — capability detection, subscribe/unsubscribe, device label, base64url helpers.
- [X] T014 [US2] "Notifications on this device" control added to `SettingsView.tsx`; household toggle renamed "Push notifications" (was "Instant completion pings").
- [X] T015 [P] [US2] **Deviation**: split rather than combined — subscription/message-builder assertions live in `unitPush_()` (replaces `unitNtfy_()` in chunk 4, same as before); the crypto proof (RFC vector + VAPID) lives in the separate public `selfTestPush()` runner (matches T023's own description of that runner, so the two tasks converge on the same design either way).
- [X] T016 [P] [US2] `frontend/src/lib/push.test.ts` — deriveDeviceLabel samples + getCapability mapping (8 tests, all passing).

**Checkpoint**: Devices can be enabled/disabled and are stored per person. No sending yet.

---

## Phase 5: User Story 3 — Receive a push when the app is closed (Priority: P2)

**Goal**: The two ntfy events now send an encrypted Web Push that shows on a closed app and
deep-links on tap; ntfy retired.

**Independent Test**: With a subscription present and app fully closed, a completion/ack on the
other device surfaces a native notification within ~1 min; tapping deep-links to the task; deleting
the app auto-prunes the dead row on the next send without breaking the action.

- [X] T017 [US3] `WebPush.js` extended with `vapidHeaders_`/`encryptPayload_` (RFC 8291 over RFC 8188, `opts.saltBits`/`opts.serverPrivateBits` injectable). **Verified against the real RFC 8291 §5 vector in Node before ever touching Apps Script** — every intermediate value (ECDH secret, IKM, CEK, nonce) and the full 145-byte wire message matched byte-for-byte; VAPID JWT sign+verify roundtrip also confirmed.
- [X] T018 [US3] `Push.js` extended: `buildCompletionMessage_`/`buildAcknowledgeMessage_` (byte-identical to retired ntfy text), `sendWebPush_`, `pushCompletion_`/`pushAcknowledge_` — gated on `pushEnabled`, fan out per recipient, prune dead subs, one `push-notify` log line, never throws.
- [X] T019 [US3] `completeTask_`/`acknowledgeTask_` call sites swapped to `pushCompletion_`/`pushAcknowledge_`.
- [X] T020 [US3] ntfy fully retired: `Ntfy.js` deleted; `ntfyEnabled`/`ntfyTopicMax`/`ntfyTopicJaz` removed from `SETTINGS_SEED`/`EDITABLE_SETTINGS`; `ntfyEnabled` case in `validateSettingValue_` → `pushEnabled`; `unitNtfy_` replaced by `unitPush_`; **also fixed** a live reference to `ntfyEnabled` in `liveSettingsUpdate_()` (SelfTest.js) that the grep sweep caught — updated to `pushEnabled`. Frontend `lib/settings.ts` + `SettingsView.tsx` + their tests updated in lockstep (not originally itemized, but required for FR-019's "no live code path" bar).
- [X] T021 [US3] Folded into T009 (see above) — `sw.js` written with shell + push/notificationclick in one pass.
- [X] T022 [P] [US3] `lib/deeplink.ts` created; wired into `App.tsx` to navigate to the Tasks tab on a deep link (closest existing surface to "the related task" — there's no global task-detail route to target yet), falling back to whatever section was active (Home by default) when absent, per spec.
- [X] T023 [US3] Folded into `selfTestPush()` per T015's note above — RFC 8291 vector + VAPID roundtrip both asserted there.

**Checkpoint**: All three stories functional; ntfy fully removed; crypto proven correct (Node-verified against the RFC vector; the identical assertions run as `selfTestPush()` in the Apps Script editor).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] BACKLOG.md updated (see below).
- [X] T025 `npm run build` clean (no type errors), `npm test` — 387/387 passing. The impeccable design hook ran automatically on every touched file during editing and found nothing new to fix (two pre-existing font findings in `index.css` predate this feature and are unrelated).
- [X] T026 Backend pushed and deployed (`clasp push` + `clasp deploy -i <existing deployment>` → refreshed to version @24, same URL). Quickstart A–C (`setupDatabase()`, `setupPush()`, `selfTestPush()`) run manually from the Apps Script editor by Jaz — confirmed passing, including the RFC 8291 vector + VAPID roundtrip proof. D–G (real iPhone install/enable/receive/disable) remain the standing device-gated follow-up.

---

## Dependencies & Execution Order

### Phase order

- **Setup (P1)** → **Foundational (P2)** → **US1 / US2 (P3/P4)** → **US3 (P5)** → **Polish (P6)**.
- US1 and US2 are both P1 and independent of each other (different files: US1 is manifest/SW/html, US2 is Push.js/Api.js/push.ts/SettingsView) — parallelizable after Foundational.
- US3 depends on: T009 (extends `sw.js`), T011 (extends `Push.js`), T005 (extends `WebPush.js`), T012 subscription store — so US3 follows US1+US2.

### Key cross-task dependencies

- T005 (WebPush keygen) → T006 (`setupPush`) → US2 subscribe (needs a `vapidPublicKey`).
- T009 (sw.js shell) → T021 (sw.js push handlers).
- T011 (Push.js store) → T018 (Push.js send).
- T017 (encrypt/sign) → T018 (send) and T023 (crypto self-test).
- T020 (retire ntfy) after T018/T019 (send path replaces the callers first).

### Parallel opportunities

- T002 ‖ T001 (icons vs vendored crypto).
- Within US1: T007 ‖ T008 (manifest vs html); T009 then T010.
- US1 ‖ US2 entirely (disjoint files).
- Within US2: T013 ‖ T016 (push.ts vs its test); T015 ‖ frontend tasks.
- T022 ‖ T021 in US3 (frontend deeplink vs sw.js).

---

## Implementation Strategy

- **MVP = US1 + US2** (both P1): an installable, signed-in app whose devices can opt into
  notifications. Ship/validate that first (install + enable/disable on a real iPhone).
- **US3** completes the payoff (actual pushes + ntfy retirement); it's the crypto-heavy slice —
  land `selfTestPush()` green (T023) before trusting any device result.
- Backend deploy is manual (`clasp push && clasp deploy`); `setupPush()` is a one-time editor run
  after deploy. Frontend ships via merge-to-`main` Pages CI.
- Commit per task or logical group; keep every Sheet-writing function idempotent + `LockService`
  where concurrent, and append to ActivityLog (constitution V/VI).
