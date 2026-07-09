import { ownerStyle } from '@/lib/owners'
import { relativeDue } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { useCompleteTask, useReopenTask } from '@/hooks/useMutations'
import { useToast } from '@/hooks/useToast'
import type { Task } from '@/types/domain'

interface TaskRowProps {
  task: Task
  timezone: string
  /** Relative-due is computed against this event's start (T−N label) when set; otherwise against today. */
  eventStartKey?: string
}

/** DESIGN.md "Task row": checkbox · title · owner chip · due label. Checking off completes/reopens the task (US6). */
export function TaskRow({ task, timezone, eventStartKey }: TaskRowProps) {
  const style = ownerStyle(task.owner)
  const due = relativeDue(task.dueDate, timezone, eventStartKey)
  const isDone = task.status === 'done'
  const complete = useCompleteTask()
  const reopen = useReopenTask()
  const toast = useToast()

  function toggle() {
    if (isDone) {
      reopen.mutate(task.id)
    } else {
      complete.mutate(task.id, {
        onSuccess: () => toast.show(`Done — ${task.title}`),
      })
    }
  }

  return (
    <div className="flex min-h-[44px] items-center gap-3 border-b border-border px-1 py-2 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isDone}
        aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} done`}
        className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-200',
            isDone ? 'border-success bg-success' : 'border-border hover:border-accent',
          )}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-surface motion-safe:animate-in motion-safe:zoom-in" fill="none">
              <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
      <span
        className={cn(
          'flex-1 text-sm transition-all duration-200',
          isDone ? 'text-ink-faint line-through' : 'text-ink',
        )}
      >
        {task.title}
      </span>
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
      {due && <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-muted">{due}</span>}
    </div>
  )
}
