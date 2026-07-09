# Phase 0 Research — Calendar UI (006)

Decisions resolving the Technical Context. Each is Decision / Rationale / Alternatives.

---

## R1. Calendar component: Schedule-X vs FullCalendar *(the CLAUDE.md-deferred decision)*

**Decision**: Use **Schedule-X** (`@schedule-x/react` + calendar packages) for the calendar grid and agenda, themed with the DESIGN.md token palette via CSS custom properties, with **custom event content** for owner-colored events and tethered prep-task chips. Provide a month-scale view on desktop and an agenda/list-scale view on mobile.

**Rationale**:
- **Theming is a hard gate here.** DESIGN.md mandates a bespoke warm paper-and-ink palette and the impeccable-audit gate (SC-006) will fail on generic calendar chrome. Schedule-X themes cleanly through CSS variables, so it inherits our tokens instead of fighting opinionated vendor CSS.
- **Right views out of the box**: month + week + day + agenda/list map exactly onto "month on desktop, agenda/week on mobile" (FR-009) without building a second view system.
- **Modern, TS-native, MIT, React adapter, tree-shakeable** — small footprint, satisfies free-tier (III) and keeps the bundle lean for mobile.
- **Boring/debuggable (IV) is still satisfied**: the code we own is plain React custom-event components + a single wrapper; the library only owns grid layout and date math (the error-prone part worth *not* hand-rolling).

**Alternatives considered**:
- **FullCalendar** — more battle-tested with a deeper docs/Stack­Overflow history (a real point for constitution IV and Claude-Code maintainability). Rejected as the default because its opinionated CSS makes a fully bespoke warm theme a fight, and we do heavy custom event rendering regardless so its built-in event styling is less valuable. **Kept as the fallback**: if at the plan-review gate the reviewer weighs maturity/theming differently, FullCalendar (`@fullcalendar/react` with `dayGridMonth` + `listWeek`, `--fc-*` variable overrides + `eventContent`) is a drop-in swap for R1 with no change to data-model/contracts.
- **Hand-rolled calendar grid** — rejected: month layout + DST-correct date math is exactly the "boring, well-trodden" work a library should own (IV); reinventing it is a bug farm.

**⚠ Confirm at plan-review pause.** This is the one decision CLAUDE.md explicitly defers to the 006 plan. Selection above is Schedule-X; say the word to switch to FullCalendar and the rest of the plan is unaffected.

---

## R2. Backend transport & API client

**Decision**: One typed `api.ts` client. Every call is a `fetch` **POST** with `Content-Type: text/plain;charset=utf-8` and a JSON body `{ action, token, payload }`, to the single web-app URL (`VITE_API_BASE_URL`). Responses are always HTTP 200 with `{ ok, data }` or `{ ok, error: { code, message, field? } }`; the client throws a typed `ApiError(code)` on `ok:false` or network failure. A health `ping` (action, no token) is available but not required at runtime.

**Rationale**: Matches the backend exactly (Api.js `doPost`, feature-001 CORS decision): `text/plain` avoids the CORS preflight that Apps Script won't answer for cross-origin JSON POSTs (CLAUDE.md gotcha). `ok` is the sole success discriminator, so the client never trusts HTTP status. Centralizing transport + error mapping in one module keeps every hook simple.

**Alternatives considered**: `application/json` POST (rejected — triggers preflight Apps Script can't satisfy); GET-with-params (rejected — writes need bodies; POST is uniform). JSONP (rejected — legacy, unnecessary).

**Error codes to handle** (from Api.js/Auth.js): `UNAUTHENTICATED`, `INVALID_CREDENTIAL`, `FORBIDDEN`, `ALLOWLIST_MISCONFIGURED`, `ACTING_PERSON_REQUIRED`, `VALIDATION`, `SCHEMA_MISMATCH`, `BUSY`, `BAD_REQUEST`, `UNKNOWN_ACTION`, `INTERNAL`. Mapped to plain, calm user messages (DESIGN voice); `UNAUTHENTICATED`/`INVALID_CREDENTIAL` → return to sign-in; `FORBIDDEN`/`ALLOWLIST_MISCONFIGURED` → refusal screen; `ACTING_PERSON_REQUIRED` → prompt "Max or Jaz?".

---

## R3. Authentication wiring (Google Identity Services)

**Decision**: Use GIS on the frontend to obtain a Google **ID token** (JWT) whose `aud` is `OAUTH_CLIENT_ID` (the value already committed in `backend/Config.js`, surfaced to the app as `VITE_GOOGLE_CLIENT_ID`). Attach `credential` as `token` on every non-`ping` call. On load, if no valid token, show the sign-in gate; after sign-in, call `auth.whoami` to learn `{ identity: 'max'|'jaz'|'shared', displayName, email, needsActingPerson }`. Store the token in memory; when a call returns `UNAUTHENTICATED`/`INVALID_CREDENTIAL` (expiry), return to the gate and prompt re-auth. When `identity === 'shared'` (`needsActingPerson`), require the user to pick Max or Jaz and send that as `payload.actingPerson` on **writes** (reads don't need it).

**Rationale**: Exactly the feature-002 design (ID-token-per-request + allowlist), no new auth concepts (constitution + CLAUDE.md). Client ID is public and already committed, so reuse it. Memory-only token keeps things simple; GIS handles the credential UX. The shared-account acting-person prompt is required only where the backend enforces it (`isWriteAction_`).

**Alternatives considered**: OAuth access tokens / GIS token model (rejected — backend verifies an **ID token**'s claims, not an access token). Silent refresh plumbing (deferred — re-prompt on expiry is simpler and fine for two users; revisit if annoying). Persisting token to storage (rejected for v1 — memory + re-auth on expiry is simpler and safer).

---

## R4. Server-state, caching & optimistic writes

**Decision**: **TanStack Query** owns all server state. Queries: `events.list`, `tasks.list` (with the household slice), `settings.list`, and `auth.whoami`. Mutations: `tasks.complete` / `tasks.reopen` (optimistic — flip status immediately, roll back on error, then invalidate), and `events.create` / `recurring.create` / `tasks.create` (invalidate the relevant lists on success). Surface `dataUpdatedAt` as the "last synced" note; on fetch error keep the last cached data with a retry affordance (FR-016).

**Rationale**: Meets FR-016/FR-020/SC-008 (immediate reflection, graceful failure, prefer-stale-over-spinner) with a single well-trodden library instead of hand-rolled state. Optimistic check-off delivers the "instant, quiet" feel (US6) while the backend remains the source of truth (II).

**Alternatives considered**: Redux/Zustand + manual fetch (rejected — more code, reinvents caching/invalidation); raw `useEffect` fetching (rejected — no caching, races, no stale-while-error story).

---

## R5. Event↔task tether derivation

**Decision**: Derive the tether client-side in `lib/tether.ts`: group `tasks` by their `eventId` (backend Tasks column). For each event, attach `tasks.filter(t => t.eventId === event.id)` as its prep list; tasks with an empty/unknown `eventId` are **standalone** and placed on their own `dueDate`. Relative due labels ("T−2 days", "Tomorrow", "2 days overdue") computed in `lib/datetime.ts` from `dueDate` vs. event `start` (for T−N) / today (household tz).

**Rationale**: The Tasks tab already carries `eventId` (and `recurringId`); the tether is a pure client-side grouping over existing data — no backend change (per spec Assumptions). Isolating it in a pure module makes it unit-testable (a defect here breaks the signature interaction, US2). Unknown/dangling `eventId` degrades to standalone rather than crashing (Edge Cases, FR-013).

**Alternatives considered**: A new backend "events-with-tasks" endpoint (rejected — spec forbids new backend behavior; grouping is trivial client-side). Matching by title/date heuristics (rejected — `eventId` is the authoritative link).

---

## R6. Quick-add → backend action mapping

**Decision**: One `QuickAddSheet` with a type switch → three payload builders, each hitting an existing create action:

| Quick-add type | Action | Minimum fields (fast path) | Notes |
|---|---|---|---|
| Event | `events.create` | `title`, `start`, `end`, `owner` | `end` defaults to `start`+1h (or all-day) if not set; `type` optional. |
| Recurring chore | `recurring.create` | `title`, `cadence`, `anchorDate`, `defaultOwner` | Instances materialize via the existing nightly generator — quick-add creates the **rule**, not instances. |
| One-time task | `tasks.create` | `title`, `owner` (+ `dueDate` for placement) | `dueDate` optional to the backend but the UI collects it so the item lands on a date. |

Owner selection maps `max`/`jaz`/`both` (chores/tasks use `defaultOwner`/`owner`; events use `owner`). Shared-account sessions attach `actingPerson`.

**Rationale**: Matches `REQUIRED_ON_CREATE` and `CADENCES` in `backend/Config.js` exactly, so the fast path collects only what the backend requires plus a sensible `dueDate`/`end` default (FR-023). Recurring chore correctly targets the rule table so feature-004's engine owns materialization (no duplication, respects idempotency V). No new backend surface.

**Alternatives considered**: Creating recurring-chore **instances** directly as tasks (rejected — bypasses the recurring engine, breaks idempotency and the "hand-editable rule" model). A single generic "item" create (rejected — the three tabs have different required fields and semantics).

---

## R7. Timezone & date display

**Decision**: Read `timezone` from `settings.list` (default `America/Los_Angeles`). Format all dates/times with `Intl.DateTimeFormat` pinned to that `timeZone`, regardless of device tz. Treat backend `start`/`end` (datetime ISO) and `dueDate` (date ISO) as authoritative strings; never rely on the browser's local zone for display or day-bucketing.

**Rationale**: Constitution + FR-017 require the single household timezone everywhere. `Intl` is built-in (no date lib, boring/debuggable). Day-bucketing in the household tz avoids off-by-one placement for users in another zone (Edge Cases).

**Alternatives considered**: Luxon/day.js/date-fns-tz (rejected for v1 — `Intl.DateTimeFormat` with an explicit `timeZone` covers formatting + bucketing without a dependency). Trusting device tz (rejected — violates FR-017).

---

## R8. PWA scope, deployment & config

**Decision**: Scaffold a **PWA-capable** shell only: a `manifest.webmanifest` + icons + correct Vite `base` for the GitHub Pages project path. **No** service worker / offline / install-prompt / push work — that's feature 010. Deploy via a `deploy-frontend.yml` GitHub Actions workflow building `/frontend` and publishing to Pages on merge to `main`. Config via Vite env: `VITE_API_BASE_URL` (deployed web-app URL), `VITE_GOOGLE_CLIENT_ID` (the committed client ID). The one-time repo "enable GitHub Pages / select source" toggle is a **user action** flagged at deploy time.

**Rationale**: Brief/constitution call the frontend "installable as a PWA" but full PWA is explicitly feature 010; scaffolding the manifest now avoids rework without pulling 010 forward. Actions→Pages is the decided free-tier deploy path (III). Correct `base` is the classic GH-Pages-project-site footgun — decided now.

**Alternatives considered**: Full service worker now (rejected — that's 010's scope; offline correctness is real work). Manual `gh-pages` branch push (rejected — Actions is the decided, reproducible path). Hardcoding URLs (rejected — env keeps deploy config out of source).

---

## R9. Testing approach

**Decision**: Unit-test the pure logic with **Vitest + React Testing Library**: owner→color/label/initial mapping, tether grouping (incl. dangling `eventId`), relative-due formatting across boundaries (today/tomorrow/overdue/T−N), quick-add payload builders (each type's required fields + defaults), and API envelope parse/error mapping. Manual end-to-end via `quickstart.md` against the live deployed backend. `npm run build` (tsc) zero-error gate + `/impeccable audit` before PR.

**Rationale**: The bugs that would hurt most (wrong tether, wrong owner color, wrong due math, malformed create payloads) live in pure functions — cheap and high-value to unit-test. Full E2E/browser automation is overkill for two users; the quickstart + live validation is the pragmatic, boring bar (IV).

**Alternatives considered**: Playwright/Cypress E2E (deferred — heavy for scope; quickstart suffices). No tests (rejected — the pure logic is defect-prone and DoD implies verification).
