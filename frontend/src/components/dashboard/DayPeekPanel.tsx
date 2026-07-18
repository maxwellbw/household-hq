import { cn } from '@/lib/utils'
import { ownerStyle } from '@/lib/owners'
import { formatDate, formatDayLabel, formatTime, isAllDay } from '@/lib/datetime'
import type { DogWalk, Event, Task } from '@/types/domain'

interface DayPeekPanelProps {
  dateKey: string
  events: Event[]
  tasks: Task[]
  walks: DogWalk[]
  timezone: string
  onOpenCalendar: (dateKey: string) => void
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: Event) => void
  onOpenWalkPlanner: (dateKey: string) => void
}

function ownerDotClass(owner: Event['owner']): string {
  if (owner === 'max') return 'bg-owner-max'
  if (owner === 'jaz') return 'bg-owner-jaz'
  return 'bg-owner-both'
}

interface PeekEventRowProps {
  event: Event
  timezone: string
  onOpen: () => void
}

function PeekEventRow({ event, timezone, onOpen }: PeekEventRowProps) {
  const style = ownerStyle(event.owner)
  const allDay = isAllDay(event.start, event.end)
  const time = allDay ? null : formatTime(event.start, timezone)
  const endKey = event.end.slice(0, 10)
  const startKey = event.start.slice(0, 10)
  const isMultiDay = endKey > startKey

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] w-full items-center gap-3 border-b border-border px-1 py-2 text-left last:border-b-0 hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          ownerDotClass(event.owner),
        )}
        aria-label={style.label}
      >
        {style.initial}
      </span>
      <span className="flex-1 text-sm text-ink">{event.title}</span>
      {isMultiDay && (
        <span className="shrink-0 text-xs text-ink-muted">
          {formatDate(event.start, timezone, { weekday: 'short' })}–{formatDate(event.end, timezone, { weekday: 'short' })}
        </span>
      )}
      {time && !isMultiDay && <span className="shrink-0 text-xs tabular-nums text-ink-muted">{time}</span>}
      <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
        event
      </span>
    </button>
  )
}

interface PeekTaskRowProps {
  task: Task
  onOpen: () => void
}

function PeekTaskRow({ task, onOpen }: PeekTaskRowProps) {
  const style = ownerStyle(task.owner)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] w-full items-center gap-3 border-b border-border px-1 py-2 text-left last:border-b-0 hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          ownerDotClass(task.owner),
        )}
        aria-label={style.label}
      >
        {style.initial}
      </span>
      <span className={cn('flex-1 text-sm', task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink')}>
        {task.title}
        {task.status === 'snoozed' && <span className="ml-2 text-xs text-ink-muted">snoozed</span>}
      </span>
      <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
        task
      </span>
    </button>
  )
}

interface PeekWalkRowProps {
  walk: DogWalk
  timezone: string
  onOpen: () => void
}

/** Opens the day planner (feature 031 US2) — the walk entry is the app's one entry point
 *  into the planner, keeping the calendar the organizing metaphor (PRODUCT.md, research R7)
 *  rather than adding a new top-level destination. */
function PeekWalkRow({ walk, timezone, onOpen }: PeekWalkRowProps) {
  const style = ownerStyle('both')
  const needsDecision = walk.status === 'needs-decision'
  const time = walk.windowStart && walk.windowEnd ? `${formatTime(walk.windowStart, timezone)}–${formatTime(walk.windowEnd, timezone)}` : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] w-full items-center gap-3 border-b border-border px-1 py-2 text-left last:border-b-0 hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          'bg-owner-both',
        )}
        aria-label={style.label}
      >
        🐾
      </span>
      <span className="flex-1 text-sm text-ink">
        Dog walk
        {needsDecision && (
          <span className="ml-2 text-xs text-ink-muted" aria-label="Needs a decision">
            ⚠️ needs a decision
          </span>
        )}
        {walk.decidedBy && (
          <span className="ml-2 inline-flex items-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-ink">
            Decided by {ownerStyle(walk.decidedBy).label}
          </span>
        )}
      </span>
      {time && <span className="shrink-0 text-xs tabular-nums text-ink-muted">{time}</span>}
    </button>
  )
}

/**
 * Inline panel below the dashboard's 7-day strip (feature 028 US4): shows the tapped
 * day's events + tasks without leaving the dashboard, with a quiet link out to the full
 * calendar day. Membership comes from `itemsForDay` (lib/dashboard.ts), the same
 * selector the strip's counts use, so contents and counts can never disagree (SC-006).
 * Walks (feature 029 US1) come from a dedicated `walksForDay` selector — read-only, no
 * booking from the peek (that's feature 031).
 */
export function DayPeekPanel({ dateKey, events, tasks, walks, timezone, onOpenCalendar, onOpenTask, onOpenEvent, onOpenWalkPlanner }: DayPeekPanelProps) {
  const isEmpty = events.length === 0 && tasks.length === 0 && walks.length === 0
  const longLabel = formatDayLabel(dateKey, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <section
      role="region"
      aria-label={longLabel}
      className="mx-4 mb-2 rounded-control border border-border bg-surface p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">{longLabel}</h3>
        <button
          type="button"
          onClick={() => onOpenCalendar(dateKey)}
          className="min-h-[44px] rounded-control px-2 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open in calendar
        </button>
      </div>

      {isEmpty ? (
        <p className="py-3 text-center font-display text-sm text-ink-muted">Nothing on this day.</p>
      ) : (
        <ul role="list">
          {events.map((e) => (
            <li key={e.id} role="listitem">
              <PeekEventRow event={e} timezone={timezone} onOpen={() => onOpenEvent(e)} />
            </li>
          ))}
          {tasks.map((t) => (
            <li key={t.id} role="listitem">
              <PeekTaskRow task={t} onOpen={() => onOpenTask(t)} />
            </li>
          ))}
          {walks.map((w) => (
            <li key={w.id} role="listitem">
              <PeekWalkRow walk={w} timezone={timezone} onOpen={() => onOpenWalkPlanner(dateKey)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
