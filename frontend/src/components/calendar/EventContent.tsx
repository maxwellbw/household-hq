import { ownerStyle } from '@/lib/owners'
import { formatTime, isAllDay } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { EventWithTasks } from '@/lib/tether'
import type { Event, Owner, Task } from '@/types/domain'

interface ScheduleXEventProps {
  calendarEvent: {
    id: string | number
    title?: string
    owner?: Owner
    _raw?: Event | EventWithTasks | Task
    _kind?: 'event' | 'task' | 'dogwalk' | 'dogwalk-flag'
    _overdue?: boolean
    _reason?: string | null
  }
}

// Feature 011: short calendar-chip labels for a needs-decision day's reason.
const DOG_WALK_FLAG_REASON: Record<string, string> = {
  'no-mutual-free': 'no free window',
  'no-good-weather': 'weather',
  'forecast-turned-bad': 'weather changed',
  'calendar-unreadable': 'calendar issue',
}

function isEventRaw(raw: Event | EventWithTasks | Task | undefined): raw is Event | EventWithTasks {
  return !!raw && 'start' in raw
}

function isTaskRaw(raw: Event | EventWithTasks | Task | undefined): raw is Task {
  return !!raw && 'status' in raw
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
 * Custom event chip render (DESIGN.md "Event card/pill"), reused across the
 * month grid, week/next-7 day-lists, and single-day view: owner-colored 3px
 * left edge + soft owner tint, title, time/all-day, a "done/total tasks"
 * prep-progress badge when the event has a checklist, and an Overdue badge
 * for tasks displayed on today past their real due date (feature 017).
 */
export function EventContent({ calendarEvent }: ScheduleXEventProps) {
  // Feature 011: a needs-decision day is a read-only warning marker — amber left edge + a
  // ⚠️, text in high-contrast ink (owner tint/badge would misread it as a booked walk).
  if (calendarEvent._kind === 'dogwalk-flag') {
    const reason = DOG_WALK_FLAG_REASON[calendarEvent._reason ?? ''] ?? 'needs a decision'
    return (
      <div className="flex h-full w-full items-center gap-1 rounded-control border-l-[3px] border-l-warning bg-surface-alt px-1.5 py-1 text-left text-xs text-ink">
        <span aria-hidden="true">⚠️</span>
        <span className="truncate">
          <span className="font-medium">Dog walk</span> — {reason}
        </span>
      </div>
    )
  }

  const raw = calendarEvent._raw
  const owner = calendarEvent.owner ?? raw?.owner ?? 'both'
  const style = ownerStyle(owner)
  const eventRaw = isEventRaw(raw) ? raw : undefined
  const allDay = eventRaw ? isAllDay(eventRaw.start, eventRaw.end) : true
  const time = eventRaw && !allDay ? formatTime(eventRaw.start) : null
  const eventWithTasks = eventRaw && 'tasks' in eventRaw ? (eventRaw as EventWithTasks) : undefined
  const totalTaskCount = eventWithTasks?.totalTaskCount
  const doneTaskCount = eventWithTasks?.doneTaskCount
  const isDoneTask = calendarEvent._kind === 'task' && isTaskRaw(raw) && raw.status === 'done'

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
        <span className={cn('truncate font-medium', isDoneTask ? 'text-ink-muted line-through' : 'text-ink')}>
          {calendarEvent.title ?? raw?.title}
        </span>
        {calendarEvent._overdue ? (
          <span className="ml-auto shrink-0 rounded-full bg-danger px-1.5 text-[9px] font-medium uppercase tracking-wide text-surface">
            Overdue
          </span>
        ) : (
          // ink-muted, not ink-faint: this tag sits on an owner-soft tint, where
          // faint lands at 3.97–4.39:1 in both themes (T033 / audit F-20).
          calendarEvent._kind === 'task' && (
            <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-ink-muted">Task</span>
          )
        )}
      </div>
      <div className="flex items-center gap-1.5 text-ink-muted">
        {time && <span className="tabular-nums">{time}</span>}
        {typeof totalTaskCount === 'number' && totalTaskCount > 0 && (
          <span className="rounded-full bg-surface px-1 text-[10px]">
            {doneTaskCount}/{totalTaskCount} tasks
          </span>
        )}
      </div>
    </div>
  )
}
