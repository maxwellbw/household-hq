# Contract: `settings.update`

New backend action registered in `HANDLERS` (`backend/Api.js`). Same envelope as every other
action (feature 001): `text/plain` POST, HTTP 200 always, `ok` discriminates success.

## Request

```json
{
  "action": "settings.update",
  "token": "<Google ID token>",
  "payload": {
    "digestWeeklyEnabled": "TRUE",
    "digestWeeklyDay": "Wednesday",
    "digestMonthlyEnabled": "TRUE",
    "digestMonthlyDay": "last",
    "digestHour": "8",
    "ntfyEnabled": "FALSE",
    "gcalEventReminderMin": "15",
    "timezone": "America/Los_Angeles"
  }
}
```

- All payload fields **optional**; send any subset. Only whitelisted keys are accepted.
- `actingPerson` (`max`/`jaz`) required when signed in as the shared account, per the standard
  write path (auth gate resolves the actor; the shared account is never the actor).

## Auth

Standard write gate (feature 002): verified, allowlisted identity required. Actor comes from
the verified identity, never the client. Shared account must resolve to a person via
`actingPerson`.

## Behavior

1. Reject any payload key not in `EDITABLE_SETTINGS` → `BAD_REQUEST` (`field` = offending key).
2. Validate each provided value (see data-model.md). First invalid value → `BAD_REQUEST`
   with `field` = that key. **No writes happen if any field is invalid** (validate all first).
3. Read current Settings; for each provided key whose value **differs**, `setSettingValue_(key,
   value)` inside the lock. Unchanged keys and all non-whitelisted keys are untouched.
4. If `digestHour` was among the changed keys, call `installDigestTrigger()` to move the daily
   `sendDigests` trigger to the new hour. On failure, the whole action errors (`INTERNAL`).
5. Append exactly one `settings-update` ActivityLog row (actor, `targetId='settings'`).

Idempotent: re-sending identical values changes nothing and re-installs the already-correct
trigger harmlessly. Safe under concurrent writes (`withLock_`).

## Success response

```json
{
  "ok": true,
  "data": {
    "settings": { "...": "full current Settings map after the write" },
    "changed": ["digestHour", "ntfyEnabled"],
    "digestTriggerReinstalled": true
  }
}
```

- `settings`: the full settings map (same shape as `settings.list`) so the client can refresh
  without a second call.
- `changed`: keys actually written this save (may be empty if nothing differed).
- `digestTriggerReinstalled`: whether the trigger was re-installed this save.

## Error responses

| Code | When |
|------|------|
| `UNAUTHENTICATED` / `FORBIDDEN` | missing/invalid token or non-allowlisted / shared without `actingPerson` |
| `BAD_REQUEST` | unknown key, or an invalid value (`field` names the key) |
| `INTERNAL` | Sheet write or trigger re-install failed |

Error envelope: `{ "ok": false, "error": { "code", "message", "field?" } }`.

## Notes for `settings.list`

`settings.list` (existing) returns the full map and remains the source the editor seeds from.
No change to `settings.list`.
