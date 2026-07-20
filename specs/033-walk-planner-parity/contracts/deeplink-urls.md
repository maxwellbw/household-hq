# Contract — Deep-link URL params (push → app)

One query param per notification, consumed once and stripped via `replaceState`
(feature 010's `?task=` contract, extended). `sw.js` is pass-through and unchanged:
cold start opens the app at the URL; warm app receives a `{type:'deeplink', url}`
postMessage. `lib/deeplink.ts` parses either path into a union and `App.tsx` routes.

| Param | Source | App behavior |
|---|---|---|
| `?task=<id>` | completion/acknowledge pushes (existing) | Tasks tab (unchanged) |
| `?walk=<YYYY-MM-DD>` | evening walk push; finder needs-decision/move pushes (F-33) | Open the Dog-Walk Planner sheet for that date (app-level host); active tab behind the sheet: Home. Invalid/unparseable date → fall through to Home with no sheet |
| `?overdue=1` | morning overdue push | Home (dashboard) — the Overdue region is the top-of-page "now" surface |

Precedence: params are mutually exclusive in practice (one per notification); if
multiple are ever present, first match in the order task → walk → overdue wins and
all recognized params are stripped.

Back behavior: a planner opened from a deep link participates in sheet history
(FR-013) — Back closes the sheet and leaves the app open on Home, never a blank
window (cold-start guard in `useSheetHistory`).

## Parsed union (`lib/deeplink.ts`)

```ts
type DeepLink =
  | { kind: 'task'; taskId: string }
  | { kind: 'walk'; dateKey: string }   // validated YYYY-MM-DD
  | { kind: 'overdue' }
```

`listenForDeepLinks(onLink: (link: DeepLink) => void): () => void` — same
wire-once-at-startup shape as today.
