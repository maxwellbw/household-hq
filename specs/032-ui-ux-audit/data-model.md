# Data Model — Feature 032

No Sheet schema changes. No new API entities. Three device-local state entities (frontend only):

## ThemePreference

| Field | Type | Rules |
|---|---|---|
| value | `'system' \| 'light' \| 'dark'` | default `'system'`; persisted at `localStorage['hq.theme']` |
| resolved | `'light' \| 'dark'` (derived) | `value === 'system'` ? OS scheme (live via matchMedia) : `value` |

**Transitions**: any → any via Settings → Appearance. `resolved` re-derives on OS change only while `value === 'system'`. Unreadable/invalid stored value → treated as `'system'` (never throws).

**Effects of `resolved`**: `<html data-theme>` attribute · `theme-color` meta content · nothing else (all styling flows from tokens).

## OwnerFilterState

| Field | Type | Rules |
|---|---|---|
| visibleOwners | set of `'max' \| 'jaz' \| 'both'` | persisted at `localStorage['hq.ownerFilter']`; empty set normalizes to all three on read **and** on the toggle that would empty it |

**Scope**: one instance app-wide (context), consumed by Calendar and Tasks. Per device; never synced.

## UndoableAction (transient, in-memory)

| Field | Type | Rules |
|---|---|---|
| label | string | toast copy, e.g. "Done — Jaz will see this in the feed" |
| inverse | existing mutation invocation | must be an already-idempotent API action (task reopen, list-item re-add) |
| expiresAt | timestamp | now + ~6s; expiry dismisses the toast, nothing else |

**Rules**: the forward action commits immediately (no delayed writes — the other user's visibility is never held hostage to a toast). Undo fires `inverse`, which appends its own ActivityLog entry via the backend's normal logging (append-only preserved). At most one undo toast at a time; a new undoable action replaces (and finalizes) the previous toast.

## Derived view groupings (no storage)

- **Task horizons** (F-14): `This week` (due ≤ end of household week) / `Next week` / `Later` / `Someday` stays its own view. Boundaries use the household timezone week already used by digests; empty groups hidden.
- **Lately entries** (F-18): head of the existing activity query (cap ~4), no persistence.
