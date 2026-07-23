import { ChevronRight } from 'lucide-react'

interface GroceryNudgeProps {
  show: boolean
  /** Number of staple items marked needed across all lists (034 US5). */
  count: number
  onNavigate: () => void
}

/** "Time to shop" banner (US5, FR-013/014; feature 032 FR-010/audit F-31): appears once
 *  enough staple items are marked need across all lists, and says how many (034 US5). Tapping
 *  it navigates to the grocery list's Needed view — a nudge with no next step is a dead end. */
export function GroceryNudge({ show, count, onNavigate }: GroceryNudgeProps) {
  if (!show) return null

  return (
    <div className="px-4 pt-4">
      <button
        type="button"
        onClick={onNavigate}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-control border border-accent bg-accent-soft px-3 py-2.5 text-left text-sm text-ink hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">🛒</span>
        <span className="flex-1">Running low on staples — {count} {count === 1 ? 'item' : 'items'} needed.</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
    </div>
  )
}
