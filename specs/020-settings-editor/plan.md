# Implementation Plan: Settings Editor under More

**Branch**: `020-settings-editor` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-settings-editor/spec.md`

## Summary

Add a curated **Settings** screen under **More** that lets Max or Jaz edit eight existing
Settings-tab keys — weekly/monthly digest on/off + day, digest hour, ntfy pings on/off,
calendar reminder minutes, and household timezone — via labeled controls (not a raw
key–value editor). A single **Save** button sends one new backend action, `settings.update`,
which validates the whitelisted keys, writes only those keys to the Settings tab under
`LockService`, re-installs the daily digest trigger when `digestHour` changed, and appends
one `settings-update` ActivityLog row. Emails, ntfy topics, calendar IDs, and weather/work
keys are never exposed.

## Technical Context

**Language/Version**: Backend — Google Apps Script (V8/ES2015+); Frontend — TypeScript 5, React 18.

**Primary Dependencies**: Backend: `LockService`, `ScriptApp` (already used, `script.scriptapp` scope present). Frontend: Vite, Tailwind, shadcn/ui, TanStack Query, existing `apiCall`/`useAuth`/`useSettings`.

**Storage**: The single Google Sheet, `Settings` tab (key/value rows). No new tab, no new keys.

**Testing**: Backend `SelfTest.js` (add settings-update assertions). Frontend Vitest + React Testing Library (component + hook tests), `npm run build` type-check.

**Target Platform**: Installable PWA (mobile-first) + desktop browser; Apps Script web app backend.

**Project Type**: Web application (`/frontend` + `/backend`).

**Performance Goals**: One round-trip save; whole-tab read + single batched write per request (existing convention). No perceptible added latency.

**Constraints**: 6-min Apps Script execution limit (trivially met); text/plain POST envelope (feature 001); idempotent + `LockService`-wrapped writes; every state change logged; dates/timezone handled through Settings.

**Scale/Scope**: Two users; one new backend action + handler; one new frontend screen (`SettingsView`), one mutation hook, small validation additions. ~8 editable fields.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ Shared household settings; no roles, no per-user scope. Emails/allowlist stay Sheet-only and are not editable here.
- **II. The Sheet Is the Source of Truth** — ✅ Writes go to the existing Settings tab via the same plain-text upsert path (`setSettingValue_`); tab stays hand-editable; only whitelisted keys touched, all others preserved.
- **III. Free-Tier Only** — ✅ No new services; reuses Sheets + ScriptApp.
- **IV. Boring and Debuggable** — ✅ Reuses `setSettingValue_`, `installDigestTrigger`, `appendLog_`, existing validation helpers, existing query/mutation patterns. No new abstractions.
- **V. Idempotent Generation** — ✅ `settings.update` is a pure upsert (re-saving identical values is a no-op-equivalent, safe to retry); trigger re-install already deletes-then-creates idempotently.
- **VI. Every State Change Is Logged** — ✅ One `settings-update` ActivityLog row per successful save (timestamp, actor, action, target).
- **VII. Spec-Driven Development** — ✅ This plan follows spec.md + clarifications.

**Result: PASS** — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/020-settings-editor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── settings-update.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # /speckit-tasks output (next command)
```

### Source Code (repository root)

```text
backend/
├── Api.js               # register 'settings.update' in HANDLERS; add updateSettings_ handler
├── Config.js            # add 'settings-update' to ACTION_VERBS; EDITABLE_SETTINGS whitelist
├── Sheets.js            # reuse setSettingValue_, appendLog_ (no change expected; batch helper if needed)
├── Digests.js           # reuse installDigestTrigger() (no change)
└── SelfTest.js          # add settings.update assertions (validation, whitelist, log, trigger)

frontend/
├── src/
│   ├── components/more/
│   │   ├── MoreView.tsx          # add "Settings" row → subscreen
│   │   └── SettingsView.tsx      # NEW curated form + Save
│   ├── hooks/
│   │   └── useSettings.ts        # add useUpdateSettings mutation (invalidate ['settings'])
│   ├── lib/
│   │   └── settings.ts           # NEW: field defs, timezone options, parse/serialize, validation
│   └── types/domain.ts           # optional: typed editable-settings shape
└── (tests colocated as *.test.tsx / *.test.ts)
```

**Structure Decision**: Existing two-project web layout. Backend adds one action + handler + whitelist; frontend adds one subscreen under the existing `MoreView` subscreen pattern (mirrors Recurring/Templates), one mutation on the existing `useSettings` query, and a small pure `lib/settings.ts` for field metadata and client-side validation.

## Key Design Decisions

1. **Editable-key whitelist (backend-enforced).** `EDITABLE_SETTINGS` in Config lists exactly the eight keys. `updateSettings_` ignores/rejects any other key in the payload, guaranteeing FR-013 and SC-004 server-side even if the client misbehaves. Booleans stored as `TRUE`/`FALSE` strings to match existing `isEnabled_` conventions.
2. **Reuse `setSettingValue_` per changed key inside one lock.** Writes only keys whose value actually changed (keeps the Settings tab diff minimal and avoids needless coercion). Wrapped so the whole save is atomic relative to other writers.
3. **Digest-hour trigger re-install (FR-010a).** After the write, if `digestHour` changed, call `installDigestTrigger()` (idempotent delete-then-create at the new hour). If it throws, surface the error so the save reports failure rather than a silently-stale trigger.
4. **Single Save + single log row.** The handler appends one `appendLog_(actor, 'settings-update', 'settings', <summary>)` row regardless of how many fields changed. New `ACTION_VERBS['settings-update'] = 'updated settings'`.
5. **Timezone as curated dropdown.** `lib/settings.ts` holds a fixed list of six US zones (Pacific/Mountain/Central/Eastern/Arizona/Hawaii). Backend still validates the incoming timezone against the same allowed set (defense in depth) so date handling can never be broken.
6. **Validation split.** Client-side validation for instant field feedback; backend re-validates every field (hour 0–23, reminder minutes ≥ 0 integer, weekly day a weekday, monthly day 1–28 or `last`, booleans, timezone in set) and rejects with `BAD_REQUEST` + `field` before any write — no partial writes.
7. **No new query.** Reuse the existing `['settings']` query (`useSettings`); the form seeds from it and the mutation invalidates it on success so the screen reflects persisted values (FR-014).

## Complexity Tracking

No constitution violations — section intentionally empty.
