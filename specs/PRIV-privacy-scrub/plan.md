# PRIV — Public-repo personal-data scrub

**Status: ✅ done 2026-07-17.** Working-tree scrub committed, history rewritten via
`git filter-repo` in a fresh clone (verified zero leaks locally and post-push), and
force-pushed to `main`. Pages deploy ran green on the rewritten history.

Not a Spec Kit feature: no user story, no UI — a security/privacy cleanup executed as a
carefully-ordered checklist. Context: the repo is **public** (required for GitHub Pages +
the stable API URL) but was built assuming private, and personal data is committed in the
working tree and across ~99 commits of history.

## 1. Exposure inventory (verified 2026-07-17)

Concrete values live in a local-only replacement map (never committed); categories:

| Category | Where (working tree) |
|---|---|
| 3 real gmail addresses (both personal + shared; one reveals a surname) | `backend/Config.js` (vapidSubject seed default), `specs/002-*` (4 files), `specs/007/008` quickstarts, `specs/010-*` (3 files), `initial-setup.md`, project brief |
| Family birthdays (8, with names incl. two full first names) + 3 exact anniversary dates | `backend/Config.js` `EVENT_SEED_PACK`/`TEMPLATE_SEED_PACK`, `docs/seed-data.md`, `specs/027-*` (3 files), `backend/SelfTest.js:593` (one name+date as a test string) |
| Real grocery/household lists (38 items) | `docs/seed-data.md`, `backend/Config.js` `LIST_SEED_PACK`, `specs/027-*` |
| `SPREADSHEET_ID`, `OAUTH_CLIENT_ID` | `backend/Config.js` (committed by design when repo was assumed private) |

Confirmed **not** committed (checked working tree + full history): household coordinates,
VAPID private key (blank placeholder rows only), ntfy topics, clasp credentials,
`client_secret*.json` (gitignored 2026-07-16).

## 2. Working-tree scrub (normal commits, before any rewrite)

1. **Seed packs**: production seeding is complete and ledgered (`eventSeedApplied` etc.);
   the Sheet is the live source of truth and hand-edits happen there. Replace
   `EVENT_SEED_PACK` / `TEMPLATE_SEED_PACK` / `LIST_SEED_PACK` personal contents with a
   2–3-row generic example pack (keys `example-*`) documenting the shape; note pointing at
   the Sheet. Never-resurrect semantics mean removing applied entries changes nothing.
2. **`docs/seed-data.md`**: delete from the repo; park the real copy untracked in
   `~/.config/household-hq/seed-data.md` for reference.
3. **Emails**: `vapidSubject` seed default → `mailto:CHANGE_ME@example.com` (the real value
   already lives in the Settings sheet; `setupDatabase()` only seeds missing keys, so no
   behavior change). Replace emails in specs/docs/initial-setup with `max@example.com` /
   `jaz@example.com` / `household@example.com` placeholders.
4. **Names/dates in specs + brief + SelfTest.js:593**: genericize (relative labels like
   "family member", placeholder dates).
5. **IDs — decided by Max 2026-07-17: both stay committed.** `OAUTH_CLIENT_ID` ships in
   the public frontend bundle by nature; `SPREADSHEET_ID` grants nothing without a signed
   token + allowlist match (and Drive permission for direct access), and it's been public
   for weeks already. No Script Property migration, no Sheet re-creation.
6. **CLAUDE.md**: fix the stale "repo is private" claim; state the public-repo rule:
   *no personal data in tracked files — personal data lives in the Sheet only.*
7. Verify: `npm test` + `npm run build`, `clasp push` + self-test chunks green, app works.

## 3. History rewrite (⛔ approval gate — destructive)

1. Backup: `git bundle` of the full repo + a spare clone, kept locally.
2. `git filter-repo --invert-paths --path docs/seed-data.md` (file never existed), then
   `git filter-repo --replace-text <local map>` for emails/names/dates in every other blob.
3. Verify locally: `git log --all -p | grep` for every value in the map → zero hits;
   spot-check that recent feature history is intact and buildable.
4. **Force-push** `main` (and any branches) — only after Max's explicit "go".
5. Post-push: fresh clone from GitHub, re-grep; confirm Pages redeploys green; Max
   re-clones or hard-resets any other checkouts.

**Residual risk (accepted by Max 2026-07-17):** GitHub retains unreachable objects and PR
refs for a while after a force-push; a truly complete purge means contacting GitHub Support
to run a gc, and old data may live in third-party caches/clones already. The Sheet keeps
its existing ID (access is gated by ID-token + allowlist; no re-creation).

## 4. Order & verification summary

Working-tree scrub → deploy + validate (tests, live app) → backup → rewrite → local verify
→ **approval** → force-push → fresh-clone verify → BACKLOG updated, PRIV closed.
