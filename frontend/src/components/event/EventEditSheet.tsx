import { useRef, useState } from 'react'
import { useUpdateEvent } from '@/hooks/useMutations'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { endBeforeStart } from '@/lib/datetime'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Event, Owner } from '@/types/domain'

interface EventEditSheetProps {
  event: Event
  onClose: () => void
}

function splitDateTime(iso: string): { date: string; time: string } {
  const tIdx = iso.indexOf('T')
  if (tIdx === -1) return { date: iso, time: '' }
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** Minimal event-edit sheet: title / start / end / owner (US4, R7). */
export function EventEditSheet({ event, onClose }: EventEditSheetProps) {
  const updateEvent = useUpdateEvent()
  const panelRef = useRef<HTMLFormElement>(null)
  useDialogA11y(panelRef, onClose)

  const { date: initStartDate, time: initStartTime } = splitDateTime(event.start)
  const { date: initEndDate, time: initEndTime } = splitDateTime(event.end ?? '')

  const [title, setTitle] = useState(event.title)
  const [startDate, setStartDate] = useState(initStartDate)
  const [startTime, setStartTime] = useState(initStartTime)
  const [endDate, setEndDate] = useState(initEndDate)
  const [endTime, setEndTime] = useState(initEndTime)
  const [owner, setOwner] = useState<Owner>(event.owner)
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!title.trim()) {
      setFieldError({ field: 'title', message: 'Give it a title.' })
      return
    }
    if (!startDate) {
      setFieldError({ field: 'start', message: 'Pick a start date.' })
      return
    }

    const start = startTime ? `${startDate}T${startTime}` : `${startDate}T09:00`
    const end = endDate ? (endTime ? `${endDate}T${endTime}` : endDate) : undefined

    if (end && endBeforeStart(start, end)) {
      setFieldError({ field: 'end', message: 'End must be on or after start.' })
      return
    }

    try {
      await updateEvent.mutateAsync({ id: event.id, title: title.trim(), start, end, owner })
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError({ field: err.field, message: err.message })
      } else {
        setFieldError({ message: 'Something went wrong. Please try again.' })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit event"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Edit event</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Title</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            aria-invalid={fieldError?.field === 'title' ? true : undefined}
            className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {fieldError?.field === 'title' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
        </label>

        <div className="mb-1">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Start</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-invalid={fieldError?.field === 'start' ? true : undefined}
              className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="min-h-[44px] w-28 rounded-control border border-border bg-surface px-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          {fieldError?.field === 'start' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
        </div>

        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-ink-muted">End</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={fieldError?.field === 'end' ? true : undefined}
              className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="min-h-[44px] w-28 rounded-control border border-border bg-surface px-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          {fieldError?.field === 'end' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
        </div>

        <div className="mb-5">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Who</span>
          <div className="flex gap-2">
            {ALL_OWNERS.map((o) => {
              const style = ownerStyle(o)
              const selected = owner === o
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOwner(o)}
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-control border px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    selected ? 'border-accent bg-accent-soft text-ink' : 'border-border text-ink-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-surface',
                      o === 'max' && 'bg-owner-max',
                      o === 'jaz' && 'bg-owner-jaz',
                      o === 'both' && 'bg-owner-both',
                    )}
                  >
                    {style.initial}
                  </span>
                  {style.label}
                </button>
              )
            })}
          </div>
        </div>

        {fieldError && !fieldError.field && <p role="alert" className="mb-3 text-sm text-danger">{fieldError.message}</p>}

        <button
          type="submit"
          disabled={updateEvent.isPending}
          className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {updateEvent.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
