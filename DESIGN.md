# DESIGN.md — Household HQ

Register: **product** (app UI — design serves the product). Surface: a calendar-first household manager used daily on phones, weekly on desktop. Audience: exactly two people who chose this over a spreadsheet because it should feel calm, warm, and personal — not like enterprise project management.

## Voice & feel

Calm, warm, domestic. The app should feel like a well-organized kitchen corkboard, not a Jira board. Copy is plain and human ("Nothing due today — enjoy it") and never gamified-corporate ("You crushed 5 tasks! 🚀"). Celebration is quiet: a subtle check animation, a warm toast, done.

**Anti-references:** Jira/Asana density, Notion gray-on-white sterility, generic SaaS dashboards, glassmorphism, gradient text, purple-on-dark "AI app" styling, confetti.

## Color tokens

Warm paper-and-ink palette inspired by the Claude desktop/web app.

```css
:root {
  /* Surfaces */
  --bg:            #FAF6F0;  /* warm ivory page background */
  --surface:       #FFFFFF;  /* cards */
  --surface-alt:   #F2EBE0;  /* wells, hovered rows, calendar out-of-month */
  --border:        #E5DCCC;  /* hairlines */

  /* Ink */
  --ink:           #2A261F;  /* primary text */
  --ink-muted:     #6E6656;  /* secondary text, labels */
  --ink-faint:     #9B937F;  /* placeholders, disabled */

  /* Brand accent */
  --accent:        #C6613F;  /* terracotta — primary actions, focus rings, "Both" */
  --accent-hover:  #AD5133;
  --accent-soft:   #F3DED3;  /* accent tints, selected states */

  /* Owner identity (used consistently EVERYWHERE) */
  --owner-max:     #3E6E68;  /* deep pine teal */
  --owner-max-soft:#DCE9E7;
  --owner-jaz:     #7E4A5E;  /* muted berry/plum */
  --owner-jaz-soft:#EDDDE3;
  --owner-both:    var(--accent);
  --owner-both-soft:var(--accent-soft);

  /* Semantic */
  --success:       #4E7A4E;
  --warning:       #B07C2E;
  --danger:        #A43E2E;

  /* Shape & depth */
  --radius-card:   14px;
  --radius-control:10px;
  --shadow-card:   0 1px 2px rgba(42,38,31,.06), 0 4px 12px rgba(42,38,31,.05);
}
```

Dark mode: deferred (not in v1). Don't scaffold for it.

Rules: owner colors are identity, never decoration — a task chip, calendar event, avatar ring, and filter pill for Max are always the same pine teal, in every view. Accent terracotta is reserved for primary actions, focus, and "Both"; if everything is terracotta, nothing is. Backgrounds stay warm — never pure `#FFF` page backgrounds or cool grays.

## Typography

- **Display / headings:** a warm serif — Fraunces (preferred) or Source Serif 4. Used for page titles, day/date headers, empty states. Weight 500–600, never bold-black.
- **UI / body:** Inter (or system-ui). 15–16px body on mobile, 14–15px desktop. Line-height 1.5.
- **Numbers & dates:** tabular-nums in calendar grids and lists.
- Serif is seasoning, not the whole meal: one serif element per view region, everything else sans.

## Layout & hierarchy

- **Calendar is home.** Opening the app lands on the calendar (month on desktop, agenda/week on mobile). Everything else — task lists, load-balance view, settings — is secondary navigation.
- **Tasks visually attach to their events.** Prep tasks render as small owner-colored chips beneath/tethered to their parent event in calendar views; tapping an event reveals its prep checklist with T−N labels. This attachment is the signature interaction — protect it.
- Mobile-first: bottom tab bar (Calendar · Tasks · Feed · More), thumb-reachable primary actions, one floating "+" for quick add.
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
