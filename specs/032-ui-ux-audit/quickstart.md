# Quickstart Validation — Feature 032

Live validation of the theming + hygiene work. Backend untouched; only the frontend deploy path matters.

## Prerequisites

- `cd frontend && npm install` (no new deps expected — flag any lockfile delta in review)
- Local: `npm run dev`. Deployed: merge → Pages, or validate on the PR preview build
- Sandbox-friendly auth: `cd backend && clasp run mintDevSessionToken` → paste into `localStorage['hq.sessionToken']`

## 1 — Theme resolution matrix (FR-001..003 / SC-001..002)

| # | OS scheme | In-app pref | Expect |
|---|---|---|---|
| 1 | light | (unset) | light |
| 2 | dark | (unset) | dark, no white flash on cold load |
| 3 | dark | Light | light, survives reload |
| 4 | light | Dark | dark, survives reload |
| 5 | dark→light live | System | follows < 1s, no reload, open sheet/toast re-themes with it |
| 6 | any | Dark → System | returns to OS scheme |

Emulate OS scheme in DevTools (Rendering → prefers-color-scheme) and via real device settings for the installed PWA.

## 2 — Full-surface dark sweep (SC-001)

In dark, walk: Dashboard (all four data states below) · Calendar month/week/next-7 (Schedule-X chrome: grid, header, chevrons — no cool-gray leftovers) · Tasks (grouped) · Lists · More + every leaf (Feed, Recurring×2, Prep, Settings) · quick-add dialog · schedule dialog · event popover · planner sheet (renders themed; interaction fixes are 033) · toasts · skeletons · error states · sign-in and restoring gates. Zero light remnants.

## 3 — Dashboard reading order (FR-007..011 / SC-004)

Seed via UI or Sheet: (a) overdue+due, (b) overdue only, (c) due only, (d) both empty.
- Order per contract C7; overdue first and urgent; today pre-selected in strip; **no** standalone Today section; state (d) shows exactly one warm line.
- Lately strip: shows recent partner activity, links to Feed; with Feed forced to fail (offline), strip hides, dashboard shows no error.
- Grocery nudge tap → Lists → Groceries Needed (and an honest empty state if nothing needed).
- Load balance: all-zero week collapses to one line; leader shown as a sentence.

## 4 — States & feedback (FR-012..015 / SC-005..006)

- DevTools offline → open Feed and Lists: ErrorState with Retry; press Retry offline (honest, no stacking), go online, Retry recovers.
- Complete a task: no confirm; toast with Undo; Undo → task back to open, ActivityLog shows complete **and** reopen entries (check Sheet). Let one lapse: nothing further. Complete two rapidly: one toast at a time.
- Delete a list item: same pattern. Delete an event: **still confirms** (calendar-synced).
- Freshness: every surface shows the C4 relative format; no absolute clocks; two views visible in one session agree.

## 5 — Contrast + a11y sweep (FR-005, FR-023 / SC-001)

- Run the contrast checks for the token-pair list in C1 (script or manual picker) in **both** themes — record results in the PR.
- axe (or equivalent) pass on Dashboard, Tasks, Calendar, Settings: calendar item buttons and More rows expose real accessible names (the audit's F-20 tree anomaly resolved or explained).
- Settings toggle and disabled Save visibly stateful in both themes; keyboard focus ring visible on dark.
- `prefers-reduced-motion` still honored (spot-check toast + check animation).

## 6 — Desktop layout (FR-016 / SC-007)

At ≥1280px: Settings/More leaves in a bounded column; scroll every view top-to-bottom — quick-add never covers Save, list rows, or any tappable. Avatar tap opens menu (identity + sign out), single tap never signs out.

## 7 — Tasks/Lists/filters (FR-017..021 / SC-008)

- Tasks grouped by horizon with counts, soonest first; commitment affordance quieter than titles; rows align.
- Someday appears only in its home; calendar tab no longer embeds it.
- Set owner filter on Calendar → same on Tasks; reload → persists; deselect-all → behaves as all.
- Lists: one primary add per context; star meaning discoverable.

## 8 — Icons & chrome (FR-004)

- Browser tab: favicon adapts with OS scheme (light + dark OS).
- Installed PWA (Android + iOS if available): chrome color matches in-app theme; home-screen icon reviewed on dark wallpaper; limitation note present in DESIGN.md/README.

## 9 — Regression gates

- `npm run build` clean; `npm test` clean.
- `/impeccable audit` on the finished surface — no unwaived findings (definition of done).
- DESIGN.md updated (dark tokens with final values, ink drift, nav reality, dark-mode line removed) — reviewed in the same PR.
