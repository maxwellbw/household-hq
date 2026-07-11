# Feature Specification: Stay Signed In (Session Persistence)

**Feature Branch**: `018-stay-signed-in`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Stay signed in (session persistence). Google ID tokens live ~1 hour and the app currently holds them in memory only, so every visit re-prompts for sign-in — worst on mobile. Persist the household member's session across visits and silently re-acquire tokens (GIS auto-select / One Tap re-prompt) so signing in is rare rather than routine. Two users only (Max + Jaz), Google Identity Services auth against the Settings allowlist. Pairs naturally with the later PWA feature (010)."

## Clarifications

### Session 2026-07-11

- Q: How should the session be persisted client-side? → A: Auto-select only, no token — rely on Google's silent auto re-sign-in plus a remembered acting person in local device storage; store no credential.
- Q: How should an expired credential be refreshed during a long-open session? → A: Reactive on auth failure — when an authenticated request fails on a stale credential, silently re-acquire once and retry the request transparently.
- Q: When a shared-account user returns, how should the remembered acting person be handled? → A: Restore it, but surface a dismissible "Signed in as <person> — switch?" affirmation each session.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning to the app stays signed in (Priority: P1)

Max (or Jaz) signed in yesterday. Today they open the app — on their phone home screen, a
new browser tab, or after the device slept overnight. Instead of being greeted by the
"Sign in with Google" wall, the app recognizes them and brings them straight to the Home
dashboard, ready to use, without a tap.

**Why this priority**: This is the entire point of the feature. The friction being removed
is the sign-in prompt on every single visit, which is felt most on mobile where the app is
used in short bursts. If only this story ships, the feature has delivered its core value.

**Independent Test**: Sign in once. Close the tab/app completely (and let more than an hour
pass, or simulate token expiry). Reopen the app. Verify the user lands on the dashboard as
the same household member with no interactive sign-in step.

**Acceptance Scenarios**:

1. **Given** a user who previously signed in successfully, **When** they reopen the app in
   a new session (fresh tab, relaunched browser, or returning after the app was closed),
   **Then** they are shown the app as the signed-in household member without having to tap
   a sign-in button.
2. **Given** a user who previously signed in as the shared household account and resolved
   themselves to Max or Jaz, **When** they reopen the app, **Then** they return already set
   to that same acting person and see a dismissible "Signed in as <person> — switch?"
   affirmation rather than a blocking "Are you Max or Jaz?" prompt.
3. **Given** a returning user whose silent re-authentication is briefly in progress, **When**
   the app is loading, **Then** they see a calm loading state (not the sign-in wall and not
   a broken/empty screen) until the session is restored.

---

### User Story 2 - Long sessions never interrupt work (Priority: P2)

Jaz has the app open while planning the week. More than an hour passes with the tab open in
the background. She comes back and adds a task. The stale credential behind the scenes has
already been quietly refreshed, so her action succeeds instead of bouncing her to a sign-in
screen mid-task.

**Why this priority**: Prevents the second-worst version of the friction — losing an
in-progress action to an expired credential. Valuable, but secondary to simply not being
re-prompted on every fresh visit (Story 1).

**Independent Test**: Sign in, leave the app open past credential expiry (~1 hour, or
simulate expiry), then perform a write action (create/complete a task). Verify the action
succeeds without an interactive sign-in and without data loss.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose credential has expired while the app was open, **When**
   they perform any action that requires authentication, **Then** the credential is
   re-acquired silently and the action completes, with no interactive sign-in prompt.
2. **Given** a signed-in user idle past credential expiry, **When** the app next needs a
   valid credential, **Then** it obtains a fresh one in the background before the user
   notices any interruption.

---

### User Story 3 - Signing out and account safety still work (Priority: P3)

Either user can still deliberately sign out (e.g., handing the phone to a guest), and doing
so must actually end the persisted session — the next visit shows the sign-in wall, not an
automatic re-entry. And if silent re-authentication ever cannot succeed (revoked access,
switched Google account, someone removed from the allowlist), the app falls back cleanly to
the normal sign-in flow rather than looping or showing an error.

**Why this priority**: Correctness and trust guardrails around the persistence. Lower
priority because it's about the edges, but the feature is not shippable without them — a
"stay signed in" that can't be turned off, or that traps a removed user, would be wrong.

**Independent Test**: (a) Sign in, then sign out; reopen the app and verify the sign-in wall
appears with no auto re-entry. (b) Sign in, then revoke the app's access / remove the email
from the allowlist; reopen and verify a clean fall-back to sign-in (or a clear "not allowed"
message), never an infinite prompt loop.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they choose Sign Out, **Then** the persisted session
   is cleared and the next app open shows the interactive sign-in wall with no automatic
   re-entry.
2. **Given** a user whose access was revoked or whose email is no longer on the allowlist,
   **When** they reopen the app, **Then** silent re-authentication does not loop; the app
   presents the sign-in wall or a clear not-authorized message.
3. **Given** a device where automatic sign-in is unavailable (silent re-auth declined by the
   identity provider), **When** the user opens the app, **Then** they see the normal sign-in
   button and can sign in with one tap.

---

### Edge Cases

- **Credential expires between app open and first action**: The app must present a valid
  credential for the first authenticated call, refreshing silently if the restored one is
  already stale.
- **Two different Google accounts on one device**: If the user is signed into multiple
  Google accounts in the browser, automatic sign-in should re-select the account previously
  used for this app; if it cannot, it falls back to the sign-in prompt rather than guessing.
- **Persisted acting-person becomes invalid**: If a restored acting-person value is no longer
  meaningful (e.g., allowlist changed, or the freshly acquired identity is a personal account
  that already maps to a specific person), the app re-resolves who the user is rather than
  trusting stale data. The affirmation reflects the re-resolved person, not the stale one.
- **Silent re-auth repeatedly fails**: The app must not enter a prompt/retry loop; after a
  failed silent attempt it settles on the interactive sign-in wall.
- **Corrupted or partial persisted session data**: Unreadable stored session state is treated
  as "not signed in" and the user is taken to the normal sign-in flow, never a crash.
- **First-ever visit (nothing persisted)**: Behaves exactly as today — the sign-in wall.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a household member who has previously signed in to return
  in a later session and reach the app as that member without an interactive sign-in step,
  whenever the identity provider permits silent re-authentication.
- **FR-002**: The app MUST silently re-acquire a fresh credential when the current one is
  missing or expired — without showing an interactive sign-in prompt in the normal case. On
  app open the credential is acquired before the first authenticated request; during a
  long-open session, expiry is handled **reactively**: when an authenticated request fails
  because the credential is stale, the app re-acquires a fresh credential once and retries
  the same request transparently.
- **FR-003**: The app MUST persist enough session context across full app restarts to restore
  the signed-in experience, including which household member is the acting person when the
  shared household account was used.
- **FR-004**: The app MUST restore the previously chosen acting person (Max or Jaz) on return
  so a returning shared-account user is not re-asked who they are; instead it MUST show a
  dismissible affirmation ("Signed in as <person> — switch?") that lets them correct the
  acting person in one tap if it is wrong, without blocking use of the app.
- **FR-005**: The app MUST present a calm loading/transition state while a session is being
  restored, distinct from both the signed-in app and the signed-out sign-in wall.
- **FR-006**: When silent re-authentication cannot succeed, the app MUST fall back to the
  existing interactive sign-in flow (sign-in button / prompt) without looping or erroring.
- **FR-007**: Signing out MUST clear all persisted session context such that the next app
  open shows the interactive sign-in wall with no automatic re-entry, and MUST disable
  automatic re-selection of the account for this app.
- **FR-008**: The app MUST continue to enforce the existing two-email allowlist on every
  authenticated request; persistence MUST NOT bypass or weaken authorization, and a user
  removed from the allowlist MUST NOT be silently re-admitted.
- **FR-009**: The app MUST NOT persist any credential (including the short-lived identity
  token) to durable device storage. Persisted data is limited to (a) an indicator that
  automatic re-sign-in should be attempted and (b) the chosen acting person; the credential
  itself is always re-acquired fresh at runtime and held in memory only.
- **FR-010**: Every state change already logged today (create, complete, snooze, etc.) MUST
  continue to attribute to the correct acting person after a session is restored — session
  restoration MUST NOT break actor attribution in ActivityLog.
- **FR-011**: The behavior MUST hold on both mobile and desktop browsers, and MUST NOT
  regress the first-time sign-in experience for a user with nothing persisted.

### Key Entities *(include if feature involves data)*

- **Persisted session context**: The minimal client-side record that a user was signed in and
  who they are acting as. Key attributes: an indicator that automatic re-sign-in should be
  attempted, and the chosen acting person (`max` or `jaz`) when relevant. It explicitly does
  **not** include any durable credential that itself grants access; the actual authorization
  is always re-derived from a freshly acquired, server-verified credential against the
  allowlist.
- **Active session**: The in-memory authenticated state (current credential + identified
  household member + acting person) the app already maintains during use. This feature adds
  the ability to rebuild it on app open and to refresh its credential without user
  interaction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning user who signed in within the recent past reaches the usable app on
  reopen without any interactive sign-in tap in at least the common case (same device, same
  browser, access not revoked).
- **SC-002**: Reopening the app after credential expiry no longer shows the sign-in wall in
  the normal case; restoration completes in a few seconds and lands on the dashboard.
- **SC-003**: An authenticated action taken after the credential has expired mid-session
  succeeds without an interactive sign-in and without losing the user's input.
- **SC-004**: Interactive sign-in prompts drop from "every visit" to only: first-ever use,
  after explicit sign-out, or after access is revoked/expired beyond silent recovery.
- **SC-005**: Explicit sign-out reliably returns the app to the sign-in wall on next open,
  100% of the time, with no automatic re-entry.
- **SC-006**: A user removed from the allowlist or with revoked access is never silently
  admitted and never trapped in a prompt loop.

## Assumptions

- The identity provider (Google Identity Services) supports silent/automatic re-selection of
  the previously used account for this app; when it declines (its own policy, multiple
  accounts, cleared browser state), interactive sign-in is the accepted fallback — this
  feature makes re-prompting rare, not impossible.
- The existing backend credential verification and two-email allowlist check are reused
  unchanged; this is a frontend session-lifecycle feature, not a change to how the backend
  authenticates or authorizes.
- No server-side session store is introduced; the free-tier, Sheet-as-database, stateless
  web-app model is preserved. "Persistence" means lightweight client-side state plus provider
  auto-select, not a backend session.
- The shared household account continues to resolve to a specific person (Max or Jaz) per the
  existing acting-person mechanism; this feature only remembers that choice across visits.
- Persisted client-side state is acceptable to store on the user's own device; the two device
  owners are the only intended users, and the persisted data grants no standing access on its
  own (authorization is always re-verified server-side).
- The single household timezone and all existing dating rules are unaffected.
