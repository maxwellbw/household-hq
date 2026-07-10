# Product

## Register

product

## Users

Exactly two users: Max and Jaz, a household, each signing in with their personal Google account (allowlisted by email — no signup, no other users, ever). They check the app on their phones daily and on desktop weekly. Their context: busy people trying to keep shared domestic life (events, chores, prep work) from depending on one person's memory. The job to be done is coordination without friction — see what's coming up, know who owns it, mark it done, trust the other person will see that it's done.

## Product Purpose

Household HQ reduces the mental load of running a two-person household — especially the invisible work of remembering — by making events, chores, and prep work visible, assignable, and shared. It is a dashboard-first tool: the Home dashboard is the landing view, surfacing what matters right now (today's tasks, overdue items, upcoming weekend, load balance). The calendar remains the organizing metaphor and the primary secondary navigation — tasks (including auto-generated event-prep checklists and recurring chores) visually attach to the events and dates they belong to. Success looks like: neither person has to hold the whole picture in their head alone, completions are seen by the other person without asking, and the app disappears into the background of daily life rather than feeling like another thing to manage.

## Brand Personality

Calm, warm, unfussy. The app should feel like a well-organized kitchen corkboard, not a project-management tool — plain, human copy ("Nothing due today — enjoy it"), and quiet celebration (a subtle check animation, a warm toast) instead of gamified-corporate enthusiasm ("You crushed 5 tasks! 🚀").

## Anti-references

Jira/Asana density and task-tracker chrome. Notion's gray-on-white sterility. Generic SaaS dashboards. Glassmorphism. Gradient text. Purple-on-dark "AI app" styling. Confetti and gamification. Anything that reads as enterprise software rather than a shared household tool.

## Design Principles

- **Dashboard first, calendar as organizing metaphor.** The Home dashboard is the landing view; the calendar is primary secondary navigation and the organizing metaphor for all scheduled items. Tasks, load-balance views, and settings are further secondary navigation.
- **Tasks are tethered to their events, visually and structurally.** Prep-checklist items render attached to the event that spawned them — this is the signature interaction and should be protected in every feature decision.
- **Owner identity is consistent, never decorative.** Max, Jaz, and Both each have one color used identically everywhere — chips, calendar events, avatars, filters — and color is never the only signal (always paired with initials/name).
- **Quiet over loud.** Celebration, motion, and copy stay understated and human; two people who chose this over a spreadsheet don't need to be gamified into using it.
- **Boring and debuggable wins.** Free-tier only, no servers, human-readable data (the Sheet), idempotent triggers — simplicity that both users can maintain with Claude Code's help, forever scoped to exactly two people.

## Accessibility & Inclusion

Target WCAG 2.1 AA. No additional specific user needs identified beyond the baseline: text contrast ≥4.5:1 against actual rendered backgrounds (including owner-soft tints), touch targets ≥44px, visible focus rings on all interactive elements, and full `prefers-reduced-motion` support (crossfade/instant alternatives, no animation is load-bearing for content visibility).
