# Contract: Engine Extensions (cadences + ordinal titles)

Shared between backend (source of truth) and frontend (must stay in sync). All three are
additive — no existing behavior changes.

## 1. Cadence enum — two new values

Backend `CADENCES` (Config.js) and frontend `Cadence` (types/domain.ts) MUST list the same
values. Adds `semiannually` and `thanksgiving-sat`.

**Backend semantics** (Recurring.js):

- `CADENCE_STEP_('semiannually', ymd)` → `addMonthsClamped_(ymd, 6)`.
- `CADENCE_STEP_('thanksgiving-sat', ymd)` → `addMonthsClamped_(ymd, 12)` (non-throwing
  fallback; the real dates come from the special branch below).
- `occurrencesInWindow_(anchor, 'thanksgiving-sat', startExclusive, endInclusive)` →
  for each year `Y` from `year(anchor)` to `year(endInclusive)`, emit
  `thanksgivingSaturday_(Y)` when it is in `(startExclusive, endInclusive]`. Exactly one
  candidate per year.

**Pure helpers** (Recurring.js, unit-tested in isolation):

- `fourthThursdayOfNovember_(year)` → `YYYY-11-DD` of the 4th Thursday (first Thursday + 21d).
- `thanksgivingSaturday_(year)` → that Thursday − 5 days (the Saturday of the weekend before).
- Worked example: 2026 Thanksgiving = 2026-11-26 (Thu) → lights due 2026-11-21 (Sat).
  2027 = 2027-11-25 → 2027-11-20. 2028 = 2028-11-23 → 2028-11-18.

**Frontend** (must add all three in lockstep, mirroring the `sixweekly`/`eightweekly`
precedent):

- `types/domain.ts`: extend the `Cadence` union.
- Label maps in `RecurringManager.tsx`, `RecurringEventsManager.tsx` (and the label source
  used by `QuickAddSheet.tsx`): `semiannually → "Every 6 months"`,
  `thanksgiving-sat → "Weekend before Thanksgiving"`.
- The three `CADENCES: Cadence[]` dropdown arrays: append both values.

Validation: cadence-membership validation (`Validation.js`) accepts the two new values by
virtue of their presence in `CADENCES`; `validateSeasonWindow_` is unchanged.

## 2. Ordinal-title token `{nth}`

- Input: a `RecurringEvents.title` optionally containing the literal `{nth}`.
- `ordinal_(n)` → English ordinal string: `1→"1st"`, `2→"2nd"`, `3→"3rd"`, `4→"4th"`,
  `11→"11th"`, `12→"12th"`, `13→"13th"`, `21→"21st"`, `22→"22nd"`, `23→"23rd"`, `101→"101st"`.
- `renderOccurrenceTitle_(ruleTitle, anchorDate, occurrenceDate)`:
  - `n = year(occurrenceDate) − year(anchorDate)`.
  - if `ruleTitle` contains `{nth}` **and** `n ≥ 1` → replace every `{nth}` with `ordinal_(n)`.
  - else → return `ruleTitle` unchanged (token, if any and `n < 1`, is stripped to a
    token-less base — not expected in practice; see research R4).
- Applied in `generateForEventRule_` when constructing the occurrence `title`; the result is
  the stored `Events.title` (baked, then mirrored to Google Calendar by feature 007).

Frontend: **none** — occurrence titles arrive pre-rendered from the backend.

## 3. New `computeSeedAnchor_` anchorRules (Seed.js)

Consumed only by seed packs; not user-facing.

- `today+Nmo` → `addMonthsClamped_(today, N)` (regex `^today\+(\d+)mo$`).
- `monthday-MM-DD` → `nextMonthDayOnOrAfter_(today, MM, DD)` (regex `^monthday-(\d{2})-(\d{2})$`).
- Existing `today`, `today+7`, `fall-oct15`, `fall-nov1` unchanged.
- Unknown anchorRule still `fail_('VALIDATION_FAILED', …)` (existing default).
