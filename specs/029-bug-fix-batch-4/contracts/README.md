# API Contracts — Bug-fix batch 4

**No new or changed API action.** This feature introduces no backend endpoint and no change to any request/response shape.

## Reused, unchanged actions

- `templates.list` — read the TaskTemplates (US5 populates the prep-template picker). Existing.
- `events.create` — accepts the existing optional `templateId`; on create, `syncPrepForEvent_` attaches the template's prep tasks. US5 simply starts sending `templateId` from the UI. Existing shape.
- `events.update` — same; `syncPrepForEvent_` re-runs on edit to reconcile prep against the new `templateId` (idempotent, swaps not-yet-started prep). Existing shape.
- `dogwalks.list` — read the DogWalks ledger (US1 surfaces walks in the Day Peek; already consumed by the calendar and 7-day strip). Existing.
- `tasks.list` — `status` field already returned; US2 only restyles done tasks. Existing.

## Backend behavior hardened (no contract change)

- `runDogWalkFinder` / `fetchForecast_` (US6): internal retry + clearer logging. The web-app request/response contract is unaffected — this is trigger-time behavior only.

## Frontend contracts

The UI contracts (Day Peek walk row, strikethrough treatment, notice dismissal, scroll-lock, prep picker, calendar render stability) are validated behaviorally in [../quickstart.md](../quickstart.md); they introduce no serialized interface.
