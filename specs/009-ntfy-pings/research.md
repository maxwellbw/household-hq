# Phase 0 Research — ntfy.sh Completion Pings

All Technical Context items were resolvable from the existing codebase and the ntfy.sh
free-tier model; there were **no open NEEDS CLARIFICATION** entering plan (the one spec-level
question — recipient policy — was resolved in `/speckit-clarify`). Decisions below record the
choices that shape implementation.

## D1 — Hook point: `changed` flag in `completeTask_`, not inside `setTaskLifecycle_`

- **Decision**: Fire the ping from `completeTask_` (Api.js), inside the existing
  `if (result.changed)` block, as a sibling to `mirrorTaskToCalendar_`. Do **not** put it in the
  generic `setTaskLifecycle_` (Sheets.js).
- **Rationale**: `setTaskLifecycle_` is shared by both `complete` and `reopen`; only completion
  should ping. `completeTask_` already exposes `result.changed` (true only on a real open→done
  write) and already branches on it for the calendar mirror — the exact, proven signal we need.
  Placing the call there also runs it **after** the `LockService` lock inside `setTaskLifecycle_`
  is released, so the network POST never runs under the Sheet lock.
- **Alternatives considered**: (a) A new `onTaskCompleted_` event fanned out from
  `setTaskLifecycle_` — rejected as premature abstraction (Principle IV) for one consumer.
  (b) A time-driven trigger scanning ActivityLog for recent completions — rejected: adds latency
  (not "instant"), a trigger, and a dedupe ledger for no benefit.

## D2 — No duplicate-suppression ledger needed (unlike digests 008)

- **Decision**: Rely solely on `changed === true` for FR-008; no period-key / "already-sent"
  record.
- **Rationale**: Completion is a discrete, user-initiated action, not a repeating trigger. A
  re-sent `complete` for an already-done task returns `changed === false` and never reaches the
  ping. There is no re-run/overlap surface (it is not a trigger), so Principle V is satisfied
  without a ledger. A legitimately reopened-then-completed task is a genuine new transition and
  *should* ping again (spec edge case) — exactly what `changed` gives.

## D3 — Recipient routing: complement of the completer

- **Decision**: `recipient = otherPerson_(completer)`; topic = `ntfyTopicJaz` when completer is
  `max`, `ntfyTopicMax` when completer is `jaz`. Owner is not consulted for routing.
- **Rationale**: Clarify resolved the policy to "the other person" (mental-load awareness). The
  `actor` arriving at `completeTask_` is already the resolved person (max/jaz), never the shared
  account (feature 002), satisfying FR-002's "resolved person" requirement with no extra work.

## D4 — Transport shape: text/plain POST, private topic is the secret, no new scope

- **Decision**: `UrlFetchApp.fetch(NTFY_BASE_URL + '/' + topic, { method: 'post', payload:
  message, headers: { Title: 'Household HQ', Tags: 'white_check_mark' }, muteHttpExceptions:
  true })`. `NTFY_BASE_URL = 'https://ntfy.sh'` is a Config constant. No auth header.
- **Rationale**: ntfy.sh accepts a plain-text body as the message with optional `Title`/`Tags`
  headers — the simplest possible call, no JSON, no preflight. Privacy comes from the topic name
  being an unguessable secret each person subscribes to (per the brief: "each person subscribes
  to a **private** topic"), so no account or token is required — keeping it free and keyless
  (Principle III). `script.external_request` is **already** in `appsscript.json` (Auth.js's
  tokeninfo call), so there is **no manifest change and no re-authorization** — verified against
  the current manifest.
- **Alternatives considered**: JSON POST to `https://ntfy.sh` with a `topic` field — rejected as
  needlessly heavier than the topic-in-URL form. Access-token auth on a reserved topic — rejected
  as over-engineering for two users; the secret topic name is sufficient and free.

## D5 — Base URL is a code constant, not a Setting; on/off + topics are Settings

- **Decision**: Server base URL lives in code (`NTFY_BASE_URL`). Hand-editable Settings are the
  two **topics** (`ntfyTopicMax`, `ntfyTopicJaz`, already seeded) plus a new **on/off** flag
  `ntfyEnabled` (default `TRUE`).
- **Rationale**: The topics and the master switch are the household-owned knobs (Principle II
  hand-editability, FR-004/FR-006); the server host is a platform choice, not household data, and
  a Settings row for it would invite confusion for two users who will never self-host (Principle
  IV). Blank topic = "don't ping this person" (FR-005); `ntfyEnabled=FALSE` = feature off (FR-006).

## D6 — Best-effort isolation and logging

- **Decision**: Wrap the entire `pingCompletion_` body in `try/catch`; use `muteHttpExceptions:
  true`; treat any non-2xx or thrown error as a swallowed failure. Append exactly one
  `ntfy-ping` ActivityLog row per attempt (sent / skipped / failed) with a human-readable detail.
- **Rationale**: FR-007 forbids a notification failure from surfacing as a completion error, so
  the send cannot rethrow and must not depend on ntfy being reachable. FR-009 / Principle VI
  require every state change to be logged — logging the *attempt outcome* (not just successes)
  makes a silent skip or a delivery failure inspectable in the same feed as everything else.
  `actor = system` matches the convention used by `gcal-sync` for app-initiated side effects.
