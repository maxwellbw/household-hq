# Feature Specification: ntfy.sh Completion Pings (ntfy-pings)

**Feature Branch**: `009-ntfy-pings`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "ntfy.sh completion pings — Instant push notifications via ntfy.sh when a task is completed. Each person subscribes to their own private ntfy topic; when a task is marked done, the backend POSTs a notification to the relevant person's topic. Topics are configured in Settings. This is feature 009 from the project brief §10 item 10."

## Clarifications

### Session 2026-07-09

- Q: When someone completes a task, who should receive the ntfy push notification? → A: **The other person** — only the household member who did *not* complete it is pinged; you never get pinged for your own completions. A `both`-owned task completed by one person pings the other.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant "they did it" ping when a task is completed (Priority: P1)

Max takes out the recycling and marks the chore done. A second later Jaz's phone buzzes: "Max completed: Take out recycling." Jaz didn't have to open the app or ask — she knows it's handled and can cross it off her mental list. Later Jaz finishes the grocery run and marks it done, and Max's phone buzzes the same way. The household stays in sync on who did what, in real time, without either person nagging the other.

**Why this priority**: This is the entire point of the feature and the brief's Phase 2 payoff (§10 item 10) — a zero-effort, real-time awareness of completed work that makes mental-load distribution visible without opening the app. Shipping just this instant ping is a complete, useful slice.

**Independent Test**: With each person's ntfy topic set in Settings and each subscribed on their phone, complete a task in the app and confirm the appropriate person receives a push notification naming who completed it and which task, within a few seconds — and that a task owned by the other person or by both behaves per the recipient rule.

**Acceptance Scenarios**:

1. **Given** both people have a subscribed ntfy topic set in Settings, **When** Max marks a task done, **Then** a push notification is delivered to the household member(s) who should be informed, naming the completer and the task title.
2. **Given** a task is completed, **When** the ping is composed, **Then** its message conveys who completed it and the task title at a glance.
3. **Given** a task is already `done`, **When** a `complete` action is re-sent for it (no real state change), **Then** no duplicate ping is sent.
4. **Given** a completion ping is sent, **When** the activity log is inspected, **Then** the ping send is recorded.

---

### User Story 2 - Pings are configurable and degrade gracefully (Priority: P2)

The pings are wired to per-person ntfy topics the household sets in Settings by hand, and the whole feature can be turned off there without touching code. If a person's topic is blank, that person simply isn't pinged — the completion itself still succeeds normally. If ntfy.sh is unreachable or slow, marking a task done still works instantly; the ping is best-effort and never blocks or fails the completion.

**Why this priority**: Makes the feature safe to leave on and adjustable by the users themselves, consistent with the project's hand-editable-Settings principle. It is a robustness layer over the core ping, so it ships second.

**Independent Test**: Blank one person's topic in Settings and confirm completing a task still succeeds and only the configured recipient (if any) is pinged. Turn pings off in Settings and confirm no notification is sent on completion while the completion still works. Point a topic at an unreachable endpoint and confirm the completion still returns success.

**Acceptance Scenarios**:

1. **Given** a recipient's ntfy topic is blank in Settings, **When** a task they should be informed of is completed, **Then** that recipient is skipped without error and the completion still succeeds.
2. **Given** completion pings are turned off in Settings, **When** a task is completed, **Then** no ping is sent and the completion still succeeds.
3. **Given** the ntfy service is unreachable or errors, **When** a task is completed, **Then** the task is still marked done and returned as success; the failed ping does not surface as a completion error.
4. **Given** the household changes a topic value in Settings, **When** the next completion occurs, **Then** the ping is sent to the new topic without a code change.

---

### Edge Cases

- **Re-completion / re-fire**: completing an already-`done` task (no real change) sends no ping — the ping fires only on an actual open→done transition, reusing the same idempotency signal the completion path already exposes.
- **Reopen then complete again**: a task legitimately reopened and later completed again is a real new transition and pings again (this is not a duplicate).
- **Blank topic for one person**: only that person is skipped; the other side (and the log) is unaffected.
- **Feature turned off**: the on/off Settings control suppresses all pings without affecting task completion.
- **ntfy unreachable / non-2xx response**: the ping is best-effort; the completion never fails or slows on account of a notification error, and the failure is not treated as a completion error.
- **Who did it was the shared account**: the completer shown in the ping is the resolved person (max/jaz), never the raw shared account, consistent with the household's actor model.
- **`both`-owned task**: covered by the recipient rule below — the completed `both` task still results in the appropriate person(s) being informed rather than being dropped.
- **Long or empty task title**: the ping still sends with a sensible message even if the title is unusually long or missing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST send an instant push notification via ntfy.sh when a task transitions to completed (an actual open→done change), and only on that real transition.
- **FR-002**: Each notification MUST identify who completed the task (the resolved person, max or jaz — never the raw shared account) and the task's title.
- **FR-003**: The recipient of a completion ping MUST be the household member who did *not* complete the task — the completer is never pinged for their own completion. A `both`-owned task completed by one person pings the other; a task solely owned by the completer still pings the other person (awareness of what your partner did).
- **FR-004**: Each person's ntfy topic MUST be read from Settings (`ntfyTopicMax`, `ntfyTopicJaz`), hand-editable without a code change.
- **FR-005**: When a target recipient's ntfy topic is blank in Settings, the system MUST skip that recipient without error; the completion MUST still succeed.
- **FR-006**: Completion pings MUST be turn-off-able from Settings (a single on/off control) without editing code; when off, no pings are sent and completion still works.
- **FR-007**: Sending a ping MUST be best-effort and MUST NOT block, slow materially, or fail a task completion — a notification-service error MUST NOT surface as a completion error.
- **FR-008**: The system MUST NOT send a duplicate ping when a `complete` action produces no real state change (task already done).
- **FR-009**: Every completion-ping send MUST be appended to the activity log (timestamp, actor, action, target), consistent with the project's "every state change is logged" principle.
- **FR-010**: Notifications MUST be sent to a private per-person ntfy topic (each person subscribes only to their own), carrying no data beyond what is needed to convey the completion.

### Key Entities *(include if feature involves data)*

- **Completion ping**: a transient, best-effort push message emitted at the moment a task is completed. Not stored as a table. Attributes: completer (resolved person), task title, target recipient topic.
- **Recipient**: one of the two people (Max, Jaz), each with a personal ntfy topic in Settings. The shared household account is never a ping recipient and never the shown completer.
- **Settings (ping configuration)**: hand-editable configuration — the per-person ntfy topics and the on/off control — read at completion time.
- **Activity log entry**: a record appended per ping send, for auditability and completion awareness.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a task is completed with topics configured and the feature on, the intended recipient receives a push notification naming the completer and the task, within a few seconds, on every real completion.
- **SC-002**: Re-sending a `complete` action for an already-done task produces zero additional notifications.
- **SC-003**: With a recipient's topic blank, or with pings turned off, completing a task still succeeds 100% of the time and no errant notification is sent.
- **SC-004**: With ntfy.sh unreachable, task completion still returns success 100% of the time and is never slowed to the point of failure by the notification attempt.
- **SC-005**: The household can change topics or turn pings off entirely by editing the Sheet, with the change taking effect on the next completion and no code change.

## Assumptions

- **Trigger is task completion only.** Pings fire on the open→done transition of a task; no other action (create, reopen, edit, event changes) pings in this feature. Reopen-then-complete is a fresh transition and pings again.
- **Recipient is "the other person"** (resolved in Clarifications). A completion pings the household member who did *not* complete it, so each person learns what their partner finished (mental-load awareness). A `both`-owned task completed by one person still pings the other; the completer is never pinged for their own completion (FR-003).
- **Per-person private topics from Settings.** `ntfyTopicMax` / `ntfyTopicJaz` already exist as Settings keys (seeded for this feature); each person subscribes only to their own on their device. A blank topic means "don't ping this person."
- **Reuses the existing completion path and idempotency.** The ping hangs off the same completion action the app already exposes, keyed on the real state-change signal that path already returns, so re-fires don't double-ping.
- **Completer is the resolved person**, never the raw shared account — consistent with [[allowlist-three-emails]] (shared is never an actor).
- **Best-effort, fire-and-forget.** The notification is a side effect of completion; its success is not required for completion to succeed, and its failure is logged/swallowed rather than propagated.
- **ntfy.sh is the free, keyless transport** named in the constitution/stack; no accounts, no paid tier, no server. Web push to the installed PWA is a separate later feature (010).
- **Volume is tiny** — two people, a handful of completions a day — so there are no batching, rate-limit, or performance concerns beyond ntfy.sh's own free limits.
- **One-way, outbound only.** This feature only sends pings; it does not receive or act on any inbound message.
