import { ownerStyle } from '@/lib/owners'
import { formatTime, isAllDay } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { Event, Owner } from '@/types/domain'

interface ScheduleXEventProps {
  calendarEvent: {
    id: string | number
    title?: string
    owner?: Owner
    _raw?: Event
    _kind?: 'event' | 'task'
  }
}

const OWNER_EDGE: Record<Owner, string> = {
  max: 'border-l-owner-max',
  jaz: 'border-l-owner-jaz',
  both: 'border-l-owner-both',
}

const OWNER_TINT: Record<Owner, string> = {
  max: 'bg-owner-max-soft',
  jaz: 'bg-owner-jaz-soft',
  both: 'bg-owner-both-soft',
}

/**
 * Custom month-grid event render (DESIGN.md "Event card/pill"): owner-colored
 * 3px left edge + soft owner tint, title, time/all-day, and a prep-count
 * badge when the event has tethered tasks (openTaskCount is attached by
 * lib/tether.ts once US2 wires it in; absent here it simply renders none).
 */
export function EventContent({ calendarEvent }: ScheduleXEventProps) {
  const raw = calendarEvent._raw
  const owner = calendarEvent.owner ?? raw?.owner ?? 'both'
  const style = ownerStyle(owner)
  const allDay = raw ? isAllDay(raw.start, raw.end) : false
  const time = raw && !allDay ? formatTime(raw.start) : null
  const openTaskCount = (raw as (Event & { openTaskCount?: number }) | undefined)?.openTaskCount

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col gap-0.5 rounded-control border-l-[3px] px-1.5 py-1 text-left text-xs',
        OWNER_EDGE[owner],
        OWNER_TINT[owner],
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-surface',
            owner === 'max' && 'bg-owner-max',
            owner === 'jaz' && 'bg-owner-jaz',
            owner === 'both' && 'bg-owner-both',
          )}
          aria-hidden="true"
        >
          {style.initial}
        </span>
        <span className="truncate font-medium text-ink">{calendarEvent.title ?? raw?.title}</span>
        {calendarEvent._kind === 'task' && (
          <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-ink-faint">Task</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-ink-muted">
        {time && <span className="tabular-nums">{time}</span>}
        {typeof openTaskCount === 'number' && openTaskCount > 0 && (
          <span className="rounded-full bg-surface px-1 text-[10px]">
            {openTaskCount} prep {openTaskCount === 1 ? 'task' : 'tasks'}
          </span>
        )}
      </div>
    </div>
  )
}
