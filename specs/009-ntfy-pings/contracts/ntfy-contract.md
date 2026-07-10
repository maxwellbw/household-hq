# Contract — ntfy.sh Completion Ping

This feature exposes **no new HTTP API verb** and **no new trigger**. Its "contract" is the
side-effect behavior attached to the existing `tasks.complete` action, plus the shape of the
outbound ntfy request. Documented here so implementation and tests agree.

## 1. Trigger point (internal)

- **Called from**: `completeTask_(payload, actor)` in `backend/Api.js`, inside the existing
  `if (result.changed) { … }` block, as `pingCompletion_(result.task, actor)`.
- **Fires when**: `setTaskLifecycle_` reports a real open→done transition (`changed === true`).
- **Never fires when**: the task was already `done` (`changed === false`), or on `reopen`, or on
  any non-completion action.
- **Isolation guarantee**: `pingCompletion_` **must not throw**. Any error (network, non-2xx,
  malformed Settings) is caught and swallowed; `completeTask_` returns success regardless
  (FR-007). Runs after the Sheet lock is released.

## 2. `pingCompletion_(task, completer)` — behavior contract

Inputs: `task` (the just-completed record, has `id` and `title`), `completer` (`'max'` | `'jaz'`).

Ordered gate → send → log:

1. Read Settings once. If `ntfyEnabled` is falsey (`FALSE`, case-insensitive) → append
   `ntfy-ping` / `ntfy skipped (disabled)` and return. (FR-006)
2. `recipient = otherPerson_(completer)`; `topic = ntfyTopicFor_(recipient, settings)`.
3. If `topic` is blank → append `ntfy-ping` / `ntfy skipped (topic blank)` and return. (FR-005)
4. `message = buildPingMessage_(completer, task.title)`.
5. `postToNtfy_(topic, message)` → `{ ok, code }`.
6. Append `ntfy-ping` with detail `pinged <Recipient>: "<title>"` on `ok`, or
   `ntfy failed (HTTP <code>)` / `ntfy failed (<error>)` otherwise. (FR-009)

Return value is ignored by the caller (side effect only).

## 3. Pure helpers (unit-testable, no network)

| Helper | Contract |
|--------|----------|
| `otherPerson_('max')` | → `'jaz'` |
| `otherPerson_('jaz')` | → `'max'` |
| `ntfyTopicFor_('jaz', settings)` | → `settings.ntfyTopicJaz` |
| `ntfyTopicFor_('max', settings)` | → `settings.ntfyTopicMax` |
| `buildPingMessage_('max', 'Take out trash')` | → `'Max completed: Take out trash'` |
| `buildPingMessage_('jaz', '')` | → `'Jaz completed a task'` (empty-title fallback) |
| `buildPingMessage_('max', <200-char title>)` | title clamped to a sane length, still a valid string |

## 4. Outbound ntfy request

```
POST https://ntfy.sh/<topic>
Headers:
  Title: Household HQ
  Tags: white_check_mark
Body (text/plain):
  <Completer> completed: <task title>
```

- Sent via `UrlFetchApp.fetch(url, { method: 'post', payload: message, headers: {...},
  muteHttpExceptions: true })`.
- Success = HTTP 2xx. Any other code, or a thrown fetch error, is a swallowed failure (logged,
  never rethrown).
- No auth header — the private topic name is the secret (research D4). No JSON, no preflight.

## 5. Settings read (contract with the Sheet)

| Key | Required for a ping | Effect if blank/unset |
|-----|---------------------|-----------------------|
| `ntfyEnabled` | reads as `TRUE` by default | blank/invalid → treated as `TRUE` (feature on) |
| `ntfyTopicMax` | needed to ping Max | blank → Max never pinged (Jaz's completions log a skip) |
| `ntfyTopicJaz` | needed to ping Jaz | blank → Jaz never pinged (Max's completions log a skip) |

## 6. ActivityLog append (contract with the log)

Exactly one row per attempt: `appendLog_('system', 'ntfy-ping', task.id, <outcome detail>)`.
`ntfy-ping` must be registered in `ACTION_VERBS` so the activity feed renders it.
