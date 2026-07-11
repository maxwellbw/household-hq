---

description: "Task list for feature 018 — Stay Signed In (Session Persistence)"
---

# Tasks: Stay Signed In (Session Persistence)

**Input**: Design documents from `/specs/018-stay-signed-in/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the frontend has an established Vitest suite (185 tests green) and the
quickstart specifies new automated coverage for the persistence helper, the reactive-retry
wrapper, and the affirmation banner.

**Organization**: Grouped by user story (US1 P1 → US3 P3) so each is independently testable.
All paths are under `frontend/`. Frontend-only feature — **no backend, Sheet, scope, or
clasp changes**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish have no story label)

---

## Phase 1: Setup

**Purpose**: Type surface for the GIS calls this feature adds.

- [X] T001 Extend GIS typings in `frontend/src/types/gis.d.ts`: add optional `momentListener` param and a minimal `PromptMomentNotification` shape to `prompt(...)`, and (if used) a `revoke` signature — enough to type `auto_select` silent re-sign-in without `any`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing every story depends on — persistence helper, silent-sign-in
capability, and the `useAuth` scaffolding (new `restoring` status, in-memory token ref,
persist-on-sign-in). **No story work begins until this phase is complete.**

- [X] T002 [P] Create `frontend/src/lib/session-store.ts` with defensive `getAutoSignIn()/setAutoSignIn()/clear()` and `getActingPerson()/setActingPerson()` over `hq.autoSignIn` and `hq.actingPerson` (per data-model.md); any unexpected/corrupt value reads as absent.
- [X] T003 [P] Unit tests in `frontend/src/lib/session-store.test.ts`: round-trip both keys, garbage/corrupt values treated as absent, `clear()` removes both.
- [X] T004 In `frontend/src/lib/auth.ts`, set `auto_select: true` in `setupGis`'s `initialize(...)` and add `silentSignIn(): Promise<string>` that calls `google.accounts.id.prompt(...)` and resolves with a fresh credential when the GIS `callback` fires, or rejects/declines when it does not (research R1 — treat "callback fired in window" as success, anything else as decline).
- [X] T005 Refactor `frontend/src/hooks/useAuth.tsx` core (no behavior change yet to existing flows): add `'restoring'` to `AuthStatus`; mirror the current token in a `tokenRef` alongside `session` state; extract credential handling into a reusable resolver used by both interactive sign-in and (later) boot/refresh that fetches whoami, sets session + `tokenRef` + status, writes `hq.autoSignIn`, and seeds `actingPerson` from `session-store` when the account is shared.

**Checkpoint**: Persistence + silent-sign-in + auth scaffolding ready.

---

## Phase 3: User Story 1 — Returning to the app stays signed in (Priority: P1) 🎯 MVP

**Goal**: A returning user reaches the dashboard on reopen with no interactive sign-in tap;
shared-account users return to their acting person with a dismissible affirm banner.

**Independent Test**: Sign in, fully close the app, reopen → calm restoring state then the
dashboard as the same person, no button tap (quickstart US1).

- [X] T006 [US1] Add a boot effect to `frontend/src/hooks/useAuth.tsx`: on mount, if `session-store.getAutoSignIn()` is set → status `restoring` and call `silentSignIn()` → run through the shared resolver; on decline/failure → `signed-out` (attempt once, never loop); if no hint → `signed-out`.
- [X] T007 [P] [US1] Create `frontend/src/components/auth/RestoringGate.tsx` — calm, branded loading state shown while `restoring` (FR-005), leaking no household data.
- [X] T008 [US1] Wire `frontend/src/App.tsx` to render `RestoringGate` while `status === 'restoring'` (before the `SignInGate` fallthrough).
- [X] T009 [P] [US1] Create `frontend/src/components/auth/ActingPersonAffirm.tsx` — dismissible banner "Signed in as <person> — switch?" with a one-tap switch that calls `setActingPerson` (persisting via `session-store`).
- [X] T010 [US1] In `frontend/src/App.tsx`, when a restored shared account has a valid remembered acting person, mount `ActingPersonAffirm` instead of the blocking `ActingPersonPrompt`; keep `ActingPersonPrompt` when there is no remembered person or it is stale/invalid, and let a server-resolved personal identity override any stored value.
- [X] T011 [P] [US1] Tests: boot-restore path (hint set → `restoring` → `signed-in`, acting person seeded) and `ActingPersonAffirm` render + switch, in `frontend/src/hooks/useAuth.test.tsx` and `frontend/src/components/auth/ActingPersonAffirm.test.tsx`.

**Checkpoint**: Returning users land signed-in; MVP is shippable here.

---

## Phase 4: User Story 2 — Long sessions never interrupt work (Priority: P2)

**Goal**: An authenticated action after mid-session token expiry succeeds via a silent
one-shot refresh + retry, with no interactive prompt and no lost input.

**Independent Test**: Sign in, let the token expire with the tab open, do a write → it
succeeds silently (quickstart US2).

- [X] T012 [US2] Add a single-flight `refreshToken()` and an `authedCall(action, payload, opts)` to `frontend/src/hooks/useAuth.tsx`: call `apiCall` with `tokenRef`; on `ApiError` `UNAUTHENTICATED`/`INVALID_CREDENTIAL`, share one in-flight `silentSignIn()` refresh, update `tokenRef` + session, retry the original request once; on refresh failure fall back to `signed-out` (clearing the in-flight promise after settle).
- [X] T013 [US2] Migrate authenticated call sites from `apiCall(..., { token: session!.token })` to `authedCall(...)` across `frontend/src/hooks/useTasks.ts`, `useEvents.ts`, `useMutations.ts`, `useActivity.ts`, `useRecurring.ts`, `useTemplates.ts`, and `useSettings.ts` (boot `fetchWhoAmI` stays direct).
- [X] T014 [P] [US2] Tests in `frontend/src/hooks/useAuth.test.tsx`: `authedCall` retries exactly once on an auth-error code, single-flight under concurrent failures triggers one refresh, and gives up cleanly (→ signed-out) when refresh fails.

**Checkpoint**: US1 + US2 both work; expiry no longer interrupts.

---

## Phase 5: User Story 3 — Signing out and account safety still work (Priority: P3)

**Goal**: Sign-out truly ends the persisted session (no auto re-entry), and revoked/removed
users fall back cleanly without a prompt loop.

**Independent Test**: Sign out → reopen shows the wall; revoke access → reopen falls back
cleanly, no loop (quickstart US3).

- [X] T015 [US3] Extend `signOut` in `frontend/src/hooks/useAuth.tsx` to call `session-store.clear()` (both `hq.autoSignIn` and `hq.actingPerson`) in addition to the existing `disableAutoSelect()`, so the next boot has no hint and shows the interactive wall.
- [X] T016 [US3] Harden the boot/restore path in `frontend/src/hooks/useAuth.tsx`: map whoami `FORBIDDEN`/`ALLOWLIST_MISCONFIGURED` during restore to `forbidden`; ensure a declined/failed silent attempt settles on the wall exactly once (no retry loop); confirm corrupt `hq.*` (already absent-on-corrupt from T002) yields `signed-out`.
- [X] T017 [P] [US3] Tests in `frontend/src/hooks/useAuth.test.tsx`: sign-out clears storage and next boot is `signed-out`; a forbidden restore lands `forbidden` with no loop; a declined silent attempt lands `signed-out` once.

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Run `/impeccable audit` on `RestoringGate` and `ActingPersonAffirm` (WCAG 2.1 AA contrast, ≥44px touch target, calm loading tone per DESIGN.md); apply fixes.
- [X] T019 `cd frontend && npm run build` passes with no type errors and `npm test` is fully green (existing 185 + new tasks' tests).
- [ ] T020 Execute `quickstart.md` manual validation on desktop **and** a phone (US1–US3, plus corrupt-storage and multi-account edge checks); record results in the PR (live Google OAuth can't run in the sandbox — real-device pass required).
- [X] T021 Update `BACKLOG.md` post-merge note (session persistence behavior; frontend-only, no scope/deploy change) and any `README`/spec wording if setup guidance changed.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T005)** blocks everything.
- **US1 (T006–T011)** depends on Foundational; is the MVP and should ship/validate first.
- **US2 (T012–T014)** depends on Foundational; independent of US1 (retry works regardless of
  boot restore) but naturally sequenced after it.
- **US3 (T015–T017)** depends on Foundational; independent of US1/US2.
- **Polish (T018–T021)** after the desired stories are complete.

### Within `useAuth.tsx` (same file — sequential, not parallel)

T005 → T006 → T012 → T015 → T016 all edit `frontend/src/hooks/useAuth.tsx` and must be done
in order. Their test tasks (T011/T014/T017) and the standalone components/helpers are [P].

### Parallel Opportunities

- T002 + T003 (session-store + its tests) in parallel with T001.
- T007 (`RestoringGate`) and T009 (`ActingPersonAffirm`) are independent new files → [P].
- Test tasks T011, T014, T017 run parallel to sibling non-`useAuth` work.
- T013 migrates seven independent hook files — parallelizable among themselves once T012 lands.

---

## Implementation Strategy

### MVP First (US1)

1. Setup (T001) → Foundational (T002–T005) → US1 (T006–T011).
2. **STOP and validate**: returning-user restore + affirm banner (quickstart US1). This alone
   removes the every-visit prompt — the feature's core value.

### Incremental Delivery

US1 (no re-prompt on return) → US2 (no mid-session interruption) → US3 (clean sign-out /
revocation) → Polish (audit + build/test + real-device quickstart). Each story is a safe,
independently testable increment.
