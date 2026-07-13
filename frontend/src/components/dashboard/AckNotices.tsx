import { useState } from 'react'
import type { AckNotice } from '@/lib/ackNotices'
import { dismiss } from '@/lib/ackDismissals'
import { cn } from '@/lib/utils'

interface AckNoticesProps {
  notices: AckNotice[]
}

/** Dismissible "X has it" notices for tasks the viewer assigned that were just
 *  acknowledged (feature 019 US2). Persists across reloads until dismissed (research R4).
 *  Restyled (feature 028 R7) to the same quiet owner-colored outline language as the
 *  ack chip on TaskRow/TaskDetailSheet, colored for whoever committed. */
export function AckNotices({ notices }: AckNoticesProps) {
  const [dismissedThisSession, setDismissedThisSession] = useState<Set<string>>(new Set())
  const visible = notices.filter((n) => !dismissedThisSession.has(n.key))

  if (visible.length === 0) return null

  function handleDismiss(key: string) {
    dismiss(key)
    setDismissedThisSession((prev) => new Set(prev).add(key))
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      {visible.map((notice) => (
        <div
          key={notice.key}
          role="status"
          className={cn(
            'flex items-center justify-between gap-3 rounded-control border-2 px-3 py-2.5 text-sm text-ink',
            notice.assignee === 'max' ? 'border-owner-max' : 'border-owner-jaz',
          )}
        >
          <span>
            <span className={cn('font-medium', notice.assignee === 'max' ? 'text-owner-max' : 'text-owner-jaz')}>
              {notice.assignee === 'max' ? 'Max' : 'Jaz'} has it:
            </span>{' '}
            {notice.taskTitle}
          </span>
          <button
            type="button"
            onClick={() => handleDismiss(notice.key)}
            aria-label="Dismiss notice"
            className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
