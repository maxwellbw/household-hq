/** Warm empty state for a period with nothing scheduled (FR-010) — never a bare grid or spinner. */
export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">Nothing here — enjoy it</p>
      <p className="text-sm text-ink-muted">Use the + button to add an event or a chore.</p>
    </div>
  )
}
