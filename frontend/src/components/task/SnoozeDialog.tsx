import { useRef, useState } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useSnoozeTask } from '@/hooks/useMutations'
import { useToast } from '@/hooks/useToast'
import type { Task } from '@/types/domain'

interface SnoozeDialogProps {
  task: Task
  onClose: () => void
}

function isoToday(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Dialog: snooze a task to Tomorrow, Next week, or a custom date ≥ today. */
export function SnoozeDialog({ task, onClose }: SnoozeDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)

  const snooze = useSnoozeTask()
  const toast = useToast()

  const today = isoToday()
  const [customDate, setCustomDate] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  function pick(date: string) {
    setSelected(date)
    setCustomDate('')
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomDate(e.target.value)
    setSelected(null)
  }

  const activeDate = selected ?? (customDate || null)

  function submit() {
    if (!activeDate) return
    snooze.mutate(
      { id: task.id, dueDate: activeDate },
      {
        onSuccess: () => {
          toast.show(`Snoozed until ${activeDate}`)
          onClose()
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Snooze ${task.title}`}
        className="w-full max-w-sm rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-ink">Snooze task</h2>
            <p className="mt-0.5 text-sm text-ink-muted line-clamp-1">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        {/* Presets */}
        <div className="mb-4 flex gap-2">
          {[
            { label: 'Tomorrow', date: isoOffset(1) },
            { label: 'Next week', date: isoOffset(7) },
          ].map(({ label, date }) => (
            <button
              key={label}
              type="button"
              onClick={() => pick(date)}
              className={`flex-1 rounded-control border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected === date
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface text-ink hover:bg-surface-alt'
              }`}
            >
              {label}
              <span className="ml-1 text-xs font-normal text-ink-muted">{date}</span>
            </button>
          ))}
        </div>

        {/* Custom date */}
        <div className="mb-5">
          <label htmlFor="snooze-date" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Pick a date
          </label>
          <input
            id="snooze-date"
            type="date"
            min={today}
            value={customDate}
            onChange={handleCustomChange}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!activeDate || snooze.isPending}
            className="flex-1 rounded-control bg-accent px-4 py-2 text-sm font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {snooze.isPending ? 'Snoozing…' : 'Snooze'}
          </button>
        </div>
      </div>
    </div>
  )
}
