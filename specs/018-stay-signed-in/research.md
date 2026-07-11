# Research: Stay Signed In (Session Persistence)

Feature 018 · frontend-only · builds on the GIS wiring from features 002/006.

## R1 — Silent re-acquisition mechanism (GIS auto-select + One Tap)

**Decision**: Enable `auto_select: true` in `google.accounts.id.initialize(...)` and drive
silent re-sign-in with `google.accounts.id.prompt()`. On app boot (when the local
"attempt auto sign-in" hint is set) call `prompt()`; if the user previously consented and
exactly one Google session is active, GIS auto-selects and fires the existing `callback`
with a **fresh ID token** and no UI. If GIS declines (multiple sessions, no prior consent,
cooldown, or the browser suppresses it), fall through to the interactive `SignInGate`.

**Rationale**: This is the native, keyless, free mechanism the spec assumes. It requires no
new scopes (so no re-authorization for either user) and no server session. It reuses the
`callback` already registered in `auth.ts` — a restored token flows through the exact same
`fetchWhoAmI` path as an interactive sign-in, so attribution and allowlist checks are
unchanged (FR-008, FR-010).

**FedCM note**: GIS One Tap now runs on the browser FedCM API. Under FedCM the granular
`isNotDisplayed()/isSkippedMoment()` reason strings on the prompt moment are deprecated/opaque,
but the flow still resolves one of two ways we can observe: the `callback` fires (success) or
it does not (a `dismissed`/skipped moment, or a timeout). **Implementation therefore treats
"callback fired within a short window" as success and anything else as "fall back to the
button"** rather than branching on specific moment reasons. This is more robust across
Chrome/Safari/Firefox than reading deprecated reason codes.

**Alternatives considered**:
- *Persist and reuse the ID token from localStorage* — rejected at clarify (Q1): it stores a
  credential on-device for ~1h of validity and still needs re-acquisition after expiry, so it
  buys only a marginally faster first paint at a real security cost (FR-009).
- *OAuth access-token + refresh-token flow* — rejected: introduces a token exchange/refresh
  concept and secret handling the app deliberately avoids (feature 002 R1: ID-token-only).
- *Backend session cookie* — rejected: needs server-side session state, violating the
  stateless free-tier model (Constitution III).

## R2 — What to persist, and where

**Decision**: `localStorage`, two small keys under a `hq.` namespace:
- `hq.actingPerson` → `'max' | 'jaz'` (only meaningful for the shared account).
- `hq.autoSignIn` → `'1'` hint that a prior successful sign-in happened, so boot should
  attempt silent restore and show the restoring state (rather than flashing the button).

**No token is stored** (FR-009). GIS's own `g_state` cookie is the real gate for auto-select;
our `hq.autoSignIn` hint only decides whether to render the calm "restoring" state vs. the
sign-in wall on first paint, avoiding a button-flash for returning users and avoiding a
pointless restore spinner for first-timers.

**Rationale**: Minimal, human-legible, re-derivable. Nothing here grants access; identity is
always re-verified server-side. Corrupt/partial values are treated as "not signed in"
(spec edge case) — reads are defensive and fall back to the sign-in wall.

**Alternatives considered**: `sessionStorage` (rejected at clarify Q1 — dies on full app
close, missing the core mobile goal); IndexedDB (overkill for two string keys).

## R3 — Mid-session expiry: reactive refresh + single-flight retry

**Decision**: Centralize authenticated calls behind an `authedCall(action, payload, opts)`
exposed from `useAuth`. It calls `apiCall` with the current in-memory token; if the result
is an `ApiError` with code `UNAUTHENTICATED` or `INVALID_CREDENTIAL`, it triggers a **silent
refresh** (`prompt()` → new token via callback), updates the in-memory token, and **retries
the original request once** with the fresh token. If the silent refresh fails, it falls back
to signed-out (interactive wall) exactly as `handleAuthError` does today.

The refresh is **single-flight**: concurrent 401s share one in-flight refresh promise
(guarded by a module/ref-level promise) so a burst of failing calls triggers exactly one
One Tap, not many. The fresh token is read from a ref (not React state) so the retry uses it
synchronously without waiting for a re-render.

**Rationale**: Chosen at clarify (Q2) for being the most boring/debuggable option
(Constitution IV) — no background timers to reason about, expiry handled exactly where it
surfaces. Centralizing in one wrapper means the ~13 existing call sites
(`{ token: session!.token }` in `useTasks`/`useEvents`/`useMutations`/…) each change to
`authedCall(...)` and get retry behavior for free, instead of duplicating retry logic.

**Alternatives considered**: proactive pre-expiry timer (clarify Q2 option B — more moving
parts, background timer lifecycle); both (option C — most complexity for a two-user tool).
Rejected in favor of reactive-only; a timer can be added later if reactive proves jarring.

## R4 — Boot state machine & the acting-person affirmation

**Decision**: Extend the `useAuth` status set with a `restoring` state. On mount:
`hq.autoSignIn` set → status `restoring`, attempt silent sign-in; on success → `signed-in`
(pre-fill `actingPerson` from `hq.actingPerson` if present); on failure/decline →
`signed-out` (sign-in wall). `App.tsx` renders a calm `RestoringGate` while `restoring`
(FR-005), never leaking household data.

For the shared account, instead of blocking with `ActingPersonPrompt` when a remembered
person exists, restore that person and render a **dismissible `ActingPersonAffirm` banner**
("Signed in as Max — switch?") that lets a one-tap correction (clarify Q3). The existing
blocking `ActingPersonPrompt` still shows when there is **no** remembered person (first shared
sign-in) or when the remembered value is stale/invalid and must be re-resolved (spec edge
case). If a fresh token resolves to a personal account (`identity` is `max`/`jaz`, not
`shared`), the server-derived person wins over any stored value.

**Rationale**: Directly encodes the three clarify answers with the smallest change to the
current gate flow in `App.tsx`. Keeps `ActingPersonPrompt` for the genuinely-ambiguous first
time while removing the per-visit friction for returners.

## R5 — Sign-out semantics

**Decision**: Sign-out calls `google.accounts.id.disableAutoSelect()` (already done today),
**and additionally clears** `hq.actingPerson` + `hq.autoSignIn`. Next boot therefore has no
auto-sign-in hint and GIS's `g_state` blocks auto-select → the interactive wall shows with no
automatic re-entry (FR-007, SC-005). We do **not** call `revoke()` (that would drop the user's
consent entirely and force a full re-consent, which is heavier than intended).

**Rationale**: Satisfies "sign-out truly ends the persisted session" without nuking consent.
`disableAutoSelect` + clearing our hint is sufficient and reversible by a normal sign-in.

## R6 — No backend / scope / deployment impact

**Decision**: Confirmed zero backend surface. `auth.whoami` and token verification are reused
unchanged; no `appsscript.json` scope change, so **no re-authorization** by either account and
no `clasp` redeploy is required for this feature. Validation is a frontend build + browser
pass.

**Rationale**: The whole feature lives in the client session lifecycle. Keeping the backend
untouched avoids OAuth re-consent churn and keeps the change reviewable.

## Open risks / notes for implementation

- **iOS Safari / ITP**: silent One Tap may be declined more often; the interactive fallback is
  the designed safety net (SC-001 scoped to "common case"). Validate on a real iPhone per
  quickstart.
- **One Tap cooldown**: if a user dismisses One Tap repeatedly, GIS imposes a cooldown; the
  sign-in button (rendered on the wall) is always available as the escape hatch.
- **Single-flight correctness**: ensure the shared refresh promise is cleared after settle
  (success or failure) so a later expiry can refresh again.
