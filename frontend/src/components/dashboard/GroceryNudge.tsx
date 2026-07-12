interface GroceryNudgeProps {
  show: boolean
}

/** "Time to shop" banner (US5, FR-013/014) — appears once enough staple items are
 *  marked need across all lists, mirrors AckNotices' banner styling. */
export function GroceryNudge({ show }: GroceryNudgeProps) {
  if (!show) return null

  return (
    <div className="px-4 pt-4">
      <div
        role="status"
        className="flex items-center gap-3 rounded-control border border-accent bg-accent-soft px-3 py-2.5 text-sm text-ink"
      >
        <span aria-hidden="true">🛒</span>
        <span>Running low on staples — might be time to shop.</span>
      </div>
    </div>
  )
}
