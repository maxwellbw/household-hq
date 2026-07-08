# Feature Specification: Auth Allowlist

**Feature Branch**: `002-auth-allowlist`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Feature 002 auth-allowlist — identity verification and two-user allowlist enforcement, from brief §2 and §5 item 1. Every API call must carry a verifiable Google identity; the backend verifies the ID token and checks the email against the two-address allowlist in Settings; anyone else is rejected with a structured error. Actor attribution switches from declared to verified identity. The sign-in UI ships with the frontend (feature 006), but this feature defines the contract: token acquisition, expiry/refresh expectations, and rejection UX requirements. Must also resolve risk R1 from 001's research (web-app deployment mode for browser cross-origin calls), updating CLAUDE.md. Envelope shape from 001's contract must not change."

## Clarifications

### Session 2026-07-08

- Q: The allowlist — "exactly two" emails as written, or the three confirmed caller
  accounts? → A: **Three** emails are all valid callers: Max's personal account, Jaz's
  personal account, and the shared household account (`household@example.com`). The
  household is still two people; the shared account is infrastructure they both use
  (owns the Sheet/Script, runs `clasp`). The spec's "exactly two" language is corrected
  throughout.
- Q: What actor is recorded when a caller authenticates *as the shared account* and
  makes a write? → A: The shared account is **never itself an actor**. A shared-account
  write must be disambiguated to a specific person — the client confirms "Max or Jaz?"
  and the write is re-associated to that individual's canonical identity (`max`/`jaz`).
  A shared-account write that arrives without a confirmed acting-person is rejected (no
  guessing, nothing written). Reads and who-am-I need no disambiguation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only Max and Jaz can touch household data (Priority: P1)

Every request to the household service proves who is making it. If the proven identity
is one of the household's allowlisted accounts, the request proceeds and is attributed
to a person (Max or Jaz); anyone else — no identity, a forged identity, or a valid
Google identity that isn't on the allowlist — is rejected with a clear, structured
refusal and no data access of any kind.

**Why this priority**: The service moves from "private by obscurity" (001's interim
posture) to actually enforced. Nothing else in the product is trustworthy until
identity is.

**Independent Test**: Call the service three ways — as an allowlisted user, with no
credential, and with a valid credential for a non-allowlisted account — and confirm:
full access, structured rejection, structured rejection, with nothing leaked in the
rejections.

**Acceptance Scenarios**:

1. **Given** a request carrying a valid credential for an allowlisted email, **When**
   any operation is invoked, **Then** it executes and the result is returned normally.
2. **Given** a request with a missing or empty credential, **When** any operation
   other than the public health ping is invoked, **Then** it is refused with a
   structured error distinguishing "no credential" from other failures, and no read or
   write occurs.
3. **Given** a request with an expired, malformed, or tampered credential, **When** any
   operation is invoked, **Then** it is refused with a structured error and no read or
   write occurs.
4. **Given** a request with a *valid* credential for an email not on the allowlist,
   **When** any operation is invoked, **Then** it is refused with a structured error
   that does not reveal household data, the allowlist contents, or why the specific
   email was rejected beyond "not authorized."
5. **Given** the health ping, **When** called with no credential, **Then** it still
   answers (it exposes only service name and version — nothing household-specific).

---

### User Story 2 - Every change is attributed to a verified person (Priority: P1)

When Max or Jaz creates, edits, completes, or deletes anything, the record of who did
it comes from their verified identity — never from what the client claimed. The
activity feed's "who did what" is therefore trustworthy.

**Why this priority**: Completion awareness is a core product promise; it's only as
good as the attribution. 001 explicitly took actors on trust as an interim measure —
this story ends that.

**Independent Test**: Perform a write as each user; confirm the activity log actor
matches the verified identity in both cases, and that a client claiming to be someone
else in the request body is either ignored or rejected — the verified identity always
wins.

**Acceptance Scenarios**:

1. **Given** Jaz makes any state change, **When** the activity log row is written,
   **Then** its actor is `jaz` — derived from her verified identity, regardless of
   anything else in the request.
2. **Given** a request whose body claims a different actor than the verified identity,
   **When** processed, **Then** the verified identity is used for attribution (the
   claim is ignored).
3. **Given** a completed task, **When** completion is recorded, **Then** completedBy
   reflects the verified identity.

---

### User Story 3 - Signing in is a once-in-a-while act, not a chore (Priority: P2)

Each user signs in with their own personal Google account. Once signed in on a device,
they stay signed in across visits; when a credential quietly expires mid-session, the
app recovers without losing the user's work or dumping them to an error screen. A
rejected stranger sees a polite "this is a private household app" message, not a broken
page.

**Why this priority**: The product is a phone-first tool used in stolen moments;
friction at the door kills adoption by its only two users. This story defines the
contract the frontend (feature 006) will implement — the experience requirements are
set here even though the screens ship later.

**Independent Test**: Contract-level in this feature: the service's rejection errors
are distinguishable enough (no credential vs. expired vs. not allowed) for a client to
implement silent re-authentication and correct messaging. Verifiable end-to-end once
feature 006 ships.

**Acceptance Scenarios**:

1. **Given** an expired-credential rejection, **When** a client receives it, **Then**
   the error is programmatically distinguishable from "not on the allowlist," so the
   client can silently obtain a fresh credential and retry rather than show an error.
2. **Given** a user identified as Max, **When** the client asks "who am I," **Then**
   the service answers with his canonical identity (`max`) and display info, so views
   can default to "my stuff + our stuff."
3. **Given** a non-allowlisted person signs in, **When** the client learns of the
   rejection, **Then** the defined UX requirement is a friendly private-app message
   with no household data and no retry loop.

---

### Edge Cases

- The Settings allowlist is hand-edited to malformed content (a blank entry, a typo'd
  address, a stray duplicate): the service fails **closed** for any caller whose verified
  email is not an exact, well-formed match, and surfaces a configuration error to
  allowlisted callers (or in logs), never fails open.
- The allowlist is blank (fresh provisioning, never filled in): every authenticated
  request is rejected with a configuration error; the health ping still works. The fix
  is documented: fill in Settings by hand.
- A write arrives authenticated as the shared account with no confirmed acting-person:
  rejected with a distinguishable "which person?" error so the client can prompt and
  retry; nothing is written and no actor is guessed.
- A credential is valid but for the right person's *other* Google account (work vs.
  personal): rejected like any non-allowlisted identity — the allowlist is exact
  emails, not people.
- Email case differences (`Max@…` vs `max@…`): matching is case-insensitive per email
  conventions.
- A replayed/stolen credential presented after expiry: rejected as expired; expiry
  windows are those of the identity provider (short-lived), and this is accepted
  residual risk for a two-person household app.
- The provisioning/setup routine and scheduled triggers (features 004+) act without a
  user credential: their writes are attributed to `system` and do not pass through
  allowlist checks (they are not reachable from outside).
- Clock skew makes a just-issued credential look not-yet-valid: tolerate standard
  small skew; document the failure mode.

## Requirements *(mandatory)*

### Functional Requirements

**Enforcement**

- **FR-001**: Every operation except the public health ping MUST require a verifiable
  identity credential from the caller's own Google sign-in; requests without one are
  rejected before any data is read or written.
- **FR-002**: The service MUST cryptographically verify the credential's authenticity,
  integrity, intended audience, and validity window — a credential that fails any
  check is rejected identically to a missing one, save for a distinguishable error
  code.
- **FR-003**: The verified email MUST be checked (case-insensitively) against the
  allowlisted addresses stored in Settings — the two personal accounts (Max, Jaz) plus
  the shared household account; any other email is rejected with a structured "not
  authorized" error carrying no household information.
- **FR-004**: Rejections MUST be structured errors in 001's response envelope, with
  distinguishable codes for at minimum: missing credential, invalid/expired credential,
  not on allowlist, allowlist misconfigured, and shared-account write missing a
  confirmed acting-person (FR-014).
- **FR-005**: An unreadable or empty allowlist (no well-formed entries) MUST fail
  closed: unknown callers are rejected; the error surfaced is a configuration problem,
  not an authorization success. A well-formed entry is an exact, valid email; extra or
  hand-added entries do not open access — only exact matches to the maintained list
  authorize.
- **FR-006**: The request envelope from 001 MUST NOT change shape: the existing
  credential slot is simply enforced now. Existing clients change behavior only in
  that empty credentials stop working.

**Attribution**

- **FR-007**: The actor recorded on every state change (activity log, completedBy) MUST
  derive from the verified identity, mapped to the canonical short identity
  (`max`/`jaz`). A verified **personal** account maps directly and any client-declared
  actor is ignored. A verified **shared-account** identity does not resolve to a single
  person: the request MUST carry a confirmed acting-person (`max` or `jaz`), and that
  value is used for attribution; the shared account is never itself recorded as an
  actor.
- **FR-008**: Internal, non-user-initiated writes (provisioning, future scheduled
  generation) MUST be attributed to `system` and MUST NOT be invocable through the
  public interface.
- **FR-009**: The service MUST offer a "who am I" operation returning the caller's
  canonical identity and display name. For a personal account this is `max`/`jaz`; for
  the shared account it reports that the caller is the shared household account with no
  single canonical person, signaling the client to ask "Max or Jaz?" before any write.
- **FR-014**: When authenticated as the shared account, a **write** operation MUST be
  accompanied by a confirmed acting-person (`max`/`jaz`); the service rejects a
  shared-account write that omits it with a distinguishable error so the client can
  prompt "Max or Jaz?" and retry — nothing is written and no actor is guessed. Reads and
  who-am-I require no acting-person. The acting-person is carried in the request without
  altering 001's fixed envelope (consistent with FR-006); the confirmation UX ships with
  feature 006, but the field and rejection code are defined here.

**Contract for the future sign-in UI (implemented in feature 006, defined here)**

- **FR-010**: The credential lifecycle contract MUST be documented in this feature:
  how a client obtains a credential at sign-in, that credentials are short-lived, and
  that clients are expected to refresh silently and retry on the "expired" error code
  without user-visible disruption.
- **FR-011**: The defined rejection UX for non-allowlisted sign-ins is a friendly
  static "this is a private household app" message — no data, no allowlist hints, no
  automatic retry.

**Deployment decision (resolves 001 research risk R1)**

- **FR-012**: This feature MUST decide and record the service deployment/access mode
  such that browser calls from the app's web origin receive JSON (not an interactive
  sign-in redirect), while all real gating is performed by the credential + allowlist
  checks above. The decision and its rationale go in this feature's plan; CLAUDE.md
  and initial-setup.md MUST be updated in the same change if the decision differs from
  what they currently instruct.

**Audit**

- **FR-013**: Rejected requests MUST NOT write household data or activity rows
  (consistent with 001's "log records what happened, not what was attempted"), but
  MUST be observable to maintainers via service logs sufficient to notice a pattern of
  strangers knocking.

### Key Entities

- **Identity credential**: Short-lived proof, issued by the user's own Google sign-in,
  that a request comes from a specific email; carried in the existing envelope slot;
  verified server-side on every call.
- **Allowlist**: The Settings addresses permitted to call the service — the two personal
  accounts (Max, Jaz) plus the shared household account (hand-maintained); the sole
  authorization rule in the entire system, per constitution Principle I (the household is
  still two people; the shared account is infrastructure they both use).
- **Canonical identity**: The short person value (`max` | `jaz`) used everywhere data
  records who acted. Each personal email maps to exactly one; the shared account maps to
  neither and must be resolved to one per write via a confirmed acting-person. `system`
  is reserved for non-user writes and is not a sign-in identity.
- **Acting-person**: For a shared-account write, the confirmed `max`/`jaz` value that
  says which of the two people is acting; supplied by the client in the request, required
  on writes, ignored (and unnecessary) for personal-account callers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of data-touching operations refuse callers without a valid,
  allowlisted identity — verified by attempting every operation in all three rejection
  modes (none, invalid, valid-but-unlisted) with zero data access.
- **SC-002**: 100% of state changes are attributed to a real person (`max`/`jaz`):
  personal-account writes use the verified identity and ignore any false client claim;
  shared-account writes use the confirmed acting-person and are never recorded as the
  shared account. No write is ever mis-attributed to a false claim.
- **SC-003**: The two allowlisted users complete normal operations with no new
  per-request friction: after the one-time sign-in, day-to-day use requires zero
  additional credential prompts in a typical week of use (silent refresh absorbs
  expiry).
- **SC-004**: A rejected outsider learns nothing: rejection responses contain no
  household data, no allowlisted addresses, and are indistinguishable in content
  between "wrong person" cases beyond the documented error codes.
- **SC-005**: Authorization checking adds no perceptible delay: end-to-end operation
  time stays within 001's five-second budget.
- **SC-006**: With a deliberately corrupted allowlist, 100% of unknown callers are
  still rejected (fail-closed verified by test).

## Assumptions

- Feature 001 is implemented and deployed first: the envelope's credential slot, error
  envelope, Settings tab, and ActivityLog exist.
- Google account sign-in is the only identity mechanism (constitution Platform
  Constraints); no passwords, sessions, or API keys are introduced.
- The allowlist continues to be maintained by hand in Settings; there is no UI for it,
  ever (two users forever).
- "Display name" in the who-am-I response comes from the verified credential's own
  claims; no profile storage is added.
- The health ping remains public: it reveals only service name and version, which is
  acceptable.
- Verification happens on every request (no server-side session cache); with tens of
  requests per day, the simplicity is worth more than the saved milliseconds
  (constitution Principle IV).
- Brute-force/abuse protection beyond structured rejection is out of scope: the
  service is unlisted, free-tier quotas throttle naturally, and the threat model of a
  two-person household app does not justify rate-limiting machinery.
