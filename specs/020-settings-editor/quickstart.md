# Quickstart / Validation: Settings Editor under More

End-to-end checks proving the feature. Run after `clasp push && clasp deploy` (backend) and
with the frontend on the new deployment.

## Prerequisites

- Backend deployed with the `settings.update` action live.
- Signed in to the app as Max or Jaz (or shared account with a chosen acting person).
- Have the Google Sheet open in another tab to confirm persistence and non-interference.

## Backend self-test

```bash
cd backend && clasp push && clasp deploy
# In the Apps Script editor, run selfTest() and confirm the new settings.update
# assertions pass (validation rejects bad values; whitelist blocks non-editable keys;
# one ActivityLog row per save; trigger re-install path exercised).
```

## Scenario 1 — Digest schedule (US1)

1. Open **More → Settings**. Confirm the form shows current values from the Sheet.
2. Turn **Weekly digest** off; set **Monthly digest day** to `last`; set **Digest hour** to `8`.
3. Tap **Save**. Expect a success confirmation.
4. In the Sheet, confirm `digestWeeklyEnabled=FALSE`, `digestMonthlyDay=last`, `digestHour=8`;
   confirm **no other Settings row changed** (emails, topics, calendar id, weather keys intact).
5. In the Apps Script editor → Triggers, confirm the daily `sendDigests` trigger now fires at
   hour 8 (FR-010a).
6. Reload the app → values persist (FR-014). Check the activity feed shows one
   "updated settings" entry by you (FR-012).

## Scenario 2 — Pings + reminder minutes (US2)

1. In **Settings**, toggle **ntfy pings** off; set **Reminder minutes** to `15`. Save.
2. Sheet shows `ntfyEnabled=FALSE`, `gcalEventReminderMin=15`.
3. Complete a task → confirm no ntfy ping is sent.
4. (Optional) Trigger a calendar sync of a timed event → its reminder is 15 min.

## Scenario 3 — Timezone (US3)

1. In **Settings**, change **Timezone** from the dropdown (e.g. Pacific → Eastern). Save.
2. Sheet shows `timezone=America/New_York`.
3. Reload the app → date/time displays reflect the new zone.
4. Confirm the dropdown offers only the six curated US zones (no free text).

## Negative / edge checks

- Send `gcalEventReminderMin = -5` (e.g. via dev tools) → `BAD_REQUEST`, field
  `gcalEventReminderMin`, **nothing written**.
- Send `digestHour = 25` → `BAD_REQUEST`, field `digestHour`, nothing written.
- Send a non-whitelisted key (e.g. `maxEmail`) in the payload → `BAD_REQUEST`; the email row in
  the Sheet is unchanged (FR-013, SC-004).
- Save with no changes → success, `changed: []`, no new ActivityLog row of consequence and no
  spurious trigger churn (idempotent).

## Definition of done for validation

- [ ] All three scenarios pass and persist across reload.
- [ ] Non-whitelisted and invalid inputs are rejected with no partial writes.
- [ ] Exactly one activity entry per successful save.
- [ ] Digest trigger fires at the newly chosen hour.
- [ ] `npm run build` passes with no type errors; new UI passes an `/impeccable audit`.
