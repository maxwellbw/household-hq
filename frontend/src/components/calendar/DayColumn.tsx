import { useState } from 'react'
import { EventContent } from '@/components/calendar/EventContent'
import { formatDayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/lib/calendarItems'
import type { Task } from '@/types/domain'

interface DayColumnProps {
  dateKey: string
  isToday: boolean
  items: CalendarItem[]
  onItemClick: (item: CalendarItem) => void
}

function isDoneTask(item: CalendarItem): boolean {
  return item.kind === 'task' && (item.raw as Task).status === 'done'
}

function ItemButton({ item, onItemClick }: { item: CalendarItem; onItemClick: (item: CalendarItem) => void }) {
  return (
    <button
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
  )
}

/**
 * One all-day column of chips for the bespoke week/next-7/day views
 * (feature 017 R1 — day-list, not an hourly time-grid). Reuses EventContent
 * so chips look identical to the month grid's.
 *
 * Feature 033 T031/FR-023: done tasks collapse behind a single "N done ✓"
 * affordance (expandable in place) so a day of only-completed tasks doesn't
 * render as a wall of strikethrough — matching the day-peek panel's calm
 * treatment of the same information (F-16).
 */
export function DayColumn({ dateKey, isToday, items, onItemClick }: DayColumnProps) {
  const label = formatDayLabel(dateKey)
  const [showDone, setShowDone] = useState(false)

  const doneTasks = items.filter(isDoneTask)
  const rest = items.filter((item) => !isDoneTask(item))

  return (
    // Feature 033 T029/SC-006: a floor of 110px (the spec's own reference width) instead of
    // min-w-0 — otherwise flex-1 across 7 week-view columns on a 320px viewport shrinks each
    // column well past the point any title-priority CSS trick can rescue (a chip narrower
    // than its owner-circle has no room for a single character regardless of badge yielding).
    // The parent's overflow-x-auto (DayListView.tsx) turns the excess into horizontal scroll.
    <div className="flex min-w-[110px] flex-1 flex-col gap-1 border-r border-border px-1.5 py-2 last:border-r-0">
      <div className={cn('px-1 text-xs font-medium', isToday ? 'text-accent-strong' : 'text-ink-muted')}>{label}</div>
      <div className="flex flex-col gap-1">
        {items.length === 0 && <div className="px-1 text-xs text-ink-muted">Nothing scheduled</div>}
        {rest.map((item) => (
          <ItemButton key={item.kind === 'task' ? `task-${item.id}` : item.id} item={item} onItemClick={onItemClick} />
        ))}
        {doneTasks.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="min-h-[44px] rounded-control px-1 text-left text-xs font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {doneTasks.length} done ✓
            </button>
            {showDone &&
              doneTasks.map((item) => <ItemButton key={`task-${item.id}`} item={item} onItemClick={onItemClick} />)}
          </>
        )}
      </div>
    </div>
  )
}
