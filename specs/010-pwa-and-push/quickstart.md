# Quickstart & Validation: PWA Install + Web Push (010)

End-to-end validation. Steps A–C run from the Apps Script editor / clasp (no device needed);
D–G need a real iPhone. Consistent with the project's standing note that `clasp run` isn't wired
as an API executable in this sandbox — the editor functions are run by hand.

## Prerequisites

- Backend pushed + deployed: `cd backend && clasp push && clasp deploy -i <deploymentId>`
  (refresh the existing web-app URL, don't mint a new one).
- Frontend built + on Pages: merge to `main` (CI deploys), or `cd frontend && npm run build`.
- Signed in on the device as Max or Jaz (018 session persistence carries the login into the
  installed app).

---

## A. One-time backend setup (editor)

1. Run **`setupDatabase()`** — creates the `PushSubscriptions` tab and seeds the new Settings
   rows (`pushEnabled`, `vapidSubject`, blank `vapid*Key`). Idempotent; safe on an existing DB.
2. Run **`setupPush()`** — generates the VAPID P-256 keypair and writes `vapidPublicKey` /
   `vapidPrivateKey` into Settings. **Idempotent**: re-running with keys already present is a
   no-op (won't rotate and invalidate live subscriptions).
   - **Expected**: Settings now shows a ~87-char base64url `vapidPublicKey` and a private key;
     `push.config` returns the public key.

## B. Crypto self-test (editor) — the load-bearing check

3. Run **`selfTestPush()`**. It must pass:
   - **RFC 8291 §5 vector** — `encryptPayload_` with the RFC's fixed salt + ephemeral key +
     inputs produces the RFC's exact expected ciphertext (proves the aes128gcm/HKDF/ECDH framing
     is byte-correct without any device).
   - **VAPID roundtrip** — a JWT signed by `vapidHeaders_` verifies against the public key via
     SJCL, and the header/claims (`aud`, `exp`≤24h, `sub`) are well-formed.
   - **Subscription upsert/dedupe** — two `push.subscribe` calls with the same endpoint yield one
     row (updated), different endpoints yield two rows.
   - **Prune** — a simulated `410` marks a row for deletion.
   - **Message builders** — completion/ack text byte-identical to the retired ntfy strings.
   - **Expected**: `selfTestPush: pass` in the logs; no assertion failures.

## C. Send smoke test (editor, optional)

4. With a real subscription row present (after D2 below), run a helper that calls
   `pushCompletion_` for a scratch task and confirm one `push-notify` line lands in ActivityLog
   and the device receives it. (Before any real subscription exists this logs
   `push skipped (no devices)` — also a valid pass.)

---

## D. Install on iPhone (Safari, iOS 16.4+) — SC-001/SC-002

1. Open the Pages URL in Safari → Share → **Add to Home Screen**.
   - **Expected**: suggested name "Household HQ"; the icon is the app glyph (from
     `apple-touch-icon.png`), **not** a blurry screenshot.
2. Launch from the home-screen icon.
   - **Expected**: full-screen (no Safari chrome), warm `#FAF6F0` background during load, safe
     area respected, lands on the **signed-in Home dashboard** with no sign-in step (< 3s).
3. Turn on Airplane Mode, relaunch from the icon.
   - **Expected**: cached app shell renders (not Safari's "no internet" page); network-dependent
     data shows a graceful empty/offline state, no crash.

## E. Enable notifications on the device — SC-003

4. Open **More → Settings → "Notifications on this device" → Enable**.
   - **Expected**: OS permission prompt appears; on **Allow**, the control flips to "On" and a
     `PushSubscriptions` row appears (person = you, `deviceLabel` ≈ "iPhone Safari").
5. In a normal Safari **tab** (not installed), open the same control.
   - **Expected**: no dead button — copy says add to Home Screen first (capability `unsupported`).
6. If you previously denied permission: control shows "blocked" copy pointing to iOS Settings.

## F. Receive a closed-app push — SC-004 (the payoff)

7. Fully close the app on Jaz's iPhone (swipe away). On Max's device, complete a task
   (assigned so Jaz is the recipient) or acknowledge one so Jaz is the recipient.
   - **Expected**: within ~1 min, Jaz's phone shows a native notification with the same text the
     ntfy ping used ("Max completed: …" / "Max has it: …"). Repeat 10×; ≥9 arrive.
8. Tap the notification.
   - **Expected**: app opens/focuses and deep-links to that task; refreshing does not re-open it
     (entry param stripped). A push without a task id opens Home.

## G. Disable + prune + master switch — SC-005/SC-006

9. Settings → **Disable** notifications.
   - **Expected**: control shows "Off"; the `PushSubscriptions` row is gone; no further pushes.
10. Delete the app (or let the subscription expire), then trigger an event.
    - **Expected**: the send gets 404/410, the stale row is auto-pruned, and the completing
      action still succeeds with no user-visible error.
11. Set `pushEnabled = FALSE` (Settings editor) and trigger an event.
    - **Expected**: `push-notify` logs `push skipped (disabled)`, no push sent, app otherwise
      fully functional. Set back to `TRUE`.

---

## Regression check — SC-007

- Un-installed browser tab: every existing flow (tasks, calendar, digests, lists) works exactly
  as before. `npm run build` passes with no type errors; backend `selfTest*` chunks still pass
  (with `unitNtfy_` removed and `selfTestPush()` added).
- Grep confirms no live code path still reads `ntfyEnabled` / `ntfyTopic*` (FR-019).

## Known follow-ups (device-gated)

Like 028's live validation, steps D–G require a physical iPhone and can't run in this sandbox;
record results on-device. A/B/C (editor self-tests) are the automated proof the crypto and data
model are correct.
