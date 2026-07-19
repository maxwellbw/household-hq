# DESIGN.md — Household HQ

Register: **product** (app UI — design serves the product). Surface: a dashboard-first household manager used daily on phones, weekly on desktop. Audience: exactly two people who chose this over a spreadsheet because it should feel calm, warm, and personal — not like enterprise project management.

## Voice & feel

Calm, warm, domestic. The app should feel like a well-organized kitchen corkboard, not a Jira board. Copy is plain and human ("Nothing due today — enjoy it") and never gamified-corporate ("You crushed 5 tasks! 🚀"). Celebration is quiet: a subtle check animation, a warm toast, done.

**Anti-references:** Jira/Asana density, Notion gray-on-white sterility, generic SaaS dashboards, glassmorphism, gradient text, purple-on-dark "AI app" styling, confetti.

## Color tokens

Warm paper-and-ink palette inspired by the Claude desktop/web app. Two themes,
one identity: light is the source of truth (`:root` in `frontend/src/index.css`),
dark is "the corkboard after dark" — the single `[data-theme="dark"]` override
block in the same file. **These two blocks (plus the Schedule-X bridge in
`calendar-theme.css`) are the only places a color value may exist** (feature 032
contract C1); components consume tokens only, never hex or theme conditionals.

> The ink values below are the *shipped* values. Feature 020-era implementation
> darkened `--ink-muted`/`--ink-faint` from this file's original `#6E6656`/`#9B937F`
> to meet 4.5:1 on every surface they actually render on; the file previously
> documented the older, lighter pair (drift recorded per 032 audit F-24).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FAF6F0` | `#201C16` | page background — warm ivory / deep warm umber |
| `--surface` | `#FFFFFF` | `#2A251D` | cards |
| `--surface-alt` | `#F2EBE0` | `#363028` | wells, hovered rows, out-of-month days |
| `--border` | `#E5DCCC` | `#453D31` | hairlines |
| `--ink` | `#2A261F` | `#EDE7DC` | primary text — ink / warm off-white |
| `--ink-muted` | `#655E4F` | `#B5AB97` | secondary text, labels |
| `--ink-faint` | `#756C59` | `#9C9280` | placeholders, section eyebrows |
| `--accent` | `#C6613F` | `#D97757` | terracotta *fills* + borders — buttons, focus ring |
| `--accent-hover` | `#AD5133` | `#E08A6D` | hover shifts darker in light, lighter in dark |
| `--accent-soft` | `#F3DED3` | `#45291D` | accent tints, selected states |
| `--accent-strong` | `#A34A2D` | `#E08A6D` | text-safe terracotta (≥4.5:1) — accent *text*, small-text-on-accent fills, "Both" badge |
| `--owner-max` | `#3E6E68` | `#7FB3AA` | pine teal, lifted for dark |
| `--owner-max-soft` | `#DCE9E7` | `#233833` | |
| `--owner-jaz` | `#7E4A5E` | `#C893A9` | berry/plum, lifted for dark |
| `--owner-jaz-soft` | `#EDDDE3` | `#3A2A32` | |
| `--owner-both` | `var(--accent-strong)` | `var(--accent-strong)` | text-safe: the MJ badge is white-on-fill |
| `--owner-both-soft` | `var(--accent-soft)` | `var(--accent-soft)` | |
| `--success` | `#4E7A4E` | `#85B183` | |
| `--warning` | `#B07C2E` | `#D9A45B` | badge/large-text usage only (3:1 class) |
| `--danger` | `#A43E2E` | `#E18D77` | |
| `--scrim` | `rgba(42,38,31,.3)` | `rgba(12,10,7,.6)` | dialog/sheet backdrops |
| `--shadow-card` | `rgba(42,38,31,…)` pair | `rgba(0,0,0,…)` pair | shadows deepen in dark |
| `--radius-card` / `--radius-control` | `14px` / `10px` | (unchanged) | |

Every documented pair is gated by `npm run check:contrast` in both themes
(body pairs ≥ 4.5:1; pairs only ever rendered large/semibold or as UI
components ≥ 3:1 and flagged as such in the script).

**Theming mechanics** (feature 032): a per-device System/Light/Dark preference
lives at `localStorage['hq.theme']` (never in the household Settings sheet —
one phone's choice must not force the other's). `useTheme` resolves it
(System follows `prefers-color-scheme` live), stamps `<html data-theme>`, and
syncs the `theme-color` metas to the active `--bg`; an inline pre-paint script
in `index.html` prevents any flash of the wrong theme on cold load. Platform
limits, documented honestly: the SVG favicon adapts to the **OS** scheme only,
and the installed-PWA icon/splash can't follow any theme — the icon carries
its own contained warm background so it sits on both wallpapers.

Rules: owner colors are identity, never decoration — a task chip, calendar event, avatar ring, and filter pill for Max are always the same pine teal (lifted, but recognizably the same hue, in dark), in every view. Accent terracotta is reserved for primary actions, focus, and "Both"; if everything is terracotta, nothing is. Backgrounds stay warm in **both** themes — never pure `#FFF` page backgrounds, never cool grays or pure black.

## Typography

- **Display / headings:** a warm serif — Fraunces (preferred) or Source Serif 4. Used for page titles, day/date headers, empty states. Weight 500–600, never bold-black.
- **UI / body:** Inter (or system-ui). 15–16px body on mobile, 14–15px desktop. Line-height 1.5.
- **Numbers & dates:** tabular-nums in calendar grids and lists.
- Serif is seasoning, not the whole meal: one serif element per view region, everything else sans.

## Layout & hierarchy

- **Dashboard is home.** Opening the app lands on the Home dashboard. The calendar is primary secondary navigation — still month on desktop and agenda/week on mobile when opened; tasks, load-balance view, and settings are further secondary navigation.
- **Tasks visually attach to their events.** Prep tasks render as small owner-colored chips beneath/tethered to their parent event in calendar views; tapping an event reveals its prep checklist with T−N labels. This attachment is the signature interaction — protect it.
- Mobile-first: bottom tab bar — **Home · Calendar · Tasks · Lists · More** as shipped (the Feed lives under More; this file previously described a pre-011 four-tab layout) — thumb-reachable primary actions, one floating "+" for quick add.
- Desktop: max-width ~1100px content column; calendar left, contextual panel right.
- Generous whitespace; cards over dividers; hairline borders over shadows where possible (shadows only for raised/interactive elements).
- Density: comfortable by default. Two users don't need compact mode.

## Components (conventions for shadcn/ui usage)

- **Task row:** checkbox · title · owner chip · due label (relative: "Tomorrow", "In 3 days", red "2 days overdue") · overflow menu (snooze, reassign, edit). Completing = check animation + strikethrough fade, row settles into Done section; toast: "Done — Jaz will see this in the feed."
- **Event card/pill:** owner-colored left edge (3px) + soft owner tint background; title; time; prep-task count badge when applicable.
- **Owner chip:** avatar initial in owner color; "Both" renders both initials in a single terracotta chip.
- **Feed item:** actor avatar · plain sentence ("Max completed *Mow the lawn*") · relative timestamp.
- **Walk-window suggestion (later):** time range · weather line ("61°F · clear") · one-tap "Add to calendar."
- Forms: inline and short; quick-add accepts natural text first, details optional after.

## Motion

Subtle and physical: 150–220ms ease-out for state changes; check-off gets one satisfying micro-animation (~300ms). No entrance animations on page load, no staggered reveals, no parallax. Every animation respects `prefers-reduced-motion` (crossfade or instant).

## Accessibility & quality bar

- Text contrast ≥ 4.5:1 against its actual background (verify owner-soft tints).
- Owner color is never the only signal — chips always carry the initial/name.
- Touch targets ≥ 44px; visible focus rings (accent, 2px offset) on all interactive elements.
- Works offline-tolerantly: stale data with a "last synced" note beats spinners.

## Definition of visually done

A view ships when: it uses only tokens above (no ad-hoc hex values), owner coding is consistent with every other view, it reads correctly at 375px wide, empty states are designed (warm serif line + one action), and `/impeccable audit` passes with no unwaived findings.
