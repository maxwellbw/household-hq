import { useRef, useState } from 'react'
import { ownerStyle } from '@/lib/owners'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useAuth } from '@/hooks/useAuth'
import { useUnsnoozeTask, useDeleteTask, useAcknowledgeTask } from '@/hooks/useMutations'
import { useToast } from '@/hooks/useToast'
import { parseSnoozeHistory, canAcknowledge, isUncommitted } from '@/lib/tasks'
import { resolveViewer } from '@/lib/dashboard'
import { cn } from '@/lib/utils'
import { TaskEditSheet } from '@/components/task/TaskEditSheet'
import { SnoozeDialog } from '@/components/task/SnoozeDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NotesText } from '@/components/ui/NotesText'
import type { Task } from '@/types/domain'

interface TaskDetailSheetProps {
  task: Task
  onClose: () => void
  /** Opens the sheet already in edit mode (e.g. from the row's "Edit due" action). */
  initialEdit?: boolean
}

/** Sheet showing task info + snooze history, read-only by default with an Edit button (US2). */
export function TaskDetailSheet({ task, onClose, initialEdit = false }: TaskDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)

  const unsnooze = useUnsnoozeTask()
  const deleteTask = useDeleteTask()
  const acknowledge = useAcknowledgeTask()
  const toast = useToast()
  const { session } = useAuth()
  const viewer = resolveViewer(session)
  const [showEdit, setShowEdit] = useState(initialEdit)
  const [showSnooze, setShowSnooze] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const style = ownerStyle(task.owner)
  const isSnoozed = task.status === 'snoozed'
  const isRecurring = !!task.recurringId
  const historyRows = parseSnoozeHistory(task.snoozeHistory)
  const uncommitted = isUncommitted(task)
  const canCommit = canAcknowledge(task, viewer ?? undefined)

  function handleUnsnooze() {
    unsnooze.mutate(task.id, {
      onSuccess: () => {
        toast.show(`${task.title} unsnoozed`)
        onClose()
      },
    })
  }

  function handleAcknowledge() {
    acknowledge.mutate(task.id, {
      onSuccess: () => toast.show("Got it — you're on it"),
    })
  }

  function handleDelete() {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.show(`${task.title} deleted`)
        onClose()
      },
      onError: () => {
        toast.show("Couldn't delete — it may have already been removed")
        onClose()
      },
    })
  }

  return (
    <>
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
                aria-hidden="true"
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
            {uncommitted && (
              <p className="mt-2">
                <span className="inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-surface">
                  Not yet committed
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              aria-label="Edit task"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-sm font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              aria-label="Delete task"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-sm font-medium text-danger hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              Delete
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

        {/* Notes */}
        {task.notes && (
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Notes</h3>
            <NotesText text={task.notes} />
          </div>
        )}

        {/* Acknowledge / commit */}
        {canCommit && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={acknowledge.isPending}
              className="min-h-[44px] w-full rounded-control bg-accent px-4 text-sm font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {acknowledge.isPending ? 'Committing…' : "I've got it"}
            </button>
          </div>
        )}

        {/* Snooze history */}
        <div className="mb-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Snooze history
          </h3>
          {historyRows.length === 0 ? (
            <p className="text-sm text-ink-muted">No snoozes yet.</p>
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

        {/* Snooze / Un-snooze actions */}
        <div className="flex gap-2">
          {task.dueDate && (
            <button
              type="button"
              onClick={() => setShowSnooze(true)}
              className="flex-1 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Snooze
            </button>
          )}
          {isSnoozed && (
            <button
              type="button"
              onClick={handleUnsnooze}
              disabled={unsnooze.isPending}
              className="flex-1 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {unsnooze.isPending ? 'Removing snooze…' : 'Un-snooze'}
            </button>
          )}
        </div>
      </div>
    </div>
    {showEdit && (
      <TaskEditSheet task={task} onClose={() => setShowEdit(false)} />
    )}
    {showSnooze && (
      <SnoozeDialog task={task} onClose={() => setShowSnooze(false)} />
    )}
    {showDelete && (
      <ConfirmDialog
        title="Delete task?"
        body={
          isRecurring
            ? 'This deletes only this occurrence. The recurring rule keeps making new ones (manage rules in More → Recurring).'
            : undefined
        }
        confirmLabel="Delete"
        isPending={deleteTask.isPending}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    )}
    </>
  )
}
