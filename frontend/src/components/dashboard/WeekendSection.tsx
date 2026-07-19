import { cn } from '@/lib/utils'
import { ownerStyle } from '@/lib/owners'
import { formatDate, formatTime, isAllDay } from '@/lib/datetime'
import { TaskRow } from '@/components/task/TaskRow'
import type { Event, Task } from '@/types/domain'

interface Props {
  tasks: Task[]
  events: Event[]
  timezone: string
}

function EventRow({ event, timezone }: { event: Event; timezone: string }) {
  const style = ownerStyle(event.owner)
  const allDay = isAllDay(event.start, event.end)
  const time = allDay ? null : formatTime(event.start, timezone)
  const endKey = event.end.slice(0, 10)
  const startKey = event.start.slice(0, 10)
  const isMultiDay = endKey > startKey

  return (
    <div className="flex min-h-[44px] items-center gap-3 border-b border-border px-1 py-2 last:border-b-0">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          event.owner === 'max' && 'bg-owner-max',
          event.owner === 'jaz' && 'bg-owner-jaz',
          event.owner === 'both' && 'bg-accent-hover',
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
      {time && !isMultiDay && (
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{time}</span>
      )}
      <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
        event
      </span>
    </div>
  )
}

/** "This weekend" dashboard section (feature 032 US2): the last of the former three-group
 *  SmartViews block — Today folded into the day card, Overdue promoted to its own top
 *  section (OverdueSection.tsx), this is what's left. */
export function WeekendSection({ tasks, events, timezone }: Props) {
  const isEmpty = tasks.length === 0 && events.length === 0
  return (
    <section aria-labelledby="sv-weekend" className="px-4 pb-2 pt-1">
      <h2 id="sv-weekend" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        This weekend
      </h2>

      {isEmpty ? (
        <p className="py-3 font-display text-sm text-ink-muted">Nothing lined up this weekend.</p>
      ) : (
        <ul role="list" className="rounded-control border border-border bg-surface">
          {events.map((e) => (
            <li key={e.id} role="listitem">
              <EventRow event={e} timezone={timezone} />
            </li>
          ))}
          {tasks.map((t) => (
            <li key={t.id} role="listitem">
              <TaskRow task={t} timezone={timezone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
