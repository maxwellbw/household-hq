import { formatDayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { DayTileSummary } from '@/lib/dashboard'
import type { Owner } from '@/types/domain'

interface SevenDayStripProps {
  tiles: DayTileSummary[]
  /** The day whose peek panel is currently open below the strip, if any (US4). */
  activeDateKey: string | null
  /** Tapping a tile toggles its peek panel: same key closes, different key switches (US4). */
  onToggleDate: (dateKey: string) => void
}

const OWNER_ORDER: Owner[] = ['max', 'jaz', 'both']
const OWNER_DOT: Record<Owner, string> = {
  max: 'bg-owner-max',
  jaz: 'bg-owner-jaz',
  both: 'bg-owner-both',
}

/**
 * Rolling 7-day glance on the dashboard (feature 017 FR-015–018): today
 * first, owner-colored dots/counts per day. Tapping a tile toggles an inline
 * day-peek panel below the strip (feature 028 US4) rather than navigating away.
 */
export function SevenDayStrip({ tiles, activeDateKey, onToggleDate }: SevenDayStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2" role="group" aria-label="Next 7 days">
      {tiles.map((tile) => {
        const label = formatDayLabel(tile.dateKey, { weekday: 'short', day: 'numeric' })
        const isActive = tile.dateKey === activeDateKey
        const longLabel = formatDayLabel(tile.dateKey, { weekday: 'long', month: 'long', day: 'numeric' })
        const ariaLabel =
          tile.total === 0 ? `${longLabel} — no items` : `${longLabel} — ${tile.total} item${tile.total === 1 ? '' : 's'}`

        return (
          <button
            key={tile.dateKey}
            type="button"
            onClick={() => onToggleDate(tile.dateKey)}
            aria-label={ariaLabel}
            aria-expanded={isActive}
            className={cn(
              'flex min-h-[44px] min-w-[64px] flex-col items-center gap-1 rounded-control border px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              // The selected tile is an accent fill carrying 12px text, so it takes
              // the text-safe accent (--accent-strong) rather than --accent: white on
              // --accent is only 4.05:1 (T033 / audit F-20).
              isActive
                ? 'border-accent-strong bg-accent-strong text-surface'
                : tile.isToday
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:bg-surface-alt',
            )}
          >
            <span className={cn('text-xs font-medium', isActive ? 'text-surface' : tile.isToday ? 'text-accent-strong' : 'text-ink-muted')}>
              {label}
            </span>
            <div className="flex items-center gap-1">
              {OWNER_ORDER.filter((owner) => tile.countsByOwner[owner] > 0).map((owner) => (
                <span key={owner} className="flex items-center gap-0.5">
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-surface' : OWNER_DOT[owner])}
                    aria-hidden="true"
                  />
                  <span className={cn('text-[10px]', isActive ? 'text-surface' : 'text-ink-muted')}>
                    {tile.countsByOwner[owner]}
                  </span>
                </span>
              ))}
              {tile.total === 0 && !tile.hasDogWalk && !tile.needsDogWalkDecision && (
                <span className={cn('text-[10px]', isActive ? 'text-surface' : 'text-ink-muted')}>Free</span>
              )}
              {tile.hasDogWalk && (
                <span className="text-[10px]" aria-label="Dog walk" title="Dog walk">
                  🐾
                </span>
              )}
              {tile.needsDogWalkDecision && (
                <span className="text-[10px]" aria-label="Dog walk needs a decision" title="Dog walk needs a decision">
                  ⚠️
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
