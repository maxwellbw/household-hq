import { useState } from 'react'
import type { DogWalk } from '@/types/domain'
import { dismiss, dogWalkNoticeKey } from '@/lib/dogWalkDismissals'
import { formatDayLabel } from '@/lib/datetime'

interface DogWalkNoticeProps {
  days: DogWalk[]
  onOpenDate: (dateKey: string) => void
}

const REASON_LABEL: Record<string, string> = {
  'no-mutual-free': 'No mutual-free window today',
  'no-good-weather': 'No good-weather window today',
  'forecast-turned-bad': 'The booked window turned bad',
  'calendar-unreadable': "A work calendar couldn't be read",
}

function reasonLabel(reason: string | null): string {
  return (reason && REASON_LABEL[reason]) || 'Needs a decision'
}

/** Dashboard notice for days the dog-walk finder couldn't place/keep a good walk (US5,
 *  FR-019): surfaces the reason and links into the calendar so Max/Jaz can book it
 *  themselves. Dismissible per-device, mirroring feature 019's AckNotices pattern — a
 *  dismissed day resurfaces only if the engine later re-flags it with a different reason. */
export function DogWalkNotice({ days, onOpenDate }: DogWalkNoticeProps) {
  const [dismissedThisSession, setDismissedThisSession] = useState<Set<string>>(new Set())

  const visible = days.filter((d) => !dismissedThisSession.has(dogWalkNoticeKey(d.date, d.slot, d.reason ?? '')))
  if (visible.length === 0) return null

  function handleDismiss(key: string) {
    dismiss(key)
    setDismissedThisSession((prev) => new Set(prev).add(key))
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      {visible.map((day) => {
        const key = dogWalkNoticeKey(day.date, day.slot, day.reason ?? '')
        return (
          <div
            key={key}
            role="status"
            className="flex items-center justify-between gap-3 rounded-control border-2 border-owner-both px-3 py-2.5 text-sm text-ink"
          >
            <span>
              <span className="font-medium text-owner-both">Dog walk — {formatDayLabel(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}:</span>{' '}
              {reasonLabel(day.reason)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenDate(day.date)}
                className="min-h-[44px] rounded-control px-2 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Open in calendar
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(key)}
                aria-label="Dismiss notice"
                className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                ✕
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
