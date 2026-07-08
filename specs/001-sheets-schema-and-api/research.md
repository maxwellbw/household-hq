# Research: Sheets Schema and API (001)

All decisions below are constrained by the constitution's Platform Constraints
(Sheet = DB, dependency-free Apps Script web app, V8, clasp) and the spec's FR-015–FR-021.

## D1. Transport: everything is a `text/plain` POST (FR-015)

**Decision**: All API operations — reads and writes — go through `doPost` as a POST with
`Content-Type: text/plain;charset=utf-8` carrying a JSON body. `doGet` serves only an
unauthenticated health/version ping (`{ ok: true, data: { service, version } }`).
Clients MUST NOT set custom headers (no `Authorization`) — the identity token travels in
the body. This is the one transport for all future features.

**Rationale**:
- A `text/plain` POST is a CORS "simple request": the browser sends no preflight
  `OPTIONS`, which Apps Script cannot answer. `application/json` would preflight and
  fail. Custom headers would also trigger preflight, hence token-in-body.
- Apps Script serves web-app responses via a 302 redirect to
  `script.googleusercontent.com`, which returns `Access-Control-Allow-Origin: *`;
  simple requests + `fetch` redirect-following make this work cross-origin.
- One uniform channel means one envelope, no URL-length ceiling (GET tops out around
  2KB — too small for a task with notes and list items), and no tokens or payloads in
  URL/server logs.

**Alternatives considered**:
- *GET with query parameters for reads*: cacheable and curl-friendly, but splits the
  envelope in two, leaks payloads/tokens into URLs, and hits length limits. Rejected
  for non-uniformity; `doGet` keeps only the ping.
- *`application/json` POST*: preflight fails against Apps Script. Rejected.
- *JSONP*: obsolete, script-injection surface. Rejected.

## D2. Envelope shape with reserved identity slot (FR-012, FR-016)

**Decision**:

Request (JSON body of every POST):

```json
{
  "token": "<Google ID token — empty string until feature 002 enforces>",
  "action": "tasks.create",
  "payload": { }
}
```

Response — success: `{ "ok": true, "data": <result> }`
Response — failure: `{ "ok": false, "error": { "code": "NOT_FOUND", "message": "…", "field": "dueDate?" } }`

Error codes (closed set for 001): `UNKNOWN_ACTION`, `BAD_REQUEST` (unparseable body /
missing fields), `VALIDATION_FAILED` (carries `field`), `NOT_FOUND`, `BUSY` (lock
timeout), `SCHEMA_MISMATCH` (missing/renamed header, per FR-020), `INTERNAL`.

Actions in 001: `events.list|create|update|delete`, `tasks.list|create|update|delete`,
`templates.list`, `recurring.list`, `settings.list`, `ping`.

**Rationale**: `action` routing in one `doPost` avoids path routing (Apps Script web
apps have a single URL). The `token` field exists from day one so feature 002 changes
verification behavior, not the envelope (FR-016). HTTP status is always 200 (Apps Script
gives no status control); `ok` is the discriminator — clients must never rely on status
codes.

## D3. Column mapping by header name (FR-001, FR-020)

**Decision**: Every tab access starts by reading row 1 and building a
`headerName → columnIndex` map. Field access goes through that map only — never numeric
literals. If a required header is missing or renamed, throw `SCHEMA_MISMATCH` naming the
tab and header. Unknown extra columns are preserved: updates write only the columns the
schema knows, by mapped index, leaving hand-added columns untouched. Reads use one
`getDataRange().getValues()` per tab; writes are one batch `setValues`/`appendRow`.

**Rationale**: Hand-sorting, inserted columns, and cosmetic edits survive (US3); a
broken header fails loudly instead of positionally misreading data into the wrong
fields. One-read/one-write-per-request is the constitution's own Sheets performance
rule.

## D4. Concurrency: script lock around every mutation (FR-018)

**Decision**: Every state-changing action runs inside
`LockService.getScriptLock()` → `waitLock(30_000)` → mutate → `SpreadsheetApp.flush()` →
`releaseLock()` (in `finally`). On lock timeout return `BUSY`; the client may retry
(safe: creates are idempotent per D5). Reads take no lock.

**Rationale**: A script lock serializes across both users and time-driven triggers —
the only three writers that will ever exist (Principle I). 30s is generous for a
tens-of-requests-per-day system and stays far under the 6-minute execution ceiling.

## D5. Idempotency: client-supplied IDs (FR-017)

**Decision**: `create` payloads MAY carry a client-generated UUID `id`; the server
generates one (`Utilities.getUuid()`) only when absent. If a create arrives whose `id`
already exists in the tab, the server returns the existing record with `ok: true`
(idempotent replay, not an error). Updates/deletes key strictly on `id`.

**Rationale**: A retried POST (flaky phone network, timeout after the write landed)
must not duplicate (Principle V). Making replay a success mirrors what the client
meant: "ensure this exists."

## D6. Date/time storage format (FR-009)

**Decision**: Store date-times as ISO 8601 local strings without offset
(`2026-07-07T14:00`) and date-only fields as `2026-07-07`, all interpreted in the
household timezone from Settings (default `America/Los_Angeles`). During provisioning,
date/ID/text columns are set to plain-text number format (`@`) so Sheets never coerces
them into serial dates. Backend formatting uses `Utilities.formatDate(date, tz, pattern)`.

**Rationale**: Brief §8 Q2's recommendation (single configured household timezone) —
offsets would flip across DST and confuse hand-editors; UTC storage would make the
Sheet unreadable (Principle II beats theoretical portability for a one-house system).
The plain-text format guard matters: Sheets silently converts `2026-07-07` cells to
locale-formatted dates otherwise, which would round-trip differently than written.

## D7. Provisioning routine (FR-021)

**Decision**: A `setupDatabase()` function (run manually from the editor or `clasp run`,
not exposed as an API action) that, for each of the six tabs: creates the tab if
missing, writes the header row if row 1 is empty, sets plain-text column formats, and
freezes row 1. It never deletes, never clears, and skips any tab/header that already
exists — safe to re-run forever. It also seeds Settings with labeled keys (allowlisted
emails left blank to fill by hand, `timezone=America/Los_Angeles`, placeholder keys for
later features).

**Rationale**: Idempotent-by-construction (Principle V); provisioning is an operator
act, not an API surface, so it stays out of the envelope.

## D8. Configuration location

**Decision**: `SPREADSHEET_ID` and `API_VERSION` live in `backend/Config.js` as
constants, committed (the repo is private; CLAUDE.md: IDs are fine to commit, keep them
in one config file). No Script Properties — one fewer invisible state store.

## R1. Risk flagged for feature 002 — web-app deployment mode vs. browser CORS

CLAUDE.md specifies deploying as **Execute as: user accessing the app / access: Anyone
with a Google account**. Research finding: with that mode, a cross-origin `fetch` from
GitHub Pages does not carry a Google session (and credentialed CORS is incompatible
with the wildcard `Access-Control-Allow-Origin` Apps Script serves), so the browser
receives a login-redirect HTML page instead of JSON. The pattern that works for
SPA-to-Apps-Script APIs is **Execute as: me / access: Anyone**, with the ID-token
allowlist doing the real gating — which is exactly what CLAUDE.md already says the
allowlist does.

**Disposition**: Not 001's call — auth enforcement is feature 002, and 001's
verification (quickstart) uses curl, which either mode serves fine. Recorded here so
002's spec/plan resolves the deployment mode explicitly and updates CLAUDE.md rather
than discovering this in a browser console during feature 006. Nothing in 001's design
depends on the outcome; the envelope's `token` field works in both modes.
