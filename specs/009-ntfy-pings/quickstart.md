# Quickstart — Validate ntfy.sh Completion Pings (feature 009)

Live validation that completing a task pushes an instant notification to **the other person's**
phone, and that the feature degrades gracefully. See [contracts/ntfy-contract.md](contracts/ntfy-contract.md)
for the exact behavior being verified and [data-model.md](data-model.md) for the Settings keys.

## Prerequisites

- Feature 009 pushed and deployed: `cd backend && clasp push && clasp deploy -i <deploymentId>`.
- `setupDatabase()` run once after deploy so `ntfyEnabled` is seeded (the two topic keys already
  exist). No re-authorization is needed — `script.external_request` was already granted.
- The **ntfy app** installed on both phones (iOS/Android, free), or two browser tabs open on
  `https://ntfy.sh/<topic>`.

## One-time setup — choose private topics

1. Pick two **unguessable** topic strings, e.g. `hhq-max-<random>` and `hhq-jaz-<random>`.
2. In the Sheet's **Settings** tab set:
   - `ntfyTopicMax` = Max's topic, `ntfyTopicJaz` = Jaz's topic.
   - `ntfyEnabled` = `TRUE`.
3. On **Max's** phone, subscribe the ntfy app to `ntfyTopicMax`. On **Jaz's** phone, subscribe to
   `ntfyTopicJaz`. (Each person subscribes only to their own topic.)

## Scenario A — Max completes a task → Jaz's phone buzzes (US1, SC-001)

1. In the app, as Max, complete any open task (e.g. "Take out recycling").
2. **Expected**: within a few seconds, **Jaz's** phone shows a notification titled *Household HQ*
   reading `Max completed: Take out recycling`. Max's phone shows **nothing** (you don't get
   pinged for your own completion).
3. In the Sheet's **ActivityLog**, the newest row is
   `system | ntfy-ping | <taskId> | pinged Jaz: "Take out recycling"`. (SC — every ping logged.)

## Scenario B — Jaz completes a task → Max's phone buzzes (US1, FR-003)

1. As Jaz, complete an open task.
2. **Expected**: **Max's** phone buzzes with `Jaz completed: <title>`; Jaz's phone is silent.
   ActivityLog shows `pinged Max: "<title>"`.

## Scenario C — Re-completing sends no duplicate (US1, SC-002)

1. Send `tasks.complete` again for a task that is already `done` (e.g. re-tap complete, or replay
   the request).
2. **Expected**: **no** new notification on anyone's phone, and **no** new `ntfy-ping` row — the
   no-op returns `changed === false` and never reaches the ping.

## Scenario D — Blank topic skips only that person (US2, SC-003)

1. Blank `ntfyTopicJaz` in Settings. As Max, complete a task.
2. **Expected**: completion succeeds; Jaz gets **no** push; ActivityLog shows
   `system | ntfy-ping | <taskId> | ntfy skipped (topic blank)`. Restore the topic afterward.

## Scenario E — Feature off (US2, FR-006)

1. Set `ntfyEnabled` = `FALSE`. Complete a task as either person.
2. **Expected**: completion succeeds; **no** push to anyone; ActivityLog shows
   `ntfy skipped (disabled)`. Set it back to `TRUE` afterward.

## Scenario F — ntfy unreachable never breaks completion (US2, SC-004)

1. Temporarily set a topic to something that will 4xx/‌5xx, or simulate by pointing at an invalid
   topic, and complete a task.
2. **Expected**: the task still shows **done** and the API returns success; ActivityLog shows
   `ntfy failed (HTTP <code>)`. The completion is never blocked or errored by the failed ping.

## `selfTest()` (no mail/no push sent)

Run `selfTest()` in the Apps Script editor. **Expected: ALL PASS**, including the new cases:

- `otherPerson_('max') === 'jaz'` and `otherPerson_('jaz') === 'max'`.
- `ntfyTopicFor_` selects `ntfyTopicJaz` for Jaz, `ntfyTopicMax` for Max.
- `buildPingMessage_` format, empty-title fallback, and long-title clamping.
- `pingCompletion_` **returns without throwing and issues no POST** when `ntfyEnabled` is false
  or the recipient topic is blank (the disabled/blank paths never call `UrlFetchApp`).
