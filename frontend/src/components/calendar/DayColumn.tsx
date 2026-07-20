import { EventContent } from '@/components/calendar/EventContent'
import { formatDayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/lib/calendarItems'

interface DayColumnProps {
  dateKey: string
  isToday: boolean
  items: CalendarItem[]
  onItemClick: (item: CalendarItem) => void
}

/**
 * One all-day column of chips for the bespoke week/next-7/day views
 * (feature 017 R1 — day-list, not an hourly time-grid). Reuses EventContent
 * so chips look identical to the month grid's.
 */
export function DayColumn({ dateKey, isToday, items, onItemClick }: DayColumnProps) {
  const label = formatDayLabel(dateKey)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 border-r border-border px-1.5 py-2 last:border-r-0">
      <div className={cn('px-1 text-xs font-medium', isToday ? 'text-accent-strong' : 'text-ink-muted')}>{label}</div>
      <div className="flex flex-col gap-1">
        {items.length === 0 && <div className="px-1 text-xs text-ink-muted">Nothing scheduled</div>}
        {items.map((item) => (
          <button
            key={item.kind === 'task' ? `task-${item.id}` : item.id}
            type="button"
            onClick={() => onItemClick(item)}
            className="min-h-[44px] rounded-control text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <EventContent
              calendarEvent={{
                id: item.id,
                title: item.title,
                owner: item.owner,
                _raw: item.raw,
                _kind: item.kind,
                _overdue: item.overdue,
                _reason: item.reason,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
