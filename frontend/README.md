# Household HQ — Frontend

The calendar-first home screen (feature 006). Vite + React + TypeScript +
Tailwind + shadcn/ui, deployed to GitHub Pages. Consumes the existing
Apps Script backend (`/backend`, features 001–005) — no server of its own.

## Setup

```bash
npm install
cp .env.example .env   # fill in the two values below
npm run dev             # http://localhost:5173
```

### Environment variables

| Variable | Where it comes from |
|---|---|
| `VITE_API_BASE_URL` | The deployed Apps Script web-app URL (`clasp deploy` output). |
| `VITE_GOOGLE_CLIENT_ID` | Must exactly match `OAUTH_CLIENT_ID` in `backend/Config.js`. |

## Commands

```bash
npm run dev       # local dev server
npm run build     # tsc type-check + production build (must pass with zero type errors)
npm run test      # Vitest — pure-logic unit tests + the Schedule-X integration test
npm run lint      # oxlint
npm run preview   # preview the production build locally
```

## Deployment

`.github/workflows/deploy-frontend.yml` builds and deploys `frontend/` to
GitHub Pages on every push to `main` that touches this directory. Two
**one-time setup steps** only a repo admin can do:

1. **Enable Pages**: repo Settings → Pages → Source: "GitHub Actions".
2. **Set the two build-time variables**: repo Settings → Secrets and
   variables → Actions → Variables tab (not Secrets — neither value is
   sensitive) → add `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` with
   the same values as your local `.env`.

The Vite `base` in `vite.config.ts` is hardcoded to `/household-hq/` for
the GitHub Pages project-site path — update it if the repo is ever renamed.

### Google OAuth origin

The deployed Pages URL (and `http://localhost:5173` for local dev) must be
listed as an **authorized JavaScript origin** on the OAuth client in Google
Cloud Console, or sign-in will fail. This is a one-time manual step per
origin — not something `clasp`/Actions can do.

## Architecture notes

- **API client** (`src/lib/api.ts`): every backend call is a `text/plain`
  POST carrying `{action, token, payload}` — this avoids a CORS preflight
  Apps Script can't answer (see CLAUDE.md gotchas). `ok` in the response is
  the only success signal, never HTTP status.
- **Auth** (`src/lib/auth.ts`, `src/hooks/useAuth.tsx`): Google Identity
  Services renders the real sign-in button; the resulting ID token is held
  in memory only (no refresh — expiry re-prompts sign-in).
- **Dates** (`src/lib/datetime.ts`): backend datetimes are naive
  household-local strings (no timezone offset). They're interpreted via
  `temporal-polyfill`, never via `new Date(naiveString)`, which would
  silently parse in the *browser's* zone instead of the household's.
- **The tether** (`src/lib/tether.ts`): prep tasks attach to their event by
  matching `Task.eventId` client-side — no new backend endpoint.
- **Calendar** (`src/components/calendar/CalendarHome.tsx`): Schedule-X,
  themed entirely through its CSS variables in `calendar-theme.css` to the
  DESIGN.md palette; events render via a fully custom `EventContent`.
