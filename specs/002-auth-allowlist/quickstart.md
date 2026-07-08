# Quickstart & Validation: Auth Allowlist (002)

Proves enforcement, attribution, and fail-closed behavior against the real deployed web
app. Run after `/speckit.implement`. Builds on 001 being deployed.

## Prerequisites

- Feature 001 deployed; `backend/Config.js` has the real `SPREADSHEET_ID`.
- `setupDatabase()` has seeded the new Settings keys (or run it once more — it's
  create-if-missing).

## 1. Create the OAuth Web client ID  *(you, browser — one time)*

Google Cloud Console → the project backing this Apps Script → **APIs & Services →
Credentials → Create credentials → OAuth client ID → Web application**. Add the app's
GitHub Pages origin (and `http://localhost:5173` for dev) to *Authorized JavaScript
origins*. Copy the client ID and paste it into `backend/Config.js` as `OAUTH_CLIENT_ID`.
This same ID is reused by feature 006's sign-in. *(Client IDs are public — safe to commit.)*

## 2. Fill the allowlist  *(you, in the Sheet)*

In the `Settings` tab set:

| key | value |
|---|---|
| `maxEmail` | Max's personal Google email |
| `jazEmail` | Jaz's personal Google email |
| `sharedEmails` | `maxandjazmine@gmail.com` |

Delete the stale `allowedEmails` row if present.

## 3. Deploy (new scopes → re-auth)  *(you authorize once)*

```bash
cd backend
clasp push
clasp deploy -i <deploymentId>     # refresh the existing web-app URL → export URL=<it>
```

First run after the scope change opens a consent screen — **only the deploying (shared)
account** authorizes (execute-as-me, research A3). Grant Sheets + external-request access.

> **curl note:** POST with `--data` but **without** `-X POST`. Apps Script 302-redirects
> POSTs to `googleusercontent.com`; `-X POST` forces the *redirected* request to stay POST,
> which that URL rejects with a "Page Not Found" HTML page. Plain `-sL --data` lets curl
> follow the redirect as GET (what Apps Script expects) and returns JSON.

## 4. Rejections that need no token (SC-001, SC-004)

```bash
# missing credential
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"token":"","action":"tasks.list"}' "$URL"          # → error.code UNAUTHENTICATED

# garbage / tampered credential
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"token":"not.a.jwt","action":"tasks.list"}' "$URL"  # → error.code INVALID_CREDENTIAL
```

Neither response contains household data or allowlist contents (SC-004). `ping` still works
with no token: `curl -sL "$URL"` → `ok:true`.

## 5. Mint real ID tokens (OAuth 2.0 Playground)

At <https://developers.google.com/oauthplayground> → ⚙ → *Use your own OAuth credentials*
→ paste `OAUTH_CLIENT_ID` (+ its secret). Authorize the `openid email profile` scopes,
signing in as the account under test; step 2 exposes the **`id_token`**. Mint three:
`$TOK_MAX` (Max personal), `$TOK_SHARED` (shared account), `$TOK_OTHER` (any non-allowlisted
Google account).

> The token's `aud` must equal `OAUTH_CLIENT_ID`, which is why the Playground must use our
> own credentials. Tokens expire in ~1 h — re-mint if a call returns `INVALID_CREDENTIAL`.

## 6. Accept + verified attribution (SC-002)

```bash
# personal account creates a task; actor comes from the token, not the body
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data "{
  \"token\":\"$TOK_MAX\",\"action\":\"tasks.create\",
  \"payload\":{\"title\":\"vet call\",\"owner\":\"both\",\"completedBy\":\"jaz\"}}" "$URL"
# → ok:true; the ActivityLog row's actor is `max` (the false completedBy:jaz is ignored)
```

`auth.whoami` as Max → `{identity:"max", needsActingPerson:false, …}`.

## 7. Not-allowlisted (SC-001, SC-004)

```bash
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  --data "{\"token\":\"$TOK_OTHER\",\"action\":\"tasks.list\"}" "$URL"   # → FORBIDDEN
```

No data, no reason beyond "not authorized," no allowlist leak.

## 8. Shared account → disambiguation (FR-014)

```bash
# whoami as shared → identity "shared", needsActingPerson true
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  --data "{\"token\":\"$TOK_SHARED\",\"action\":\"auth.whoami\"}" "$URL"

# shared write WITHOUT actingPerson → rejected, nothing written
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data "{
  \"token\":\"$TOK_SHARED\",\"action\":\"tasks.create\",
  \"payload\":{\"title\":\"trash night\",\"owner\":\"both\"}}" "$URL"     # → ACTING_PERSON_REQUIRED

# shared write WITH actingPerson → attributed to that person
curl -sL -H 'Content-Type: text/plain;charset=utf-8' --data "{
  \"token\":\"$TOK_SHARED\",\"action\":\"tasks.create\",
  \"payload\":{\"title\":\"trash night\",\"owner\":\"both\",\"actingPerson\":\"jaz\"}}" "$URL"
# → ok:true; ActivityLog actor is `jaz`, never the shared account
```

## 9. Fail closed (SC-006)

Blank `maxEmail`, `jazEmail`, and `sharedEmails` in Settings, then any authenticated call
(even `$TOK_MAX`) → `ALLOWLIST_MISCONFIGURED`; no unknown caller slips through. Restore the
values afterward.

## 10. SelfTest

Editor → run `selfTest()` → log ends `ALL PASS`. Its auth block exercises
`resolveIdentity_` over synthetic claims for every path in §4–§9 without curl.

## Done

§4–§10 behave as stated → SC-001, SC-002, SC-004, SC-006 verified here; SC-003 (silent
refresh, zero prompts) and SC-005 (latency budget) verified end-to-end with feature 006.
Feature 002 is done per the spec.
