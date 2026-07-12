# Data Model: Settings Editor under More

No new tabs, columns, or Settings keys. This feature edits a fixed subset of existing
`Settings`-tab rows and appends `ActivityLog` rows. Below is the contract shape the editor
and `settings.update` operate on.

## Editable settings (the `settings.update` payload shape)

All values are strings on the wire and in the Sheet (plain-text convention). Every field is
optional in the payload; only present keys are written, and only if their value changed.

| Field | Sheet key | Type / accepted values | Validation rule |
|-------|-----------|------------------------|-----------------|
| Weekly digest on | `digestWeeklyEnabled` | `"TRUE"` \| `"FALSE"` | exact match |
| Weekly digest day | `digestWeeklyDay` | weekday name | one of `Sunday`…`Saturday` (case-insensitive on input, stored capitalized) |
| Monthly digest on | `digestMonthlyEnabled` | `"TRUE"` \| `"FALSE"` | exact match |
| Monthly digest day | `digestMonthlyDay` | `"last"` \| `"1"`…`"28"` | `last` or integer 1–28 |
| Digest hour | `digestHour` | `"0"`…`"23"` | integer 0–23 |
| ntfy pings on | `ntfyEnabled` | `"TRUE"` \| `"FALSE"` | exact match |
| Reminder minutes | `gcalEventReminderMin` | `"0"`, `"5"`, … | integer ≥ 0 |
| Timezone | `timezone` | IANA id from the curated set | one of the six allowed zones |

**Whitelist (backend-enforced)**: `EDITABLE_SETTINGS = [digestWeeklyEnabled, digestWeeklyDay,
digestMonthlyEnabled, digestMonthlyDay, digestHour, ntfyEnabled, gcalEventReminderMin,
timezone]`. Any key outside this list in the payload → `BAD_REQUEST` (defense in depth for
FR-013 / SC-004).

## Curated timezone options (frontend + backend allow-set)

| Label | IANA id |
|-------|---------|
| Pacific | `America/Los_Angeles` |
| Mountain | `America/Denver` |
| Central | `America/Chicago` |
| Eastern | `America/New_York` |
| Arizona (no DST) | `America/Phoenix` |
| Hawaii | `Pacific/Honolulu` |

## Cross-field rules

- No cross-field invariants. Disabling a digest does **not** clear its day (the day is
  retained so re-enabling restores the prior schedule). The UI MAY disable the day control
  while the digest is off, but still submits the retained value.
- Changing `digestHour` triggers a re-install of the `sendDigests` daily trigger (behavioral
  side effect, not a data field). See [contracts/settings-update.md](contracts/settings-update.md).

## ActivityLog row (appended on success)

| Column | Value |
|--------|-------|
| timestamp | now (ISO 8601, household tz) |
| actor | `max` \| `jaz` (resolved identity; shared account resolved to a person) |
| action | `settings-update` |
| targetId | `settings` |
| (detail/title) | short summary of changed keys (implementation detail) |

Exactly one row per successful save (FR-012, SC-002). `ACTION_VERBS['settings-update']` →
`"updated settings"` for the feed.

## State / lifecycle

Stateless upsert. No status transitions. Idempotent: re-submitting the same values writes
nothing new of consequence and re-installs the (already-correct) trigger harmlessly.
