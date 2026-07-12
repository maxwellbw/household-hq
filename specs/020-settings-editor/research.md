# Research: Settings Editor under More

All spec-level unknowns were resolved during `/speckit-clarify` (see spec.md §Clarifications).
This file records the technical decisions grounded in the existing codebase.

## R1 — Where do the editable values already live?

**Decision**: Reuse existing Settings-tab keys; introduce no new keys.

Editable keys and their current seed defaults (`backend/Config.js` `SETTINGS_SEED`):

| Key | Default | Control | Validation |
|-----|---------|---------|-----------|
| `digestWeeklyEnabled` | `TRUE` | toggle | `TRUE`/`FALSE` |
| `digestWeeklyDay` | `Sunday` | weekday select | one of Sunday…Saturday |
| `digestMonthlyEnabled` | `TRUE` | toggle | `TRUE`/`FALSE` |
| `digestMonthlyDay` | `last` | select | `last` or 1–28 |
| `digestHour` | `7` | hour select | integer 0–23 |
| `ntfyEnabled` | `TRUE` | toggle | `TRUE`/`FALSE` |
| `gcalEventReminderMin` | `30` | number | integer ≥ 0 |
| `timezone` | `America/Los_Angeles` | dropdown | one of the six US zones |

**Never editable here (Sheet-only)**: `maxEmail`, `jazEmail`, `sharedEmails`, `ntfyTopicMax`,
`ntfyTopicJaz`, `householdCalendarId`, `gcalTaskReminderTime`, `workIcsUrl*`, `household*`,
`weather*`, `recurring*`. **Rationale**: auth/safety (emails, topics) and out-of-feature scope.

## R2 — How to write Settings safely?

**Decision**: Reuse `setSettingValue_(key, value)` (`backend/Sheets.js:468`) — a plain-text,
`withLock_`-serialized upsert by key. The handler calls it once per **changed** key, so
untouched keys and hand-added rows are preserved (Constitution II, FR-010, SC-004).

**Alternative rejected**: a bespoke batch writer. `setSettingValue_` already exists, is
lock-safe and plain-text-safe; per-key calls for ≤8 fields is well within limits and keeps
the code boring (Constitution IV).

## R3 — Digest-hour trigger behavior

**Decision**: After writing, if `digestHour` changed, call `installDigestTrigger()`
(`backend/Digests.js:338`). It deletes any existing `sendDigests` trigger and recreates it
at `resolveHour_(readSettingsMap_())` — idempotent, reads the just-written value. This fully
satisfies FR-010a with existing code. `ScriptApp` requires `script.scriptapp`, already in the
manifest (used by recurring/prep/calendar triggers), so no scope change and no re-auth.

**Failure handling**: If `installDigestTrigger()` throws (transient quota/scope), let it
propagate → `doPost` returns `INTERNAL`/error envelope → the UI reports save failure
(Edge Case: "Digest hour vs. trigger"). Ordering: write the value first, then re-install; a
retry re-runs both idempotently.

## R4 — Activity logging for a keyless (id-less) tab

**Decision**: Settings rows have no `id`, so reuse `appendLog_(actor, action, targetId, title)`
(`backend/Sheets.js:442`) directly with a fixed `targetId = 'settings'`. Add
`ACTION_VERBS['settings-update'] = 'updated settings'` (`backend/Config.js:98`) so the
activity feed renders it. One row per save regardless of field count (FR-012, SC-002).

## R5 — Backend validation approach

**Decision**: The generic `validateFields_`/`rejectUnknownFields_` helpers are tab-schema
driven and don't fit the Settings key/value shape, so add a small purpose-built validator in
`updateSettings_`: whitelist check per key, then per-key value check using the same rules the
digest resolvers already accept (`resolveWeekday_`, `resolveMonthlyDay_`, `resolveHour_` in
`backend/Digests.js` define the canonical accepted formats). Reject with `fail_('BAD_REQUEST',
msg, key)` before any write → no partial writes (FR-009, SC-003).

## R6 — Frontend data flow

**Decision**: Reuse the existing `['settings']` TanStack Query (`useSettings.ts`). Add
`useUpdateSettings()` in the same file: a `useMutation` calling `authedCall('settings.update',
payload)` that on success calls `queryClient.invalidateQueries(['settings'])`. The
`SettingsView` seeds local form state from the query, and Save calls the mutation. This
mirrors the read-then-invalidate pattern used across the app and guarantees FR-014.

**UI placement**: A new `'settings'` subscreen in `MoreView.tsx`, exactly like the existing
`recurring`/`templates` subscreens (back header + body), added under the **Manage** section.

## R7 — Boolean representation

**Decision**: Store booleans as the strings `TRUE`/`FALSE`, matching seeds and the
blank/invalid-fails-open-to-`TRUE` reader `isEnabled_` (`backend/Digests.js:65`). The form maps
UI toggle ⇄ `TRUE`/`FALSE`. Avoids introducing a second truthiness convention.
