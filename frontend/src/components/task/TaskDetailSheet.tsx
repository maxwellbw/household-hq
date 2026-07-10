import { useRef } from 'react'
import { ownerStyle } from '@/lib/owners'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useUnsnoozeTask } from '@/hooks/useMutations'
import { useToast } from '@/hooks/useToast'
import { parseSnoozeHistory } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/domain'

interface TaskDetailSheetProps {
  task: Task
  onClose: () => void
}

/** Sheet showing task info, full snooze history, and an Un-snooze action when snoozed. */
export function TaskDetailSheet({ task, onClose }: TaskDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)

  const unsnooze = useUnsnoozeTask()
  const toast = useToast()
  const style = ownerStyle(task.owner)
  const isSnoozed = task.status === 'snoozed'
  const historyRows = parseSnoozeHistory(task.snoozeHistory)

  function handleUnsnooze() {
    unsnooze.mutate(task.id, {
      onSuccess: () => {
        toast.show(`${task.title} unsnoozed`)
        onClose()
      },
    })
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
        aria-label={task.title}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink">{task.title}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
                  task.owner === 'max' && 'bg-owner-max',
                  task.owner === 'jaz' && 'bg-owner-jaz',
                  task.owner === 'both' && 'bg-owner-both',
                )}
                aria-label={style.label}
              >
                {style.initial}
              </span>
              {style.label}
              {task.dueDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Due {task.dueDate}</span>
                </>
              )}
              {isSnoozed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-ink-faint">Snoozed</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        {/* Snooze history */}
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Snooze history
          </h3>
          {historyRows.length === 0 ? (
            <p className="text-sm text-ink-faint">No snoozes yet.</p>
          ) : (
            <ol className="space-y-2">
              {historyRows.map((row, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="shrink-0 text-ink-muted">
                    {row.fromDue ?? 'No date'} → {row.newDue}
                  </span>
                  <span className="text-xs text-ink-faint tabular-nums">{row.at}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Un-snooze action */}
        {isSnoozed && (
          <button
            type="button"
            onClick={handleUnsnooze}
            disabled={unsnooze.isPending}
            className="w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unsnooze.isPending ? 'Removing snooze…' : 'Un-snooze'}
          </button>
        )}
      </div>
    </div>
  )
}
