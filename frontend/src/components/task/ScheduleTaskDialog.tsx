import { useRef, useState } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useScheduleTask } from '@/hooks/useMutations'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/hooks/useToast'
import { canConfirm } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { todayKey } from '@/lib/datetime'
import type { Owner } from '@/types/domain'

interface ScheduleTaskDialogProps {
  taskId: string
  /** Pre-filled date (from drag drop); empty string = no pre-fill (tap path). */
  initialDate?: string
  onClose: () => void
}

const OWNERS: { value: Owner; label: string; bg: string }[] = [
  { value: 'max', label: 'Max', bg: 'bg-owner-max' },
  { value: 'jaz', label: 'Jaz', bg: 'bg-owner-jaz' },
  { value: 'both', label: 'Both', bg: 'bg-owner-both' },
]

export function ScheduleTaskDialog({ taskId, initialDate = '', onClose }: ScheduleTaskDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)

  const { timezone } = useSettings()
  const schedule = useScheduleTask()
  const toast = useToast()

  const [date, setDate] = useState(initialDate)
  const [owner, setOwner] = useState<Owner | null>(null)

  const draft = { taskId, date, owner }
  const ready = canConfirm(draft)
  const isPending = schedule.isPending

  async function handleConfirm() {
    if (!ready || isPending) return
    try {
      await schedule.mutateAsync(draft)
      onClose()
    } catch {
      toast.show("Couldn't schedule — try again")
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-scrim motion-safe:animate-in motion-safe:fade-in" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-sm rounded-t-2xl border border-border bg-surface px-5 pb-8 pt-5 shadow-card',
          'sm:rounded-2xl',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-4 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:fade-in',
        )}
      >
        <h2 id="schedule-dialog-title" className="mb-4 font-display text-base font-semibold text-ink">
          Schedule task
        </h2>

        {/* Date field */}
        <div className="mb-4">
          <label htmlFor="schedule-date" className="mb-1 block text-sm font-medium text-ink">
            Date
          </label>
          <input
            id="schedule-date"
            type="date"
            value={date}
            min={todayKey(timezone)}
            onChange={(e) => setDate(e.target.value)}
            className={cn(
              'w-full rounded-control border border-border bg-bg px-3 py-2 text-ink',
              'min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          />
        </div>

        {/* Owner segmented control — no pre-selection (FR-007) */}
        <fieldset className="mb-6">
          <legend className="mb-1 block text-sm font-medium text-ink">Owner</legend>
          <div className="flex gap-2">
            {OWNERS.map(({ value, label, bg }) => {
              const selected = owner === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOwner(value)}
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-control border text-sm font-medium transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    selected
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-border bg-bg text-ink hover:bg-surface-alt',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-surface',
                      bg,
                    )}
                    aria-hidden="true"
                  >
                    {label === 'Both' ? 'MJ' : label[0]}
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              'flex min-h-[44px] flex-1 items-center justify-center rounded-control border border-border text-sm font-medium text-ink transition-colors',
              'hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              'disabled:opacity-50',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready || isPending}
            aria-disabled={!ready || isPending}
            className={cn(
              'flex min-h-[44px] flex-1 items-center justify-center rounded-control text-sm font-medium text-surface transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              ready && !isPending ? 'bg-accent-hover hover:brightness-90' : 'bg-accent/40 cursor-not-allowed',
            )}
          >
            {isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
