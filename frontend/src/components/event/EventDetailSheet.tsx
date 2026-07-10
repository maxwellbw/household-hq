import { useRef, useState } from 'react'
import { formatDate, formatTime, isAllDay, dayKey } from '@/lib/datetime'
import { ownerStyle } from '@/lib/owners'
import { TaskRow } from '@/components/task/TaskRow'
import { EventEditSheet } from '@/components/event/EventEditSheet'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { cn } from '@/lib/utils'
import type { EventWithTasks } from '@/lib/tether'

interface EventDetailSheetProps {
  event: EventWithTasks
  timezone: string
  onClose: () => void
}

/** Opens on event tap: details + the tethered prep checklist (US2, FR-012). */
export function EventDetailSheet({ event, timezone, onClose }: EventDetailSheetProps) {
  const style = ownerStyle(event.owner)
  const allDay = isAllDay(event.start, event.end)
  const eventStartKey = dayKey(event.start, timezone)
  const panelRef = useRef<HTMLDivElement>(null)
  const [showEdit, setShowEdit] = useState(false)
  useDialogA11y(panelRef, onClose)

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">{event.title}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-surface',
                  event.owner === 'max' && 'bg-owner-max',
                  event.owner === 'jaz' && 'bg-owner-jaz',
                  event.owner === 'both' && 'bg-owner-both',
                )}
                aria-hidden="true"
              >
                {style.initial}
              </span>
              {style.label}
              <span aria-hidden="true">·</span>
              {allDay ? 'All day' : `${formatTime(event.start, timezone)}–${formatTime(event.end, timezone)}`}
              <span aria-hidden="true">·</span>
              {formatDate(event.start, timezone)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              aria-label="Edit event"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-sm font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              ✕
            </button>
          </div>
        </div>

        {event.notes && <p className="mb-4 text-sm text-ink">{event.notes}</p>}

        {event.tasks.length > 0 ? (
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Prep</h3>
            {event.tasks.map((task) => (
              <TaskRow key={task.id} task={task} timezone={timezone} eventStartKey={eventStartKey} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">No prep tasks for this event.</p>
        )}
      </div>
    </div>
    {showEdit && (
      <EventEditSheet event={event} onClose={() => setShowEdit(false)} />
    )}
    </>
  )
}
