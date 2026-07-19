# UI/UX Audit — Feature 032 (pre-spec deliverable)

**Date:** 2026-07-18 · **Method:** live drive of the deployed GitHub Pages app (dev session token, real Sheet data) at 464px-class mobile and 1280×800 desktop, plus source review of `/frontend/src` for states not reachable live. Screenshots were reviewed during the audit but are not committed (repo is public; live data contains personal task titles — per CLAUDE.md, personal data stays out of tracked files). Findings referencing on-screen text use generic descriptions instead of real titles.

**Triage key:** each finding is assigned to **[032]** (theming system + systemic UI hygiene), **[033]** (dog-walk planner rework + dashboard↔calendar parity), or **[Q]** (product question for Max before speccing).

---

## Health score (impeccable audit rubric)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | Strong foundations (focus rings, rich ARIA on task/hour rows, reduced-motion); a verify-list remains (F-20) |
| 2 | Performance | 3/4 | Code-split + lazy chunks, batch reads; no observed jank |
| 3 | Responsive design | 2/4 | Desktop FAB occludes content (F-08); full-width leaf views (F-13); titles vanish in narrow columns (F-05) |
| 4 | Theming | 2/4 | Token discipline is exemplary — but no dark mode at all, and it's the feature ask (F-01) |
| 5 | Anti-patterns | 3/4 | Warm, distinctive, not AI-slop; a dead dropdown and Material-style selects are the "strangeness without purpose" tells (F-11) |
| **Total** | | **13/20** | **Acceptable — significant work needed, foundations are good** |

**Anti-pattern verdict:** pass. The app does not read as AI-generated; it reads as a real product with accretion debt (duplicated controls, orphaned affordances) from 31 shipped features.

---

## P1 — fix before/within these features

### F-01 [032] No dark mode, no theme preference, no dark icon
- **Location:** `frontend/src/index.css` (`color-scheme: light`, single `:root` block), `frontend/index.html` (one `theme-color`), `frontend/public/manifest.webmanifest` (light icons only), `DESIGN.md` ("Dark mode: deferred — don't scaffold for it")
- **Impact:** OS in dark mode (verified live: `prefers-color-scheme: dark` matched, page stayed light) renders a bright ivory app at night; the ask is system-following **and** user-overridable theming plus a dark app icon.
- **Recommendation:** dark token set as `[data-theme="dark"]` + `prefers-color-scheme` default; three-way preference (System / Light / Dark) persisted per device; `theme-color` meta swap; dark-scheme SVG favicon (`@media (prefers-color-scheme)` inside the SVG) — note the PWA *manifest* icon cannot switch with theme, so document that limit honestly. Rewrite the DESIGN.md line. The single-`:root`-block token discipline (every hex appears exactly once in src) makes this cheap — that's the payoff of 31 features of token hygiene.

### F-02 [033] Dog-walk planner is unreachable from the Calendar
- **Location:** `CalendarViewSwitcher.tsx` (Month/Week/Next 7 days only); desktop month grid walk pills (`EventContent.tsx:60` renders the "Dog walk — weather" chip) have no click handler — verified live: clicking does nothing.
- **Impact:** the calendar is the organizing metaphor, but the only route to the planner is Home → day chip → walk row. From the calendar, a flagged walk is a dead pill.
- **Recommendation:** walk items on every calendar view open the planner sheet; "needs a decision" chips are visually urgent and clickable.

### F-03 [033] Mobile calendar views omit dog-walk items entirely
- **Location:** mobile month day-list, week, and next-7 views (`DayListView.tsx` / `DayColumn.tsx` item sourcing)
- **Impact:** verified live: a day with a needs-decision walk shows "—" (empty) in next-7 view on mobile; the same day on desktop month shows the warning pill. Phones are the daily driver (PRODUCT.md); the highest-urgency item type is invisible there.
- **Recommendation:** include walk items (booked + needs-decision) in the mobile views' item sources, tappable through to the planner.

### F-04 [033] "Open in calendar" ignores the target date
- **Location:** `App.tsx:49–53` — `calendarFocusDate` is cleared by an effect the moment `active === 'calendar'`, while `CalendarHome` is lazy-loaded (`LazyBoundary`) and may mount after the clear. Verified live: alert for a future date landed on the month view with today still selected.
- **Impact:** every deep link from Home (walk alerts, day cards) silently dumps the user at the wrong date — the tether between dashboard and calendar is broken at its main joint.
- **Recommendation:** hand the focus date to `CalendarHome` in a way that survives lazy mount (consume-on-mount callback or keyed prop), and have walk alerts open the **planner** for that date directly rather than the bare calendar.

### F-05 [033] Title truncation makes week/next-7 and planner cards unreadable
- **Location:** `EventContent.tsx:100–110` — title span `truncate` next to `shrink-0 ml-auto` TASK badge: in ~110px columns the badge wins and the title truncates to **zero characters** (verified live: pills render as just an owner dot + "TASK"). Planner busy/event cards show 3–4 chars ("Insi…", "Offi…").
- **Impact:** Max's complaint verified end-to-end: work-calendar titles are unreadable everywhere narrow. A week view whose every pill reads "TASK" carries zero information.
- **Recommendation:** title gets layout priority (badge drops first, or moves to a second line); tap-through already opens details — add full title there (planner cards currently aren't tappable at all); consider multi-line clamp in planner lanes where vertical space allows.

### F-06 [033] Planner hour-tap has no visible selection; confirm bar is below the fold
- **Location:** `DogWalkPlanner.tsx` `HourRow` (no selected-state styling; `pendingBook` renders as a bar after the full-height timeline)
- **Impact:** verified live: tapping an hour changes nothing on screen — the "Book 10:00 AM–11:00 AM?" confirm bar exists but sits past ~10 screen-heights of timeline. Max's "hard to see what hour you've clicked," precisely. Bonus hazard: the tap targets are labeled "tap to book" and the only guard against a mis-tap is a confirm bar the user can't see.
- **Recommendation:** selected-hour highlight in the timeline + sticky confirm bar (pinned to sheet bottom) + scroll-into-view. The a11y labels on hour rows are already excellent — the visual layer just never caught up.

### F-07 [033] Booking is 60-minute, on-the-hour only — the backend already supports more
- **Location:** `DogWalkPlanner.tsx:426–441` — hour tap hardcodes `primaryDurationsMin[0]` and `:00` start. Backend `bookWalk` accepts arbitrary `windowStart/windowEnd/durationMin`; Settings already holds `dogWalkDurationsMin = 60,45,30` (`backend/Config.js:356`).
- **Impact:** can't book a 3:30 walk or a 30-minute walk; the finder itself suggests 30m windows (observed: a chosen "30m, primary" candidate) that manual booking can't reproduce.
- **Recommendation:** 15-min start granularity (tap-then-adjust or draggable window) + duration picker seeded from `dogWalkDurationsMin`. Frontend-only for the core; backend untouched unless validation needs loosening. Also expose booking the **backup** slot manually (hour tap currently hardcodes `slot: 'primary'`).

### F-08 [032] Desktop FAB occludes content (Save button, list rows)
- **Location:** `AppShell.tsx:77` — `<main>` has `pb-[calc(4rem+…)] sm:pb-0`; FAB is fixed `sm:bottom-6 right-4`. Verified live: FAB sits on top of Settings' Save button and list rows at 1280×800.
- **Impact:** the primary action of a form is partially covered by an unrelated floating button.
- **Recommendation:** desktop bottom padding on `<main>` (or move quick-add into the top bar on `sm:`— the FAB is a thumb-reach pattern that has no rationale on desktop).

### F-09 [032] Feed error state has no retry
- **Location:** `FeedView.tsx:56–63` ("Could not load activity / Check your connection and try again" — no button); same copy pattern in `ListsView.tsx:102` (verify retry affordance there too)
- **Impact:** observed live (feed failed while every other view worked): the copy says "try again" and offers no way to; only escape is re-navigating. `BootErrorGate.tsx` already has the right pattern (Retry + aria-busy).
- **Recommendation:** shared error-state component with retry wired to the query's `refetch`; sweep all `isError` branches for parity. Also worth a look: why feed failed while other bootstrapped views worked (separate query, no bootstrap seed?).

### F-10 [033] Walk alert banners: wrong copy, duplication, and alarm fatigue
- **Location:** `DogWalkNotice.tsx` / `AckNotices.tsx`
- **Impact:** verified live: two stacked banners both read "…**today**" for dates 5 and 10 days out (copy bug — label says the future date, sentence says today); each is a full-width accent-bordered alert, so Home's prime real estate opens with what looks like two urgent errors about days that haven't arrived.
- **Recommendation:** date-aware copy ("No good-weather window **on Thu**"); collapse multiple walk notices into one row ("2 upcoming walks need a decision"); reserve alarm styling for today/tomorrow; "Open in calendar" → "Open planner" (per F-04).

## P2 — fix in the same passes

### F-11 [033] Calendar control accretion: duplicate view switchers, a one-option dropdown, off-vocabulary selects
- **Location:** `CalendarViewSwitcher.tsx` + `CalendarHome.tsx` header — segmented Month/Week/Next-7 **and** a floating-label "View" select whose only option is "Month" (verified live), plus a "Date" select in Material outline style unlike every other control in the app.
- **Recommendation:** one segmented control; kill the View select; restyle date-picking to the app's control vocabulary (likely Schedule-X's rendered controls — repoint or replace, see F-17).

### F-12 [033] Month-grid day dots are all accent orange — owner identity missing
- **Location:** mobile month view day markers
- **Impact:** "owner color is identity, never decoration — in every view" is the constitution's design principle; the month grid is the one view that ignores it (all dots terracotta regardless of Max/Jaz/Both).
- **Recommendation:** owner-colored dots (cap at 3–4 with overflow), matching the seven-day strip's convention on Home.

### F-13 [032] Desktop leaf views run full-bleed — no content column
- **Location:** Settings/More leaf views at 1280 (label far-left, control far-right, ~1100px of dead space between)
- **Recommendation:** DESIGN.md's ~1100px (settings-type forms closer to ~640px) max-width column on desktop leaf views.

### F-14 [032] Tasks view: 34-row flat list with per-row commitment buttons
- **Location:** `TasksView.tsx`
- **Impact:** one undifferentiated "OPEN (34)" list from "Tomorrow" to "In 30+ days"; the outlined "I've got it" button repeats on most rows, visually louder than the titles; rows without it (committed/Both) make the column ragged.
- **Recommendation:** group by horizon (This week / Next week / Later); demote un-commitment to a quieter affordance (chip/menu) or show it on hover/tap; consistent right-edge column.

### F-15 [032] Lists view: three "+" affordances and an unexplained star
- **Location:** `ListsView.tsx` — global FAB, add-item field button, dashed new-list chip all visible at once; star (staple?) never explained; "Not grocery" as a tab label.
- **Recommendation:** FAB adds-in-context (or hides here); label the star's meaning on first use or in an edit sheet; rename the tab ("Household"?— Max's call).

### F-16 [033] Completed tasks clutter calendar day lists; event popover shows raw URL
- **Location:** day-list under mobile month (done tasks render strikethrough at full prominence, and the day's list can be **only** struck-through items); event popover prints the full maps URL as a link and sets Delete directly beside Edit.
- **Recommendation:** collapse done tasks ("2 done ✓" affordance); popover link becomes "Open map ↗"; separate/derisk Delete.

### F-17 [032] Off-palette vendor UI leaking through (Schedule-X)
- **Location:** cool-gray `#B8B5B8` chevron data-URIs (observed in network log, not in src — they ship inside Schedule-X CSS); Material floating-label selects (F-11) are Schedule-X's rendered header controls.
- **Impact:** `calendar-theme.css` repoints the color variables but not iconography/control chrome; and it has **no dark story**, which becomes required in 032.
- **Recommendation:** extend the Schedule-X override layer (icons, selects) and add dark-mode values for every `--sx-*` mapping; if the override surface keeps growing, revisit how much of Schedule-X's chrome we use vs. our own header (its grid is the valuable part).

### F-18 [032] Feed is buried while the app's promise depends on it
- **Location:** bottom nav evolved to Home·Calendar·Tasks·Lists·More (docs still say Calendar·Tasks·Feed·More); Feed lives two taps deep in More; completion toast promises the other person "will see this in the feed."
- **Impact:** "completions are seen without asking" (PRODUCT.md success criterion) has no passive surface — nobody browses to More→Feed.
- **Recommendation:** small "Lately" strip (last 3–5 feed items) on Home; update DESIGN.md/PRODUCT.md nav description to match reality. Keeping Lists in the tab bar looks right — it's daily-use.

### F-19 [032] Dashboard load-balance: zero-noise and cryptic "MORE" tag
- **Location:** `LoadBalance.tsx:77–81` — all-zero week renders three 0-rows; leader row shows a tiny uppercase "more" chip that reads as a button ("MORE 8").
- **Recommendation:** collapse the all-zero case to one quiet line; replace the chip with plain copy ("Max is carrying more this month") in the section's voice. Also unify "You" vs name usage with owner chips elsewhere.

### F-20 [032] Accessibility verify-list (from live tree reads; not all confirmed) — ✅ RESOLVED in T033
- Calendar item pill buttons and More-menu rows surfaced with **empty accessible names** in the a11y tree read (`DayColumn.tsx` buttons wrap `EventContent`; `MoreView.tsx` rows have visible text spans — may be a tooling artifact, must verify with a real screen reader/axe). → **Tooling artifact confirmed.** axe-core 4.12 and the DOM both compute correct names (day tiles via `aria-label`, everything else via visible text content). No fix needed on these; the anomaly was the tree reader, not the markup.
- Contrast to verify at token level (light **and** the new dark set): `--warning` #B07C2E small text on `--bg` (the planner's "Too hot" labels); `--ink-muted` on `--surface-alt` and on owner-soft tints; disabled Save button (washed terracotta + white text, clearly <3:1 — restyle disabled state). → **Verified + fixed.** `--warning` on bg/surface is planner-only (033) and stays gated at the 3:1 UI bar; `--ink-muted` on surface-alt passes (5.43 light / 5.74 dark); the "Task" tag on owner-soft tints was moved from `ink-faint`→`ink-muted` (was 3.97–4.39). Disabled buttons restyled (see below). The full accent-as-text family moved to the new `--accent-strong` token.
- Settings toggle knob is nearly invisible against the track edge (verified visually) — restyle switch. → **Fixed:** bordered track + bordered contrasting knob, stateful in both themes.
- Planner temp ✓/× glyphs: good (not color-only) — keep. → kept (planner is 033).

## Round 3 findings — T033 axe sweep (added 2026-07-19)

axe-core 4.12 (WCAG 2.0/2.1 A+AA), run in-browser on Dashboard, Calendar, Tasks, Lists, More-hub, Feed, Recurring Rules, Recurring Events, Prep Templates, Settings — **both themes**. All fixed in T033; re-run is clean (9 surfaces × 2 themes, zero violations).

- **F-35 [032, P1] Accent-as-text below 4.5:1** — white-on-`--accent` fills (day-strip selected tile, "Both" MJ badge, calendar view switcher) and accent-colored link buttons ("See all", "Open in calendar", active nav) landed at 3.76–4.05:1 in light, 4.18–4.24:1 on some dark surfaces. Fixed via new `--accent-strong` token (4.5:1+ everywhere); CI-gated.
- **F-36 [032, P1/critical] Settings form controls unlabeled** — every `<select>` (4) and the reminder-minutes `<input>` reached axe with no accessible name; `FieldRow` rendered its label as a bare `<span>`. Fixed centrally: `FieldRow` mints a `useId`, clones it onto its control, and renders a real `<label htmlFor>`.
- **F-37 [032, P1] Owner-filter chip off-state 2.24:1 (dark)** — the unselected chip used `text-ink-faint opacity-50`; on a toggle (not a disabled control) that owes full 4.5:1. Re-expressed "off" as a recessed `surface-alt` + `ink-muted` + dimmed dot, no blanket opacity.
- **F-38 [032, P2] `<ul>` with direct `<div>` children** — `ListItemRow` rendered a `<div>` root inside Lists' `<ul>`, breaking list semantics. Changed the row root to `<li>`.
- **F-39 [032, P2] Zoom disabled** — `index.html` had `maximum-scale=1.0, user-scalable=no` (WCAG 1.4.4). Removed; iOS focus-zoom cause removed instead via 16px `pointer: coarse` form controls.
- **F-40 [032, P2] Schedule-X control labels 3.72:1 (dark) / 4.23:1 (light)** — the "Date"/"View" labels kept the vendor's Material `#79747E`. Repointed to `--ink-muted` via one themed rule (also removes a cool-gray leftover US1 targeted).

## P3 — polish when touching the area

- **F-21 [033]** Planner "Live weather." status box — cryptic one-word status with trailing period; expand to human copy ("Live forecast · updated 5 min ago").
- **F-22 [033]** Planner timeline is ~10 screens tall on mobile (PX_PER_MIN constant); compress non-eligible hours or collapse the band edges.
- **F-23 [032]** "Last synced" timestamps: time-only, second-precision, and can show an older time than a sibling view (per-dataset ages surfaced inconsistently). One relative format ("synced 2m ago"), one source.
- **F-24 [032]** Doc drift in DESIGN.md: ink tokens documented as `#6E6656`/`#9B937F` but shipped as `#655e4f`/`#756c59` (likely deliberate contrast fixes — document them); nav list outdated (F-18); "Dark mode: deferred" line (F-01).
- **F-25 [032]** Empty-day "—" in week/next-7 columns; use a quiet empty treatment instead of a bare dash.
- **F-26 [Q]** No URL routing at all (`App.tsx` local state): browser/PWA Back exits the app from any subview, and nothing is linkable. Full routing is out of scope for 032/033, but 033's "open planner on date X" wants at least history-state handling so Back closes the sheet instead of the app. Flagging the trade-off for the spec.

## Round 2 findings — dashboard IA & coherence (added after Max's review, 2026-07-18)

### F-27 [032, P1] Dashboard reading order: Today section duplicates the strip; Overdue ranks below Today
- **Location:** `DashboardHome.tsx` section order (alerts → nudge → strip → Today → Overdue → Weekend → Load balance → Coming up); `SevenDayStrip.tsx` + `DayPeekPanel.tsx` day card
- **Impact:** selecting today in the strip shows the same content the Today section already shows below it; an overdue item (highest-priority information on the page) renders *after* today's list.
- **Recommendation (agreed with Max):** merge into one "Now" region — Overdue first (only when non-empty, red accent), then the strip with **today pre-selected**, its day card carrying events + walk status + tasks due (union of both old surfaces, so "due today" isn't lost). Standalone Today section removed. Both-empty case collapses to a single warm line ("Nothing due and nothing overdue — enjoy the quiet"), not two stacked empty sections.

### F-28 [032, P2] Sign out exists twice, and the top-bar avatar is a single-tap sign-out
- **Location:** `AppShell` top-bar avatar (accessible label: "Signed in as… Sign out.") + More → Account → Sign out
- **Impact:** duplicated affordance; the avatar version makes an account-level action a one-mis-tap hazard on the most-tapped screen edge.
- **Recommendation:** avatar opens a tiny menu (identity + sign out) or does nothing; More→Account remains the real home.

### F-29 [032, P2] Someday list has two homes
- **Location:** `App.tsx:113` renders `SomedayList` beneath the calendar scroll; verify duplication in `TasksView`
- **Recommendation:** one home (Tasks), with at most a link from Calendar. Unscheduled-by-definition items living under the schedule view is the IA oddity.

### F-30 [032, P2] Owner-filter chips: per-view state, verify persistence
- **Location:** `useOwnerFilter` instantiated in `App.tsx` for Calendar; Tasks renders its own chips
- **Recommendation:** one shared, persisted filter state across Calendar/Tasks (a filter that silently resets between views reads as a bug to the two people using it).

### F-31 [032, P2] Grocery nudge is display-only
- **Location:** `GroceryNudge.tsx` — no tap target (confirmed in a11y tree)
- **Recommendation:** tapping opens Lists → Groceries (Needed). A nudge without a next step is a dead end.

### F-32 [033, P1] Today's walk status is invisible on Home
- **Impact:** Home warns about walks 5–10 days out (F-10) but never shows today's booked window or "needs a decision" state — the daily payoff of the whole walk feature.
- **Recommendation:** walk line inside the merged today card (F-27): "Dog walk · 8:00–8:30 ✓ booked" / "Dog walk · needs a decision →" opening the planner.

### F-33 [033, P2] Walk push pings deep-link to the wrong place
- **Location:** `App.tsx:60–63` — all push deep-links land on the Tasks tab
- **Recommendation:** walk pings open the planner sheet for the pinged date (uses the F-26 sheet-history decision; no URL routing needed).

### F-34 [032, P2] Undo over confirmation
- **Recommendation:** task complete / delete / list-item actions get a ~6s Undo toast instead of blocking confirms where the write is idempotent (backend already guarantees this). Calmer than dialogs, faster than re-adding. Walk unbook keeps its confirm (external calendar side-effects).

## Resolved questions (Max, 2026-07-18)

1. **Planner hour band ends at 5 PM:** intentional enough — keep the band as-is; no full-day timeline. (Dropped from 033 scope.)
2. **F-26 routing:** sheet-level history handling only (Back closes the planner sheet); real URL routing stays deferred.
3. **"Not grocery" rename:** keep — Max will rename himself if it bothers him. (Dropped from F-15.)
4. **Screenshot set:** not wanted; discard. Repo stays screenshot-free.

## Positive findings — protect these

- **Token discipline is exemplary:** every palette hex exists exactly once, in `:root`; Tailwind maps shadcn vocabulary onto the tokens. This is why dark mode is a feature and not a rewrite.
- **ARIA depth on interactive rows** ("Not yet committed — tap to confirm you've got X"; hour rows announce temp + eligibility + action) is genuinely better than most commercial products.
- **Focus rings** exactly per DESIGN.md (2px accent, offset), verified live; global reduced-motion fallback present.
- **Warm identity holds up:** serif headers, human empty-state copy ("Nothing due today — enjoy the quiet"), quiet completion flow — the corkboard feel survived 31 features.
- **Perf architecture:** bootstrap-seeded caches, lazy Schedule-X/More chunks, skeleton loaders in feed.

## Recommended command sequence (impeccable)

1. **[P1]** `/impeccable harden` — F-09 error/retry sweep, F-20 a11y verify-list (032)
2. **[P1]** `/impeccable shape` — planner rework + calendar parity interaction design before code (033: F-02..F-07)
3. **[P2]** `/impeccable adapt` — F-08, F-13 desktop layout pass (032)
4. **[P2]** `/impeccable clarify` — F-10, F-19, F-21, F-15 copy pass (both)
5. **[P2]** `/impeccable distill` — F-11, F-14, F-15 control de-duplication (both)
6. Finish each feature with `/impeccable polish` before PR (per CLAUDE.md definition of done)

---

*Triage confirmed by Max 2026-07-18. Final assignment: **032** = F-01, 08, 09, 13, 14, 15, 17, 18, 19, 20, 23, 24, 25, 27, 28, 29, 30, 31, 34 · **033** = F-02, 03, 04, 05, 06, 07, 10, 11, 12, 16, 21, 22, 26 (sheet-history only), 32, 33. Next: `/speckit.specify` for 032 with this document as input; 033 specced after 032 ships.*
