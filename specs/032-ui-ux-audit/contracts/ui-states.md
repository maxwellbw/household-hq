# UI Pattern Contracts — Feature 032

The feature's "interfaces" are shared UI patterns every view must adopt identically. These are the contracts tasks and review check against. No new HTTP endpoints; the existing Apps Script API is used as-is.

## C1 — Theme tokens

- Light values live in `:root`; dark values live in exactly one `[data-theme="dark"]` block in `index.css`. **No component may introduce a hex value or a theme conditional** — components consume tokens only (audit F-01 preserved the invariant; this contract keeps it).
- Every token that names a color or shadow MUST have a dark value (enumerated: bg, surface, surface-alt, border, ink×3, accent×3, owner×6, success/warning/danger, shadow-card).
- Contract test: grep for hex literals outside `index.css`/`calendar-theme.css` fails the build review; contrast checks (quickstart §5) pass for the documented pairs in both themes.

## C2 — ErrorState

```
<ErrorState title copy onRetry busy?>
```
- Renders title (serif, warm), one-line copy, and a Retry button wired to the owning query's `refetch`.
- Retry shows busy state; repeated failure keeps the same honest state (no stacking spinners).
- Adopters (this feature): FeedView, ListsView, and every view found with an `isError` branch during implementation sweep. New views MUST use it.

## C3 — Undo toast

```
useUndoableMutation(forward, inverse, { label, window = 6s })
```
- Forward commits immediately; toast shows label + Undo until `window` lapses.
- Undo invokes `inverse` (must be an existing idempotent mutation); both directions produce their normal ActivityLog entries.
- One live undo toast max; replacement finalizes the predecessor.
- In-scope adopters: task complete (reopen), list-item delete (re-add). Explicitly **not** adopted where the inverse crosses an external boundary (event delete / calendar-synced entities keep confirms).

## C4 — SyncedAt

```
<SyncedAt updatedAt>
```
- Single relative format app-wide: "Synced just now" (<60s) / "Synced N min ago" / "Synced N h ago"; 60s refresh tick; tabular-nums.
- Views MUST NOT render their own absolute sync clocks.

## C5 — Empty region treatment

- Quiet designed empty: muted one-liner in the app's voice (region-appropriate), never a bare "—".
- Dashboard both-empty (overdue + today): exactly one warm line for the merged region (spec FR-008).

## C6 — Appearance setting

- Settings → Appearance: three-way segmented System / Light / Dark; applies instantly (no Save round-trip — it's device state, outside the Settings sheet form's save model); current resolved theme visible as you switch.

## C7 — Dashboard section order

`AckNotices → Overdue (non-empty only) → Today card (strip, today pre-selected: events + walk line + tasks due) → This weekend → Load balance → Coming up`, with the Lately strip placed between Today card and This weekend. Overdue capped at 5 rows + "view all in Tasks".
