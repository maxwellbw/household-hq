# Research: Perf & Resilience (030)

Six decisions. Each records what was chosen, why, and what was rejected. All keep to the constitution (no new dependency, no Sheet change, two-user scope).

## R1 — Backend `data.bootstrap` action

**Decision**: Add one handler `'data.bootstrap'` to `HANDLERS` in `backend/Api.js` that composes the existing `list*` helpers and returns them in a single envelope:

```
{ events, tasks, recurring, recurringEvents, lists, listItems, templates, settings, dogWalks }
```

Each key holds exactly what the corresponding `*.list` action returns today (same helper, same shape). It receives `(payload, actor, identity)` like any handler and passes `actor`/`identity` through to `listTasks_` so per-actor task scoping is identical. The **activity feed is excluded** — it is only shown in the More tab and is the one ever-growing collection.

**Rationale**: The handlers already exist and read one tab each into memory (`getDataRange().getValues()`); calling nine of them sequentially in one request is still one HTTP round-trip and stays far inside the 6-minute limit for a two-user household (tens-to-low-hundreds of rows per tab). Composing rather than rewriting guarantees shape parity for free and keeps the individual actions available for refetch (FR-006). Gating is unchanged because bootstrap runs behind the same `doPost` identity check as every other action.

**Alternatives considered**:
- *Include activity in bootstrap* — rejected per clarification: it's the largest and least-cold-relevant list; deferring it keeps the cold payload lean (edge case: payload size) while the More tab loads it lazily.
- *A GET endpoint / different transport* — rejected: the text/plain POST envelope is the settled feature-001 CORS decision; no reason to diverge.
- *Server-side response caching* — rejected: violates "Sheet is truth / no shadow state" and is pointless at this scale.

## R2 — Frontend cache seeding without a double-fetch

**Decision**: A new `useBootstrap` hook runs a single `['bootstrap']` query (enabled once a session exists) calling `data.bootstrap`. On success it seeds every dataset's query key via `queryClient.setQueryData(['events'], …)`, `['tasks']`, `['recurring']`, `['recurringEvents']`, `['lists']`, `['listItems']`, `['templates']`, `['settings']`, `['dogWalks']`. The existing per-dataset hooks (`useTasks`, `useEvents`, …) are left **unchanged**.

**Rationale**: `setQueryData` stamps `dataUpdatedAt = now`, so under the existing `staleTime: 30_000` the seeded data is *fresh*; when a per-dataset hook's observer mounts it finds fresh cached data and does **not** fire a network fetch (SC-001). This needs no change to the individual hooks and no new "enabled" gating. The activity hook (`useActivity`) only mounts inside the More view, which is lazy-loaded (R5), so activity naturally stays a lazy per-tab request — no extra work to defer it.

**Alternatives considered**:
- *`initialData` on each query* — rejected: would require threading the bootstrap result into every hook and couples them; cache-seeding is looser and keeps hooks untouched.
- *Replace the per-dataset hooks with direct reads from the bootstrap object* — rejected: loses the established refetch/invalidate machinery that every mutation relies on (FR-005).
- *Gate individual queries `enabled:false` until bootstrap lands* — rejected: unnecessary once staleness handles it, and would break lazy/standalone use of a hook.

## R3 — Fetch timeout + transient-only retry

**Decision**: Two layers.
1. **Timeout in `apiCall`** (`frontend/src/lib/api.ts`): wrap the `fetch` in an `AbortController` with a bounded timeout (~15 s). On abort, throw `ApiError('NETWORK_ERROR', …)` (or a `TIMEOUT` code) — the same retryable class as a connection failure.
2. **Retry predicate in the QueryClient** (`main.tsx`): replace `retry: 1` with `retry: (failureCount, err) => failureCount < N && isTransient(err)` plus an exponential `retryDelay`, where `isTransient` matches only `NETWORK_ERROR`/`TIMEOUT`/`BAD_RESPONSE` and never `VALIDATION_FAILED`/`FORBIDDEN`/`UNAUTHENTICATED`/`UNKNOWN_ACTION` (FR-014). Mutations keep TanStack's default (`retry: 0`) — writes are **not** auto-retried (FR-013); their recovery is the optimistic revert path (R6).

**Rationale**: The timeout belongs at the transport layer so *every* call (including the whoami/bootstrap boot path, which is outside react-query) is bounded (FR-011). The retry belongs in react-query for reads because it already owns read lifecycles; a pure predicate keeps genuine errors from wasting the budget and keeps writes safe by relying on the backend's existing idempotence rather than blind re-issue.

**Alternatives considered**:
- *`fetch` with `AbortSignal.timeout()`* — viable, but explicit `AbortController` is clearer to read and easy to unit-test; either is fine, implementer's call.
- *Custom retry loop inside `apiCall`* — rejected for reads (duplicates react-query); the boot path (R4) gets its own small bounded loop since it isn't a react-query query.
- *Retrying writes with an idempotency key* — rejected as over-engineering for two users; revert-on-failure is simpler and already the pattern.

## R4 — Boot-restore hardening (state machine)

**Decision**: Add a recoverable auth state `'restore-error'` alongside the existing `restoring | signed-out | authenticating | signed-in | forbidden | error`. In `useAuth`'s `restore()`, the **transient** branch (today sets `signed-out` — spec's core bug) instead: auto-retry the whoami a small bounded number of times with backoff, and if still failing set `'restore-error'` (session token preserved, nothing cleared). Genuine outcomes are untouched — `forbidden` → forbidden gate, expired/invalid → `signed-out` sign-in wall (FR-009). Bootstrap failures fold into the same recoverable state. Two gate components: reuse `RestoringGate` for the auto-retry phase; a new `BootErrorGate` shows "Couldn't load — Retry" with a manual button that re-runs restore + bootstrap (FR-007/008).

**Rationale**: The single most jarring current failure is a valid session being discarded over a blip. Making the transient path recoverable (auto then manual) — while leaving the genuine-rejection paths exactly as they are — fixes it without weakening real auth handling. One recoverable state covers both whoami-transient and bootstrap-transient because from the user's view they're the same "app couldn't finish loading."

**Alternatives considered**:
- *Auto-retry forever* — rejected per clarification: a long outage would spin with no escape hatch.
- *Manual retry only* — rejected per clarification: a one-packet blip shouldn't need a tap.
- *A separate BootstrapGate independent of auth status* — considered; folding both transient failures into one `restore-error` state is simpler and gives one consistent recovery screen.

## R5 — Code splitting

**Decision**: `React.lazy` the two heaviest/least-cold-critical areas — the Schedule-X **calendar** view and the **More** view — each wrapped in a new `LazyBoundary` (a `Suspense` fallback + an error boundary that renders a retryable message on chunk-load failure, FR-019/020). Add `build.rollupOptions.output.manualChunks` in `vite.config.ts` to split the Schedule-X packages and the React runtime into their own vendor chunks so the initial chunk carries only the dashboard-first landing path.

**Rationale**: The dominant load cost is backend round-trips (fixed by R1), so splitting is a secondary but real win — Schedule-X (`@schedule-x/*`) is the single largest dependency and the calendar is not the landing view (dashboard is home). Lazying it and More keeps the first chunk small; `React.lazy` + dynamic `import()` are native to the stack (no new tooling). The error boundary satisfies "a failed chunk is retryable, not fatal."

**Alternatives considered**:
- *Route-based splitting library* — rejected: the app has no router (tab state in `App.tsx`); `React.lazy` on the view components is the boring fit.
- *Split every view* — rejected: dashboard + tasks + lists are on the cold path and small; splitting them adds loading flashes for no weight win.

## R6 — Optimistic-save gap inventory

**Decision**: Convert the mutation hooks still using `onSuccess`-invalidate-only to the feature-028 pattern (`onMutate` snapshot + optimistic `setQueryData`, `onError` rollback, `onSettled` invalidate). Concrete inventory (via `useMutation`/`onMutate` counts):

| Hook | Mutations | Already optimistic | To convert |
|------|-----------|--------------------|------------|
| `useRecurring.ts` | 3 | 0 | create, update, delete |
| `useRecurringEvents.ts` | 3 | 0 | create, update, delete |
| `useTemplates.ts` | 3 | 0 | create, update, delete |
| `useSettings.ts` | 1 | 0 | update |
| `useListMutations.ts` | 6 | 1 (item toggle) | list create, list delete, item create, item edit, item delete |
| `useMutations.ts` | 13 | 8 | the remaining ~5 task/event actions still `onSuccess`-only (e.g. toggle-essential and one other batch) — enumerate exactly at implement time |

**Rationale**: 028 established the exact pattern and its revert-on-error + reconcile-in-place guarantees (FR-016); this is mechanical extension to the hooks it didn't reach. Settings and list metadata are the most-felt gaps (a settings toggle currently freezes on the spinner). Keeping the identical pattern preserves debuggability (Principle IV) and means the existing 028 optimistic actions are untouched (FR-017).

**Alternatives considered**:
- *A generic optimistic-mutation factory* — rejected: three-similar-lines-beat-one-clever-indirection (Principle IV); the per-hook shape differences (id generation, list membership) make a factory leakier than copy-adapt.
- *Skip settings/templates (rarely changed)* — rejected: the spec scopes them in, and the spinner-freeze is exactly what this story removes.

## Cross-cutting notes

- **No Sheet/API-break**: every `*.list` action stays; `data.bootstrap` and the client changes are additive (FR-021/022).
- **Read-once preserved**: `data.bootstrap` calls each list helper once; no per-cell or per-record loops (FR-023).
- **Testing**: unit-test the timeout (abort → retryable error), the retry predicate (transient retried, genuine not), bootstrap cache-seeding (no per-dataset refetch), restore hardening (transient → `restore-error`, genuine → terminal), and one optimistic revert per newly-converted hook. Backend `SelfTest.js` gains a bootstrap shape-parity assertion.
