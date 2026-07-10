# Implementation Plan: ntfy.sh Completion Pings (ntfy-pings)

**Branch**: `009-ntfy-pings` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-ntfy-pings/spec.md`

## Summary

When a task actually transitions **open → done**, POST a one-line push notification to **the
other person's** private ntfy.sh topic — so each person learns, in real time, what their
partner just finished. Completer `max` pings `jazEmail`'s device via `ntfyTopicJaz`; completer
`jaz` pings `ntfyTopicMax`. The whole thing is a **best-effort side effect** hung off the
existing completion path: it never blocks, slows, or fails a completion, and it fires **only on
the real transition** (never on a re-sent `complete` for an already-done task).

This is the smallest feature in the project so far. It needs **no new OAuth scope** (the
`script.external_request` scope UrlFetchApp requires is already in `appsscript.json` from the
feature-002 tokeninfo call), **no manifest change, no re-authorization, no trigger, and no
frontend work**. It reuses signals the completion path already exposes.

### The single hook point — `changed === true` in `completeTask_` (FR-001, FR-008)

`tasks.complete` → `completeTask_(payload, actor)` (Api.js) already calls
`setTaskLifecycle_(id, 'done', actor, 'complete')`, which returns `{ task, changed }` where
`changed` is `false` for an idempotent no-op (task already done) and `true` only on a real
open→done write. `completeTask_` already branches on `changed` to fire
`mirrorTaskToCalendar_`. We add **one sibling call in that same `if (changed)` block**:

```
if (result.changed) {
  mirrorTaskToCalendar_(result.task, actor);   // feature 007
  pingCompletion_(result.task, actor);         // feature 009 — NEW, best-effort
  result.task = rereadTask_(result.task.id) || result.task;
}
```

Because it lives behind `changed`, FR-008 (no duplicate ping on no-change) and the "reopen then
complete again pings again" edge case are satisfied **for free** — no period-key ledger is
needed (unlike digests 008), since completion is a discrete user action, not a repeating
trigger. It fires **after** `setTaskLifecycle_` has released its `LockService` lock, so the
network call never runs while holding the Sheet lock.

### Recipient rule — "the other person" (FR-002, FR-003; clarify Session 2026-07-09)

`actor` passed to `completeTask_` is already the **resolved person** (`max` or `jaz`) — the
shared account is resolved upstream (feature 002), so the completer is never the raw shared
account (FR-002). The recipient is simply the complement:

| Completer (`actor`) | Recipient | Topic read from Settings |
|---------------------|-----------|--------------------------|
| `max`               | Jaz       | `ntfyTopicJaz`           |
| `jaz`               | Max       | `ntfyTopicMax`           |

Owner is irrelevant to routing: a `both`-owned or a solely-`jaz`-owned task completed by Max
still pings Jaz. The completer is never pinged for their own completion.

### Best-effort send (FR-005, FR-006, FR-007)

`pingCompletion_(task, completer)` is wrapped so nothing it does can surface as a completion
error:

1. If `ntfyEnabled` (new Settings flag) is false → return silently (FR-006).
2. Resolve recipient + topic; if the topic is blank in Settings → return silently (FR-005).
3. `UrlFetchApp.fetch('https://ntfy.sh/<topic>', { method: 'post', payload: <message>,
   headers: { Title: 'Household HQ', Tags: 'white_check_mark' }, muteHttpExceptions: true })`.
4. On any non-2xx response **or** thrown exception → swallow (best-effort, FR-007); log the
   attempt outcome to ActivityLog either way.
5. The whole body is inside `try { … } catch (e) { }` so a network failure, DNS error, or
   timeout can never propagate into `completeTask_`.

The POST is a plain `text/plain` body (ntfy's default) with a `Title` header and a check-mark
`Tags` header for a nice phone notification — no JSON, no preflight, no auth header (the private
topic name *is* the secret). Message body: `"<Completer> completed: <task title>"`, e.g.
`"Max completed: Take out recycling"`. An empty/very long title is clamped to a sensible
message (edge case).

### Logging every ping (FR-009, Principle VI)

Each attempt appends one ActivityLog row via the existing `appendLog_(actor, action, targetId,
detail)`:

- `actor` = `system` (the app's side effect sent it, consistent with `gcal-sync` rows).
- `action` = `ntfy-ping` (new verb in `ACTION_VERBS`).
- `targetId` = the completed task's id.
- `detail` = human-readable outcome, e.g. `pinged Jaz: "Take out recycling"` on success, or
  `ntfy skipped (topic blank)` / `ntfy failed (HTTP 502)` when not delivered — so the log tells
  the whole story (a failed or skipped ping is still a logged, inspectable event).

### Backend additions

- **`Ntfy.js`** (NEW) — the whole feature, mirroring how `CalendarSync.js`/`Digests.js` each own
  one capability. Contents:
  - `pingCompletion_(task, completer)` — the best-effort entry called from `completeTask_`:
    gate on enabled, resolve topic, send, log. Never throws.
  - Pure helpers (all `_`, unit-testable without network): `otherPerson_(person)`,
    `ntfyTopicFor_(recipient, settings)`, `buildPingMessage_(completer, title)`, and a thin
    `postToNtfy_(topic, message)` UrlFetchApp wrapper returning `{ ok, code }`.
- **`Api.js`** (EDIT) — one line in `completeTask_`'s `if (result.changed)` block calling
  `pingCompletion_(result.task, actor)`.
- **`Config.js`** (EDIT) — add `ntfy-ping` to `ACTION_VERBS`; add `NTFY_BASE_URL =
  'https://ntfy.sh'` constant; add `ntfyEnabled` (`TRUE`) to `SETTINGS_SEED` (the two topic keys
  already exist); `API_VERSION` patch bump for traceability.
- **`SelfTest.js`** (EDIT) — cases exercising the **pure** helpers (`otherPerson_` both ways,
  `ntfyTopicFor_` picks the correct key, `buildPingMessage_` format + empty/long title), and
  that `pingCompletion_` returns without throwing and **sends nothing** when disabled or when the
  recipient topic is blank (per the CLAUDE.md "exercise the entry point" rule). No real POST is
  made during `selfTest()` — the disabled/blank-topic paths never reach `UrlFetchApp`.
- **`Setup.js`** (NO code change) — `seedSettings_` appends `ntfyEnabled` on the next
  `setupDatabase()` run; re-run once after deploy (same as 007/008).
- **`appsscript.json`** (NO change) — `script.external_request` is already present. No new scope,
  no re-authorization.

No frontend work, no new HTTP API verb, no new trigger.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+); backend-only feature.

**Primary Dependencies**: `UrlFetchApp` (POST to ntfy.sh, already used in Auth.js),
`SpreadsheetApp` (read Settings, append ActivityLog). No npm — Apps Script has none.

**Storage**: the one Google Sheet — reads the Settings tab (`ntfyEnabled`, `ntfyTopicMax`,
`ntfyTopicJaz`); appends to ActivityLog. No new tab, no new stored state, no ledger.

**Testing**: `SelfTest.js` in-project harness (`selfTest()`) asserting on pure helpers and the
no-throw / no-send behavior of the disabled and blank-topic paths; live validation per
[quickstart.md](quickstart.md) by completing a real task with topics subscribed on a phone.

**Target Platform**: Apps Script web-app project (`/backend`), deployed via `clasp`, executed as
the shared household account; the ping fires inline on the `doPost` request that completes a task.

**Project Type**: Backend-only side effect within the existing monorepo. No frontend.

**Performance Goals**: Trivial — one extra outbound POST per real completion (a few a day). The
POST adds well under a second and, being best-effort with `muteHttpExceptions`, cannot stall a
completion; nowhere near the 6-minute execution limit.

**Constraints**: Free-tier only — ntfy.sh public server is free and keyless; a handful of
messages/day is far under any fair-use limit. No paid services, no API keys that bill. The ping
must never block or fail the completion (best-effort).

**Scale/Scope**: Two users, forever. One new backend file, a one-line edit to `Api.js`, small
edits to `Config.js` + `SelfTest.js`, one new Settings key. No scope change, no trigger, no
frontend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ Completer is `max`/`jaz`; recipient is the fixed complement; the
  shared account is never a recipient and never the shown completer. No roles, no generalization.
- **II. The Sheet Is the Source of Truth** — ✅ Topics and the on/off flag are discrete
  plain-text Settings values, read live each completion (no cache, no blob). The base URL is a
  code constant (a free-tier platform choice, not household data). No shadow state — pings are
  transient; the only persistence is the append-only ActivityLog row.
- **III. Free-Tier Only** — ✅ ntfy.sh public server, keyless, free; a few messages/day. No
  servers, no billing.
- **IV. Boring and Debuggable** — ✅ One straight-line best-effort function hung off the existing
  completion branch; no new abstraction, no trigger, no scope. Reuses `UrlFetchApp`, `appendLog_`,
  `readSettingsMap_`. Both maintainers can follow it.
- **V. Idempotent Generation** — ✅ The ping fires only on `changed === true` (a real open→done
  transition), so a re-sent `complete`, a retry, or an accidental double-submit sends no
  duplicate — no ledger needed. Not a trigger, so no overlap/re-run concern.
- **VI. Every State Change Is Logged** — ✅ Every ping attempt (sent, skipped, or failed) appends
  one `ntfy-ping` ActivityLog row.
- **Timezone** — ✅ No date math in this feature; N/A.
- **Best-effort isolation** — ✅ The send is wrapped so a notification failure can never surface
  as a completion error (FR-007), and it runs after the Sheet lock is released.

**Result: PASS** — no violations; Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-ntfy-pings/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions D1–D6
├── data-model.md        # Phase 1 — Settings keys, ping message model, ActivityLog verb
├── quickstart.md        # Phase 1 — live validation (subscribe on phone, complete a task)
├── contracts/
│   └── ntfy-contract.md # the ping contract: trigger point, recipient rule, HTTP shape, logging
└── checklists/
    └── requirements.md  # spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
backend/
├── Ntfy.js            # NEW — pingCompletion_ + pure helpers (recipient, topic, message, POST)
├── Api.js             # EDIT — one line in completeTask_'s if(changed) block
├── Config.js          # EDIT — ntfy-ping verb, NTFY_BASE_URL, ntfyEnabled seed, API_VERSION
├── SelfTest.js        # EDIT — pure-helper + no-throw/no-send tests (no real POST)
├── appsscript.json    # unchanged — script.external_request already present
├── Setup.js           # unchanged — seedSettings_ picks up ntfyEnabled on next setupDatabase()
├── Sheets.js          # unchanged — reuse readSettingsMap_
└── ActivityLog.js     # unchanged — reuse appendLog_
```

**Structure Decision**: A single new backend file `backend/Ntfy.js` owns the feature, mirroring
`CalendarSync.js` (007) and `Digests.js` (008) — one file per capability, reusing shared
Sheets/Config/ActivityLog helpers. The only edit to existing logic is a single line added to
`completeTask_`, keeping the notification concern out of the generic `setTaskLifecycle_` helper
(which `reopen` also uses and must not ping).

## Complexity Tracking

No constitution violations — section intentionally empty.
