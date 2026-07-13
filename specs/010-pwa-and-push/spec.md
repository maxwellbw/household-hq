# Feature Specification: PWA Install + Web Push

**Feature Branch**: `010-pwa-and-push`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "PWA install + web push notifications. Make Household HQ a fully installable Progressive Web App on the GitHub Pages deploy (manifest + service worker) so Max and Jaz can add it to their iPhone/desktop home screens and it opens signed-in (building on 018's session persistence). Add web-push notifications so the household can receive pushes even when the app is closed — replacing/augmenting the current ntfy.sh pings from feature 009 with real web push for notification quality (this is round-4 feedback item 7). Scope: manifest completeness (proper icons at required sizes, maskable icon, standalone display), a service worker for offline shell caching and to receive push events, a subscribe/unsubscribe UI for enabling notifications per device, storing push subscriptions, and the backend sending web-push messages for the same events that currently trigger ntfy pings (task completions, digests, reminders). Two users, iPhone Safari is the primary install target."

## Clarifications

### Session 2026-07-13

- Q: When a person has web push enabled, how should it interact with the existing ntfy.sh ping (feature 009) for the same event? → A: Web push **fully replaces** ntfy — ntfy is removed in this feature; web push is the only notification channel. A recipient with no push-enabled device receives no notification for that event.
- Q: Which events should send web push in this feature? → A: Match ntfy exactly — only the instant events ntfy handles today (open→done completion ping + "has it" ack). Email digests stay email (feature 008); no reminder engine is built.
- Q: When someone taps a push notification, where should the app open? → A: Deep-link to the related item (task/day) when the push carries an id; fall back to the Home dashboard otherwise.
- Q: How should each subscribed device be labeled in storage? → A: Auto-derive an approximate label from the browser/user agent at subscribe time (e.g. "iPhone Safari"); no manual naming step.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install Household HQ to the home screen (Priority: P1)

Max or Jaz opens Household HQ in mobile Safari (or desktop Chrome), uses the browser's "Add to Home Screen" / "Install" flow, and gets a real app icon. Launching from that icon opens the app full-screen (no browser chrome, no address bar), already signed in, straight to the Home dashboard.

**Why this priority**: The installed, standalone, signed-in shell is the foundation everything else in this feature depends on — iPhone web push only works from an installed PWA, and the whole point of the feature is making Household HQ feel like a real household app rather than a bookmarked website. It delivers standalone value even before push is wired up.

**Independent Test**: Add the deployed site to the iPhone home screen; confirm the icon is the correct household glyph (not a screenshot thumbnail), the app opens full-screen with the warm background color while loading, respects the safe area, and lands on the signed-in Home view without a fresh sign-in prompt.

**Acceptance Scenarios**:

1. **Given** the deployed site loaded in mobile Safari, **When** the user chooses "Add to Home Screen", **Then** the suggested name is "Household HQ" and the chosen icon is the app's own maskable icon at full resolution.
2. **Given** the app was installed while signed in, **When** the user later taps the home-screen icon, **Then** the app launches in standalone display and shows the signed-in Home dashboard without re-authenticating.
3. **Given** the app is launched from the home-screen icon while offline, **When** it opens, **Then** the app shell (layout, styles, icon, a recognizable offline state) renders rather than a browser "no internet" error page.
4. **Given** the app is open in a normal browser tab, **When** it has not yet been installed, **Then** the app still works exactly as it does today (installation is additive, never required).

---

### User Story 2 - Enable notifications on this device (Priority: P1)

From inside the app (a Settings/notifications control), Max or Jaz turns on "Notifications on this device." The app requests OS notification permission, and once granted, this device is registered to receive pushes. A matching control lets them turn notifications back off for that device.

**Why this priority**: Push is worthless without a per-device opt-in, and browsers require the permission request to come from an explicit user action. Each person may use several devices (phone, laptop), so enabling is inherently per-device. This story makes the household's devices addressable.

**Independent Test**: On an installed iPhone PWA, open notification settings, tap "Enable notifications," accept the OS prompt, and confirm the control now shows this device as subscribed; tap "Disable" and confirm it unsubscribes. Verify the person↔device association is recorded so the backend knows which human this subscription belongs to.

**Acceptance Scenarios**:

1. **Given** notifications are off on this device, **When** the user taps "Enable notifications" and grants the OS permission prompt, **Then** the control shows notifications as on for this device and the subscription is stored server-side against the signed-in person.
2. **Given** the user denies (or has previously denied) the OS permission prompt, **When** they attempt to enable, **Then** the app shows a calm explanation of how to re-enable it in device settings rather than silently failing.
3. **Given** notifications are on for this device, **When** the user taps "Disable notifications," **Then** the OS subscription is removed and the stored subscription is deleted server-side so no further pushes are sent to it.
4. **Given** the same person enables notifications on a second device, **When** they do so, **Then** both devices are stored and addressable independently (disabling one leaves the other working).

---

### User Story 3 - Receive a push when the app is closed (Priority: P2)

When a household event fires that today sends an ntfy ping — the other person completes a task, or someone acknowledges "I've got it" — the recipient's enabled devices get a native push notification even if the app is fully closed. Tapping the notification opens Household HQ directly to the related item. Web push is now the household's only notification channel; the ntfy.sh pings from feature 009 are retired.

**Why this priority**: This is the actual payoff — reliable, native, closed-app notifications that don't depend on the separate ntfy app being installed and its topic configured. It depends on Stories 1 and 2 being in place, so it is P2.

**Independent Test**: With the iPhone PWA installed and notifications enabled for Jaz, have Max complete a task assigned appropriately; confirm Jaz's phone shows a native notification with a sensible title/body within a short delay, and that tapping it opens the app.

**Acceptance Scenarios**:

1. **Given** the recipient has at least one device with notifications enabled, **When** an event fires that currently triggers an ntfy ping, **Then** each of that recipient's enabled devices receives a native push with a title and one-line body matching the meaning of today's ping.
2. **Given** the app is fully closed (not backgrounded), **When** a push arrives, **Then** the notification still displays via the service worker.
3. **Given** a stored subscription is no longer valid (the user removed the app or the browser expired it), **When** the backend attempts to send to it, **Then** that dead subscription is pruned and the failure never disrupts the underlying action (the task still completes).
4. **Given** the recipient taps a notification that carries a related item id, **When** the app opens, **Then** it deep-links to that item (the task/day); when no id is present it opens to the Home dashboard.
5. **Given** the recipient has **no** push-enabled device, **When** an event fires, **Then** no notification is sent to them (there is no ntfy fallback) and the underlying action still succeeds.

---

### Edge Cases

- **iOS not-yet-installed**: iPhone Safari only allows web push from an installed (home-screen) PWA. In a normal Safari tab on iOS, the "Enable notifications" affordance must explain that the app has to be added to the home screen first, rather than offering a prompt that cannot succeed.
- **Permission previously denied**: the browser will not re-prompt; the UI must detect the denied state and guide the user to OS settings.
- **Multiple devices, partial enablement**: a person with notifications on their phone but not their laptop should get pushes only on the phone; the laptop must not be counted as subscribed.
- **Recipient with no enabled device**: since web push fully replaces ntfy, a recipient who has not enabled notifications on any device gets no notification for the event — the app must make it clear (during opt-in / migration) that notifications now require enabling push, so no one silently stops being notified.
- **Stale/duplicate subscriptions**: re-enabling on the same device, or the browser rotating its push endpoint, must not create orphaned duplicate subscriptions that each send a copy.
- **Offline launch then action**: opening from the icon while offline should show the cached shell; actions that need the network should fail gracefully, not crash the shell.
- **Icon/splash correctness on iOS**: iOS ignores some manifest fields and needs its own apple-touch-icon; a wrong or missing icon shows a blurry screenshot instead of the app glyph.
- **Send fan-out within limits**: sending to several subscriptions for an event must complete within the backend's per-run execution budget and never block the user action it follows.

## Requirements *(mandatory)*

### Functional Requirements

**Installable PWA shell**

- **FR-001**: The deployed site MUST present a complete, valid web app manifest (name, short name, standalone display, start URL and scope matching the Pages sub-path deploy, theme/background colors matching the app's warm palette).
- **FR-002**: The app MUST provide app icons at the sizes required for install on iOS and desktop, including a maskable icon and an iOS home-screen icon, rendered as the household glyph (never an auto-generated screenshot).
- **FR-003**: The app MUST register a service worker that caches the app shell so a launch from the installed icon renders the UI (and a graceful offline state) without a network round-trip.
- **FR-004**: When launched from the installed icon, the app MUST open in standalone display, respect device safe areas, and show the warm background color during load (no white flash, no browser chrome).
- **FR-005**: Installation MUST be entirely additive — the app MUST continue to work identically as a normal browser tab for anyone who has not installed it, and the service worker MUST NOT serve stale UI after a new version deploys (updates must be picked up).
- **FR-006**: A launch from the installed icon MUST arrive signed-in when a valid persisted session exists (building on feature 018), with no extra sign-in step versus the browser-tab experience.

**Per-device notification opt-in**

- **FR-007**: The app MUST provide an in-app control to enable and disable push notifications for the current device, reachable from a sensible place (e.g. Settings / More).
- **FR-008**: Enabling MUST be triggered by an explicit user action that requests OS notification permission, and MUST only register the device after permission is granted.
- **FR-009**: On a successful enable, the system MUST store the device's push subscription server-side, associated with the currently signed-in person (max or jaz) and an auto-derived device label from the browser/user agent (e.g. "iPhone Safari"), so the backend can later target and distinguish that person's devices. No manual device-naming step is required.
- **FR-010**: Disabling MUST remove the subscription both on the device and server-side so no further pushes are delivered to it.
- **FR-011**: The system MUST support multiple devices per person and MUST address each independently; the same person enabling on two devices results in two independently-manageable subscriptions.
- **FR-012**: The control MUST reflect the true current state (on / off / blocked-by-OS / unsupported-on-this-platform) and, when blocked or unsupported, MUST explain the next step (e.g. "add to home screen first" on iOS, "re-enable in device settings" when denied) rather than offering a dead button.

**Sending web push**

- **FR-013**: For each event that today triggers an ntfy ping (a task genuinely transitioning open→done, and an "I've got it" acknowledgment), the backend MUST send a web push to every enabled device of the intended recipient. Web push is the sole channel for these events.
- **FR-014**: Push delivery MUST be best-effort and MUST NOT affect the action it hangs off of — the task completion (or ack) always succeeds even if every push fails (or the recipient has no enabled device), preserving the guarantee ntfy provided.
- **FR-015**: Each push MUST carry a human-readable title and one-line body matching the meaning of the retired ntfy message (e.g. "Max completed: Take out recycling", "Jaz has it: Pick up the dog"), plus enough context to deep-link the recipient to the related item (task/day) when they tap it; a push without such context opens the Home dashboard.
- **FR-016**: The backend MUST prune subscriptions that the push service reports as gone/expired, so dead devices are cleaned up automatically and not retried forever.
- **FR-017**: Sending to a recipient's devices MUST complete within the backend's per-run execution budget and MUST be idempotent/safe under the existing re-run and locking model (a single completion never produces duplicate pushes to the same device).
- **FR-018**: A household-level setting MUST allow web push to be turned off globally (replacing the feature-009 ntfy on/off setting), and each state change that sends pushes MUST be recorded in the activity log consistent with how notifications are logged today.
- **FR-019**: This feature MUST retire the ntfy.sh channel (feature 009): the ntfy send path, its per-person topic settings, and its enable flag are removed or superseded so that web push is the only notification channel, with no dead ntfy configuration left implying notifications still route through it.
- **FR-020**: Tapping a notification MUST open (or focus, if already open) the installed app and route it to the deep-linked item when present, reusing an existing window rather than spawning duplicates.

### Key Entities *(include if feature involves data)*

- **Push Subscription**: One record per enabled device. Represents the browser/OS push endpoint plus the keys needed to deliver an encrypted push to it, the person (max/jaz) it belongs to, an auto-derived device label, and when it was created/last used. The backend targets a person by looking up all of their subscriptions.
- **Notification Event (existing, re-channeled)**: The already-defined moments that produce a notification (task completion, "has it" ack). This feature switches their delivery channel from ntfy to web push; the events themselves are unchanged.
- **Notification Settings (existing, replaced)**: The household settings that gate notifications. The feature-009 `ntfyEnabled` flag and per-person ntfy topics are retired and superseded by a single household-level web-push on/off switch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Max and Jaz can each install Household HQ to an iPhone home screen and, on tapping the icon, reach the signed-in Home dashboard in under 3 seconds with no sign-in step and no browser chrome.
- **SC-002**: The installed icon and splash show the app's own household glyph and warm background color — verified on a real iPhone — with no blurry screenshot fallback.
- **SC-003**: A person can enable notifications on a device in under 30 seconds via a single, obvious control, and can turn them off again just as easily.
- **SC-004**: When one person completes a task, the other person's enabled device shows a native notification while the app is fully closed, within roughly a minute, in at least 9 of 10 attempts on the primary iPhone target.
- **SC-005**: Removing the app or disabling notifications results in no further pushes to that device, and no user-visible errors are produced by attempts to push to a device that has gone away.
- **SC-006**: Turning off web push at the household level stops all pushes while leaving the rest of the app fully functional.
- **SC-007**: Zero regressions to the un-installed browser-tab experience: every existing flow works the same whether or not the app is installed.

## Assumptions

- **Builds on 018 session persistence**: a launch from the installed icon inherits the same persisted session mechanism shipped in feature 018 (session tokens); this feature does not change auth, only ensures the standalone launch reaches it.
- **Web push fully replaces ntfy (feature 009)** (clarified): ntfy's send path, per-person topics, and enable flag are retired in this feature; web push becomes the only notification channel. Consequence: a recipient with no push-enabled device gets no notification, so the opt-in flow must make enabling push discoverable so no one silently loses notifications.
- **"Events" = the existing instant ntfy triggers** (clarified): the notification events in scope are exactly the ones ntfy handles today (open→done completion ping and the "has it" ack). Email digests (feature 008) remain email; there is no separate reminder engine to hook. Adding push for digests or net-new reminder types is out of scope for this feature (candidate for a later batch).
- **Two devices per person is the practical ceiling** (phone + laptop each), but the model does not hard-cap device count.
- **iPhone Safari (installed PWA, iOS 16.4+) is the primary and must-work target**; desktop Chrome/Edge is a supported secondary; the model treats all as generic web-push subscriptions.
- **Subscriptions are stored in the Sheet-as-DB**, following the existing one-tab-per-table convention, and remain human-readable/hand-editable like every other tab.
- **Notification content mirrors ntfy exactly** for parity in this feature; richer notification content (actions, images, deep links beyond opening the app) is out of scope.
- **The deploy remains GitHub Pages** at the existing project sub-path; the manifest scope/start URL must match that sub-path, and the service worker must be scoped correctly under it.
- **The backend sending mechanism must fit Apps Script's constraints** (dependency-free, `UrlFetchApp` only, 6-minute run budget); any cryptographic requirement of web push must be satisfiable within those constraints — this is a real technical risk to resolve in planning, not a scope question.
