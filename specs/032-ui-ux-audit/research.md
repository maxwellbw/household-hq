# Research — Feature 032: Theming & Systemic UI Hygiene

All Technical Context unknowns resolved. Each decision lists rationale and rejected alternatives.

## R1 — Theme switching mechanism

**Decision**: Keep the single `:root` token block as the light source of truth; add one `[data-theme="dark"]` override block in `index.css` redefining only color/shadow tokens (+ `color-scheme: dark`). A small `useTheme` hook owns: reading `localStorage['hq.theme']` (`system|light|dark`, default `system`), subscribing to `matchMedia('(prefers-color-scheme: dark)')`, stamping `data-theme` on `<html>`, and updating the `theme-color` meta. Tailwind config keeps mapping semantic classes to the same CSS variables — component classlists don't change.

**Rationale**: The audit's headline positive (every hex exists exactly once) makes variable-level override the zero-churn path: ~40 lines of CSS + one hook, no `dark:` class sweep across ~80 components, no flash-of-wrong-theme (attribute is stamped in a tiny inline `<head>` script before first paint).

**Alternatives considered**: Tailwind `dark:` variant classes (touches every component, churns every classlist, double-maintains colors — rejected); CSS-only `prefers-color-scheme` media block (can't express the manual Light/Dark override — rejected); a theming library (Constitution IV — rejected).

## R2 — Dark palette derivation

**Decision**: "The corkboard after dark" — same warm identity, low-glare: backgrounds are deep warm browns derived from `--ink`'s hue family (bg ≈ deep umber ~`#201C16`, surface one step lighter, surface-alt one step warmer), never cool gray or black. Ink becomes warm off-white (`#EDE7DC`-family), muted/faint stepped down but ≥ 4.5:1 on their actual surfaces. Owner colors keep hue identity but lift lightness/chroma so Max-teal / Jaz-plum / Both-terracotta stay distinguishable on dark (soft variants become translucent dark tints of the owner hue). Accent terracotta lifts slightly for AA on dark. Every pair validated with a contrast script during implementation (quickstart step 5) and the final values written into DESIGN.md (F-24).

**Rationale**: PRODUCT.md's anti-references explicitly ban "purple-on-dark AI app styling" and cool sterility; a warm dark keeps the brand recognizably the same app. Deriving from the existing hue families is the debuggable path (Constitution IV).

**Alternatives considered**: pure-black OLED theme (harsh, off-brand); desaturating owner colors (breaks identity legibility, violates the owner-color principle); auto-inverting (uncontrollable contrast, rejected).

## R3 — Dark icon, favicon, and browser chrome

**Decision**: Three-part, honestly scoped: (1) `icon.svg` favicon gains an internal `@media (prefers-color-scheme: dark)` style block — browser tabs follow the **OS** scheme (SVG media queries cannot see the app's in-app preference; accepted, documented). (2) `theme-color` meta is updated by `useTheme` to the active theme's `--bg`, so installed-PWA and mobile-browser chrome follow the **app's** preference. (3) The PWA manifest's installed icon cannot switch with theme on any current platform — the existing 512px icon is reviewed on a dark home screen and, if needed, given a subtle contained background so it sits acceptably on both; the limitation is documented in DESIGN.md and the README (FR-004).

**Rationale**: This is the maximum theme-adaptivity each surface actually supports, with no hacks (no JS favicon swapping loops — boring wins).

**Alternatives considered**: JS-swapped favicon `<link>` tracking the in-app preference (works, adds moving parts for a tab icon; deferred unless the SVG media approach proves insufficient in validation); dual manifests (unsupported, rejected).

## R4 — Schedule-X dark chrome

**Decision**: `calendar-theme.css` already bridges all `--sx-*` variables to app tokens — under `[data-theme="dark"]` those app tokens change, so most of the calendar re-themes for free. Add explicit dark overrides only where Schedule-X hardcodes values: the `#B8B5B8` chevron data-URIs (replaced via CSS `mask`/filter or our own icon override) and any control chrome surfaced during validation. The Material-style floating-label View/Date selects are 033's F-11 scope (control replacement) — 032 only ensures their **colors** are themed.

**Rationale**: The bridge was built for exactly this; extending it beats forking vendor CSS.

**Alternatives considered**: replacing Schedule-X header chrome wholesale (033 territory, out of scope here).

## R5 — Undo over confirms

**Decision**: A `useUndoableMutation` wrapper over the existing mutation hooks: fire the action optimistically as today, then show a ~6s toast with Undo. Undo invokes the existing inverse mutation — verified present: `useCompleteTask` ↔ `useReopenTask` (task complete), list-item delete ↔ re-add via existing list mutations. Each direction logs its own ActivityLog entry through the backend's normal path (append-only, Constitution VI); no new API. Actions whose inverse has external side-effects (event delete → Google Calendar sync) **keep their confirm** (spec FR-013).

**Rationale**: Inverses already exist and are idempotent (Constitution V), so Undo is purely a frontend affordance — the calmest possible implementation.

**Alternatives considered**: delayed-commit (queue the write until the toast expires — invisible to the other user during the window, contradicts "completions are seen"; rejected); a generic command-stack undo system (over-engineering for two users; rejected).

## R6 — Per-device persistence

**Decision**: `localStorage` keys `hq.theme` and `hq.ownerFilter`, following the existing `hq.sessionToken` naming. Owner filter becomes a single context-provided instance of `useOwnerFilter` (App-level) consumed by Calendar and Tasks; all-deselected normalizes to all-selected (spec edge case).

**Rationale**: Matches the household-vs-device data boundary argued in the plan's Constitution gate.

**Alternatives considered**: Sheet-backed Settings rows (would sync one device's choice to the other person — wrong by design); IndexedDB (overkill).

## R7 — Lately strip data

**Decision**: Reuse `useActivity` (the Feed's existing hook/endpoint) with a small display cap (latest ~4 entries, excluding the viewer's own actions optionally — decided at implementation with real data feel); render nothing on error or empty-and-stale (dashboard never errors for a secondary strip). Tapping "See all" opens More → Feed.

**Rationale**: Zero new API surface; the strip is a projection of data the app already fetches.

**Alternatives considered**: new trimmed endpoint (unnecessary); embedding full FeedView (too heavy for the landing view).

## R8 — Freshness label source

**Decision**: One `SyncedAt` component reading each query's `dataUpdatedAt` (React Query already tracks it), rendered as coarse relative text ("Synced just now / 2 min ago / 1 h ago"), refreshing on a 60s tick. Views stop printing their own absolute clock strings.

**Rationale**: The audit's contradictory timestamps came from per-view bespoke formatting of different cache entries; one component + one format ends the class of bug.

**Alternatives considered**: global "last sync" store (another source of truth to drift; rejected).
