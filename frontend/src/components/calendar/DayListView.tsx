import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Temporal } from 'temporal-polyfill'
import { DayColumn } from '@/components/calendar/DayColumn'
import { bucketByDay, type CalendarItem } from '@/lib/calendarItems'
import { formatDayLabel, todayKey, weekRange } from '@/lib/datetime'
import type { EventWithTasks } from '@/lib/tether'
import type { Task } from '@/types/domain'

export type CalendarViewMode = 'month' | 'week' | 'next7' | 'day'

interface DayListViewProps {
  mode: 'week' | 'next7' | 'day'
  anchorDate: string
  events: EventWithTasks[]
  standaloneTasks: Task[]
  timezone: string
  onItemClick: (item: CalendarItem) => void
  onNavigate: (deltaDays: number) => void
}

function rangeForMode(mode: 'week' | 'next7' | 'day', anchorDate: string): string[] {
  if (mode === 'day') return [anchorDate]
  if (mode === 'week') {
    // Fixed Sun–Sat week containing anchorDate (FR-001, R2 — Sunday-first).
    const anchor = Temporal.PlainDate.from(anchorDate)
    const daysToSunday = anchor.dayOfWeek === 7 ? 0 : anchor.dayOfWeek
    const sunday = anchor.subtract({ days: daysToSunday })
    return Array.from({ length: 7 }, (_, i) => sunday.add({ days: i }).toString())
  }
  // next7: rolling window starting at anchorDate (today by default).
  const start = Temporal.PlainDate.from(anchorDate)
  return Array.from({ length: 7 }, (_, i) => start.add({ days: i }).toString())
}

/**
 * Renders the fixed-week / rolling-next-7 / single-day views as all-day
 * chip columns (feature 017 R1) — deliberately not Schedule-X's hourly
 * time-grid, since household items are almost entirely all-day.
 */
export function DayListView({
  mode,
  anchorDate,
  events,
  standaloneTasks,
  timezone,
  onItemClick,
  onNavigate,
}: DayListViewProps) {
  const today = todayKey(timezone)
  const dateKeys = useMemo(() => rangeForMode(mode, anchorDate), [mode, anchorDate])
  const buckets = useMemo(
    () => bucketByDay(events, standaloneTasks, dateKeys, timezone, today),
    [events, standaloneTasks, dateKeys, timezone, today],
  )

  const navStep = mode === 'day' ? 1 : 7
  const rangeLabel =
    mode === 'day'
      ? formatDayLabel(anchorDate, { weekday: 'long', month: 'long', day: 'numeric' })
      : `${formatDayLabel(dateKeys[0])} – ${formatDayLabel(dateKeys[dateKeys.length - 1])}`

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => onNavigate(-navStep)}
          aria-label="Previous"
          className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm font-medium text-ink">{rangeLabel}</span>
        <button
          type="button"
          onClick={() => onNavigate(navStep)}
          aria-label="Next"
          className="flex h-11 w-11 items-center justify-center rounded-control hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex divide-x divide-border overflow-x-auto">
        {buckets.map((bucket) => (
          <DayColumn
            key={bucket.dateKey}
            dateKey={bucket.dateKey}
            isToday={bucket.dateKey === today}
            items={bucket.items}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  )
}

// Exported for CalendarHome's initial anchor computation.
export function defaultAnchorForMode(mode: CalendarViewMode, timezone: string): string {
  if (mode === 'week') return weekRange(timezone).startKey
  return todayKey(timezone)
}
