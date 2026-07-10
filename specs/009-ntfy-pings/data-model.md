# Phase 1 Data Model — ntfy.sh Completion Pings

This feature stores **no new tabular data**. It reads three Settings rows, sends a transient
push, and appends one audit row. Below are the only data surfaces it touches.

## Settings keys (Settings tab)

Discrete, hand-editable plain-text values (Principle II). The two topic keys already exist
(seeded with a "feature 009" note); only `ntfyEnabled` is new.

| Key            | Default | Existing? | Meaning |
|----------------|---------|-----------|---------|
| `ntfyEnabled`  | `TRUE`  | **NEW**   | Master switch. `FALSE` (case-insensitive) → no pings sent at all; completion still works. |
| `ntfyTopicMax` | *(blank)* | already seeded | Max's private ntfy topic. Pinged when **Jaz** completes a task. Blank → Max is never pinged. |
| `ntfyTopicJaz` | *(blank)* | already seeded | Jaz's private ntfy topic. Pinged when **Max** completes a task. Blank → Jaz is never pinged. |

**Truthiness of `ntfyEnabled`**: reuse the project's existing boolean-Settings parsing
(the same rule `digestWeeklyEnabled`/`digestMonthlyEnabled` use — `TRUE`/`FALSE`
case-insensitive, blank → default `TRUE`). No new parsing convention.

**Topic value**: an opaque string the household chooses (e.g. `hhq-max-9f3k2`). The app treats
it as an unguessable secret and does not validate its format beyond "non-blank". A blank value is
the documented way to mute one person.

## Completion Ping (transient — not stored)

Composed at completion time; never persisted as a table row.

| Field       | Source | Notes |
|-------------|--------|-------|
| `completer` | `actor` in `completeTask_` (resolved `max`/`jaz`) | never the shared account (FR-002) |
| `recipient` | `otherPerson_(completer)` | the fixed complement (FR-003) |
| `topic`     | `ntfyTopicFor_(recipient, settings)` | `ntfyTopicJaz` if recipient Jaz, `ntfyTopicMax` if Max |
| `message`   | `buildPingMessage_(completer, task.title)` | `"<Completer> completed: <title>"`; empty title → `"<Completer> completed a task"`; over-long title clamped |
| `title` (header) | constant | `Household HQ` |
| `tags` (header)  | constant | `white_check_mark` |

Recipient/topic routing table (owner is irrelevant):

| Completer | Recipient | Topic key |
|-----------|-----------|-----------|
| `max`     | Jaz       | `ntfyTopicJaz` |
| `jaz`     | Max       | `ntfyTopicMax` |

## ActivityLog row (append-only, existing tab)

One row per ping **attempt**, via `appendLog_(actor, action, targetId, detail)`.

| Column      | Value |
|-------------|-------|
| `timestamp` | `nowIso_()` |
| `actor`     | `system` (app-initiated side effect, like `gcal-sync`) |
| `action`    | `ntfy-ping` (**new** verb; add to `ACTION_VERBS`) |
| `targetId`  | the completed task's id |
| `detail`    | outcome, human-readable — e.g. `pinged Jaz: "Take out recycling"`, `ntfy skipped (topic blank)`, `ntfy skipped (disabled)`, `ntfy failed (HTTP 502)` |

`ACTION_VERBS['ntfy-ping']` = e.g. `'sent a completion ping'` so the activity feed renders the
row even when the task id is later gone (consistent with how the feed composes summaries).

## Config constants (code, not Sheet)

| Constant        | Value | Why in code |
|-----------------|-------|-------------|
| `NTFY_BASE_URL` | `https://ntfy.sh` | free-tier platform host; a platform choice, not household data (research D5) |

## State transition that triggers a ping

```
task.status: open ──complete──▶ done      ⇒  changed === true  ⇒  PING the other person
task.status: done ──complete──▶ done      ⇒  changed === false ⇒  no ping (idempotent no-op)
task.status: done ──reopen────▶ open      ⇒  (reopen path)      ⇒  no ping (never pings)
task.status: open ──(reopened earlier, now)complete──▶ done ⇒ changed === true ⇒ PING again
```

The ping is driven entirely by the `changed` boolean already returned by `setTaskLifecycle_`;
there is no separate ping state to store or reconcile.
