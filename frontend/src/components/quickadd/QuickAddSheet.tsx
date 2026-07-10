import { useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { useCreateEvent, useCreateOneTimeTask, useCreateRecurring } from '@/hooks/useMutations'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { endBeforeStart } from '@/lib/datetime'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Cadence, Owner } from '@/types/domain'

type QuickAddType = 'event' | 'recurring' | 'task'

const TYPE_LABELS: Record<QuickAddType, string> = {
  event: 'Event',
  recurring: 'Recurring chore',
  task: 'One-time task',
}

const CADENCES: Cadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']

interface QuickAddSheetProps {
  onClose: () => void
}

/** One "+" → event | recurring chore | one-time task, minimal fast path (US5, FR-021-024). */
export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const { session } = useAuth()
  const { timezone } = useSettings()
  const defaultOwner: Owner = session?.who.identity === 'shared' ? (session.actingPerson ?? 'both') : (session?.who.identity ?? 'both')

  const [type, setType] = useState<QuickAddType>('event')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [owner, setOwner] = useState<Owner>(defaultOwner)
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const createEvent = useCreateEvent()
  const createRecurring = useCreateRecurring()
  const createTask = useCreateOneTimeTask(timezone)
  const panelRef = useRef<HTMLFormElement>(null)
  useDialogA11y(panelRef, onClose)

  const isPending = createEvent.isPending || createRecurring.isPending || createTask.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    if (!title.trim()) {
      setFieldError({ field: 'title', message: 'Give it a title.' })
      return
    }

    try {
      if (type === 'event') {
        const start = date && time ? `${date}T${time}` : date ? `${date}T09:00` : ''
        if (!start) {
          setFieldError({ field: 'start', message: 'Pick a date.' })
          return
        }
        const end = endDate ? (endTime ? `${endDate}T${endTime}` : endDate) : undefined
        if (end && endBeforeStart(start, end)) {
          setFieldError({ field: 'end', message: 'End must be on or after start.' })
          return
        }
        await createEvent.mutateAsync({ title, start, end, owner })
      } else if (type === 'recurring') {
        if (!date) {
          setFieldError({ field: 'anchorDate', message: 'Pick a starting date.' })
          return
        }
        await createRecurring.mutateAsync({ title, cadence, anchorDate: date, defaultOwner: owner })
      } else {
        await createTask.mutateAsync({ title, dueDate: date || undefined, owner })
      }
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError({ field: err.field, message: err.message })
      } else {
        setFieldError({ message: 'Something went wrong saving that. Please try again.' })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add something"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Add something</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-control bg-surface-alt p-1">
          {(['event', 'recurring', 'task'] as QuickAddType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'min-h-[44px] flex-1 rounded-control px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                type === t ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">What</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-invalid={fieldError?.field === 'title' ? true : undefined}
            className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {fieldError?.field === 'title' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
        </label>

        <div className="mb-3 flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-ink-muted">
              {type === 'recurring' ? 'Starting' : 'When'}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          {type === 'event' && (
            <label className="w-28">
              <span className="mb-1 block text-xs font-medium text-ink-muted">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-[44px] w-full rounded-control border border-border bg-surface px-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </label>
          )}
        </div>
        {(fieldError?.field === 'start' || fieldError?.field === 'anchorDate') && (
          <p role="alert" className="-mt-2 mb-3 text-xs text-danger">{fieldError.message}</p>
        )}

        {type === 'event' && (
          <div className="mb-3">
            <span className="mb-1 block text-xs font-medium text-ink-muted">End (optional)</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
        )}

        {type === 'recurring' && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Repeats</span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}

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

        {fieldError && !fieldError.field && <p className="mb-3 text-sm text-danger">{fieldError.message}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Add'}
        </button>
      </form>
    </div>
  )
}
