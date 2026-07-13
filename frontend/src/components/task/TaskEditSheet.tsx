import { useRef, useState } from 'react'
import { useUpdateTask } from '@/hooks/useMutations'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { cn } from '@/lib/utils'
import type { Owner, Task } from '@/types/domain'

interface TaskEditSheetProps {
  task: Task
  onClose: () => void
}

/** Task-edit sheet: title / owner / due date (clearable) — mirrors EventEditSheet (US2, R2). */
export function TaskEditSheet({ task, onClose }: TaskEditSheetProps) {
  const updateTask = useUpdateTask()
  const panelRef = useRef<HTMLFormElement>(null)
  useDialogA11y(panelRef, onClose)

  const [title, setTitle] = useState(task.title)
  const [owner, setOwner] = useState<Owner>(task.owner)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!title.trim()) {
      setFieldError({ field: 'title', message: 'Give it a title.' })
      return
    }

    updateTask.mutate({ id: task.id, title: title.trim(), owner, dueDate, notes })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Edit task</h2>
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
            placeholder="Task title"
            aria-invalid={fieldError?.field === 'title' ? true : undefined}
            className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {fieldError?.field === 'title' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
        </label>

        <div className="mb-3">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Due date</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-invalid={fieldError?.field === 'dueDate' ? true : undefined}
              className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="button"
              onClick={() => setDueDate('')}
              disabled={!dueDate}
              className="min-h-[44px] shrink-0 rounded-control border border-border px-3 text-sm font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear date
            </button>
          </div>
          {fieldError?.field === 'dueDate' && <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>}
          {!dueDate && <p className="mt-1 text-xs text-ink-muted">No date — this task will be in Someday.</p>}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note — links are tappable"
            rows={2}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

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
          disabled={updateTask.isPending}
          className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {updateTask.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
