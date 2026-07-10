import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
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
  /** Called when the user picks Snooze from the overflow menu (wired in US3). */
  onSnooze?: () => void
  /** Called when the user picks Edit due from the overflow menu (wired in US4). */
  onEditDue?: () => void
  /** Called when the user taps the task title to open the detail sheet (wired in US3). */
  onDetail?: () => void
}

/** DESIGN.md "Task row": checkbox · title · owner chip · due label · overflow menu. */
export function TaskRow({ task, timezone, eventStartKey, onSnooze, onEditDue, onDetail }: TaskRowProps) {
  const style = ownerStyle(task.owner)
  const due = relativeDue(task.dueDate, timezone, eventStartKey)
  const isDone = task.status === 'done'
  const isSnoozed = task.status === 'snoozed'
  const complete = useCompleteTask()
  const reopen = useReopenTask()
  const toast = useToast()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    // WCAG 2.1.1: auto-focus first item so keyboard users enter the menu immediately.
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        )
        if (!items.length) return
        e.preventDefault()
        const idx = items.indexOf(document.activeElement as HTMLElement)
        const next =
          e.key === 'ArrowDown'
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length
        items[next].focus()
      }
    }
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [menuOpen])

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
    <div
      className={cn(
        'flex min-h-[44px] items-center gap-3 border-b border-border px-1 py-2 last:border-b-0',
        isSnoozed && 'opacity-60',
      )}
    >
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

      <button
        type="button"
        onClick={onDetail}
        disabled={!onDetail}
        className={cn(
          'flex-1 text-left text-sm transition-all duration-200',
          isDone ? 'text-ink-faint line-through' : 'text-ink',
          onDetail && 'hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        {task.title}
        {isSnoozed && task.dueDate && (
          <span className="ml-2 text-xs text-ink-muted">snoozed until {task.dueDate}</span>
        )}
      </button>

      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          task.owner === 'max' && 'bg-owner-max',
          task.owner === 'jaz' && 'bg-owner-jaz',
          task.owner === 'both' && 'bg-accent-hover',
        )}
        aria-label={style.label}
      >
        {style.initial}
      </span>

      {due && !isSnoozed && (
        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-muted">{due}</span>
      )}

      {/* Overflow menu */}
      <div ref={menuRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`More options for ${task.title}`}
          className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MoreVertical size={16} aria-hidden="true" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-control border border-border bg-surface py-1 shadow-card"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); onSnooze?.() }}
              className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-sm text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Snooze
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); onEditDue?.() }}
              className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-sm text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Edit due
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
