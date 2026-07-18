# Quickstart — Perf & Resilience (030) validation

Per-story validation. Frontend stories are verified live in the browser preview using the dev-session token (paste a token from `clasp run mintDevSessionToken` into `localStorage['hq.sessionToken']`, no Google OAuth). The backend story (US1) is exercised via `clasp run` + the deployed web app's network panel.

## Prerequisites

```bash
cd frontend && npm install && npm test        # unit tests green (incl. new: timeout, retry predicate, bootstrap seeding, restore hardening, optimistic reverts)
npm run build                                   # type-clean; note the emitted chunk list (US5)
# Backend:
cd ../backend && clasp push && clasp run selfTest   # ALL PASS, incl. the new data.bootstrap shape-parity assertion
clasp deploy -i <deploymentId>                       # refresh the existing web-app URL
```

Local preview: `cd frontend && npm run dev`, then set `localStorage['hq.sessionToken']` to a dev token and reload. Keep the browser Network panel open for the request-count checks.

## US1 — App opens in one round-trip (P1)

1. Clear the app's query cache (hard reload) with a warm session (dev token set), Network panel filtered to the API URL.
2. **Expect**: exactly **one** `data.bootstrap` POST on cold load — not ~10 separate `*.list` POSTs — and the home dashboard, calendar, tasks, and lists tabs all render real data from it.
3. Navigate home → calendar → tasks → lists. **Expect**: no additional data POST for data bootstrap already delivered.
4. Open the **More** tab. **Expect**: exactly one lazy `activity.list` POST now fires (the only deferred dataset); everything else was already loaded.
5. Compare a couple of records (e.g. a task, a list item) against what `tasks.list`/`listItems.list` return directly (via `clasp run` or a manual call) → **expect**: identical shape and values.
6. Complete a task, then observe → **expect**: a targeted `tasks.list` refetch still works (bootstrap didn't disable per-dataset refetch).

## US2 — A returning user isn't bounced to sign-in over a hiccup (P2)

With a valid stored session:

1. Simulate a transient boot failure: in DevTools set the network to **Offline** (or block the API URL), then reload the app.
2. **Expect**: the app shows the auto-retry ("Signing you back in…") phase, then — still failing — a recoverable **"Couldn't load — Retry"** screen. It does **not** show the Google sign-in wall, and the stored `hq.sessionToken` is still present in localStorage.
3. Restore the network and tap **Retry** (or let an auto-retry land) → **expect**: restore + bootstrap complete and the app opens fully signed in, no Google re-auth.
4. **Genuine-rejection guard**: with an intentionally invalid/expired token, reload → **expect**: the sign-in wall (not the recoverable screen). With a token for a non-allowlisted identity → **expect**: the forbidden notice. Hardening must not mask these.
5. **Partial response guard**: force a malformed/partial `data.bootstrap` response (e.g. stub it) → **expect**: no blank screen or crash; the recoverable screen appears with a way to retry.

## US3 — Requests don't hang, and blips self-heal (P2)

1. **Timeout**: throttle or stall a single request past the client timeout (~15 s). **Expect**: the call aborts and surfaces a retryable network/timeout error — the UI does not hang indefinitely.
2. **Read auto-retry**: with a read that fails once then succeeds (e.g. flip Offline→Online mid-load), **expect**: the read recovers within the retry budget with no user-visible error.
3. **Genuine error not retried**: trigger a `VALIDATION_FAILED` (e.g. an invalid create) → **expect**: the error is shown immediately, no retry delay/backoff spinning.
4. **Writes not double-applied**: fail a create transiently → **expect**: it reverts (US4) rather than silently re-issuing; on manual retry the record appears exactly once (no duplicate row in the Sheet).

## US4 — The rest of the app saves instantly too (P3)

For each newly-converted action, **expect** the UI to update immediately, reconcile on success with no flicker/duplicate, and revert with an error toast on failure (force a failure via Offline):

1. **Lists**: create a list, delete a list, add a list item, edit a list item's note/quantity, delete an item.
2. **Recurring rules**: create, edit, delete a recurring chore rule.
3. **Recurring events**: create, edit, delete a recurring event rule.
4. **Templates**: create, edit, delete a prep-template.
5. **Settings**: toggle a setting (e.g. digest enabled) / change a value → **expect**: instant reflect, no spinner-freeze.
6. **Regression**: confirm feature-028 optimistic actions still work — task complete/reopen/snooze/unsnooze, event create/edit, list-item need⇄stocked toggle.

## US5 — The app downloads less up front (P3)

1. From `npm run build` output (or `dist/assets`), **expect**: multiple chunks — an initial chunk plus separate on-demand chunks (Schedule-X calendar, More view) rather than one monolith.
2. Cold-load the app with the Network panel on **JS**. **Expect**: the calendar/More chunks are **not** requested for the initial dashboard render.
3. Navigate to the calendar tab → **expect**: its chunk loads on demand (brief graceful fallback if any) and the calendar works identically. Repeat for More.
4. **Chunk-failure guard**: block a lazy chunk's request, then navigate to that area → **expect**: a retryable, area-scoped error message — the rest of the app keeps working, no white screen.

## Definition-of-done checks

- `npm run build` type-clean; `npm test` green; `clasp run selfTest` → ALL PASS (incl. bootstrap parity).
- Cold load = 1 data request (SC-001); More adds exactly 1 lazy activity request.
- No Sheet tab/column/record shape changed; hand-edit a cell and confirm it reflects on next fetch.
- New UI states (recoverable retry screen, lazy fallbacks) pass an `/impeccable audit` before PR.
