import { formatDayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { DayTileSummary } from '@/lib/dashboard'
import type { Owner } from '@/types/domain'

interface SevenDayStripProps {
  tiles: DayTileSummary[]
  onOpenDate: (dateKey: string) => void
}

const OWNER_ORDER: Owner[] = ['max', 'jaz', 'both']
const OWNER_DOT: Record<Owner, string> = {
  max: 'bg-owner-max',
  jaz: 'bg-owner-jaz',
  both: 'bg-owner-both',
}

/**
 * Rolling 7-day glance on the dashboard (feature 017 FR-015–018): today
 * first, owner-colored dots/counts per day, tap to jump into the calendar.
 */
export function SevenDayStrip({ tiles, onOpenDate }: SevenDayStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2" role="group" aria-label="Next 7 days">
      {tiles.map((tile) => {
        const label = formatDayLabel(tile.dateKey, { weekday: 'short', day: 'numeric' })
        const ariaLabel =
          tile.total === 0
            ? `Open ${formatDayLabel(tile.dateKey, { weekday: 'long', month: 'long', day: 'numeric' })} — no items`
            : `Open ${formatDayLabel(tile.dateKey, { weekday: 'long', month: 'long', day: 'numeric' })} — ${tile.total} item${tile.total === 1 ? '' : 's'}`

        return (
          <button
            key={tile.dateKey}
            type="button"
            onClick={() => onOpenDate(tile.dateKey)}
            aria-label={ariaLabel}
            className={cn(
              'flex min-h-[44px] min-w-[64px] flex-col items-center gap-1 rounded-control border px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              tile.isToday ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-alt',
            )}
          >
            <span className={cn('text-xs font-medium', tile.isToday ? 'text-accent' : 'text-ink-muted')}>
              {label}
            </span>
            <div className="flex items-center gap-1">
              {OWNER_ORDER.filter((owner) => tile.countsByOwner[owner] > 0).map((owner) => (
                <span key={owner} className="flex items-center gap-0.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', OWNER_DOT[owner])} aria-hidden="true" />
                  <span className="text-[10px] text-ink-muted">{tile.countsByOwner[owner]}</span>
                </span>
              ))}
              {tile.total === 0 && <span className="text-[10px] text-ink-muted">—</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
