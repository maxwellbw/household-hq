import { ownerStyle } from '@/lib/owners'
import { formatTime, isAllDay } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { EventWithTasks } from '@/lib/tether'
import type { DogWalk, Event, Owner, Task } from '@/types/domain'

interface ScheduleXEventProps {
  calendarEvent: {
    id: string | number
    title?: string
    owner?: Owner
    _raw?: Event | EventWithTasks | Task | DogWalk
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

function isEventRaw(raw: Event | EventWithTasks | Task | DogWalk | undefined): raw is Event | EventWithTasks {
  return !!raw && 'start' in raw
}

function isTaskRaw(raw: Event | EventWithTasks | Task | DogWalk | undefined): raw is Task {
  return !!raw && 'status' in raw && !('windowStart' in raw)
}

function isDogWalkRaw(raw: Event | EventWithTasks | Task | DogWalk | undefined): raw is DogWalk {
  return !!raw && 'windowStart' in raw
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
  // Feature 033 US4/F-03 (research R5): a booked/suggested walk carries the same 🐾
  // vocabulary the seven-day strip and Day Peek panel already use, with its time window
  // when known — read-only here too (tapping opens the planner, see CalendarHome).
  if (calendarEvent._kind === 'dogwalk') {
    const walk = isDogWalkRaw(calendarEvent._raw) ? calendarEvent._raw : undefined
    const time =
      walk?.windowStart && walk?.windowEnd ? `${formatTime(walk.windowStart)}–${formatTime(walk.windowEnd)}` : null
    return (
      <div className="flex h-full w-full items-center gap-1 rounded-control border-l-[3px] border-l-owner-both bg-owner-both-soft px-1.5 py-1 text-left text-xs text-ink">
        <span aria-hidden="true">🐾</span>
        <span className="min-w-0 truncate font-medium">Dog walk</span>
        {/* Feature 033 T029/FR-021: shrink-[9999] (vs. the title's default shrink-1) makes
            the time badge give up its space first — flexbox's multi-pass shrink resolution
            freezes it at 0 width before the title (whose truncate already zeroes its own
            floor via overflow:hidden) loses any room, so the title never reads zero chars. */}
        {time && <span className="ml-auto shrink-[9999] overflow-hidden whitespace-nowrap tabular-nums text-ink-muted">{time}</span>}
      </div>
    )
  }

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

  // 'dogwalk'/'dogwalk-flag' both return above — every remaining kind's `_raw` is an
  // Event/EventWithTasks/Task, never a DogWalk (which lacks `owner`/`title`).
  const raw = calendarEvent._raw as Event | EventWithTasks | Task | undefined
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
        <span className={cn('min-w-0 truncate font-medium', isDoneTask ? 'text-ink-muted line-through' : 'text-ink')}>
          {calendarEvent.title ?? raw?.title}
        </span>
        {calendarEvent._overdue ? (
          // Feature 033 T029/FR-021 (SC-006): shrink-[9999] gives the badge priority to
          // yield its space before the title (min-w-0 + truncate) ever reads zero chars —
          // see the dogwalk chip's time badge above for the full mechanism note.
          <span className="ml-auto shrink-[9999] overflow-hidden whitespace-nowrap rounded-full bg-danger px-1.5 text-[9px] font-medium uppercase tracking-wide text-surface">
            Overdue
          </span>
        ) : (
          // ink-muted, not ink-faint: this tag sits on an owner-soft tint, where
          // faint lands at 3.97–4.39:1 in both themes (T033 / audit F-20).
          calendarEvent._kind === 'task' && (
            <span className="ml-auto shrink-[9999] overflow-hidden whitespace-nowrap text-[9px] uppercase tracking-wide text-ink-muted">Task</span>
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
