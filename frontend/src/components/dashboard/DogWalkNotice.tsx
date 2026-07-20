import { useState } from 'react'
import type { DogWalkNoticeItem } from '@/lib/dogwalks'
import { dismiss } from '@/lib/dogWalkDismissals'
import { formatDayLabel } from '@/lib/datetime'
import { cn } from '@/lib/utils'

interface DogWalkNoticeProps {
  notices: DogWalkNoticeItem[]
  onOpenDate: (dateKey: string) => void
}

// Feature 033 US6/FR-019: templated on the notice's precomputed `dayPhrase` ('today' /
// 'tomorrow' / 'on Thu') rather than a hardcoded "today" — the exact bug a walk five days
// out was reading as happening "today".
const REASON_LABEL: Record<string, (dayPhrase: string) => string> = {
  'no-mutual-free': (dayPhrase) => `No mutual-free window ${dayPhrase}`,
  'no-good-weather': (dayPhrase) => `No good-weather window ${dayPhrase}`,
  'forecast-turned-bad': () => 'The booked window turned bad',
  'calendar-unreadable': () => "A work calendar couldn't be read",
}

function reasonLabel(reason: string | null, dayPhrase: string): string {
  return (reason && REASON_LABEL[reason]?.(dayPhrase)) || 'Needs a decision'
}

interface NoticeRowProps {
  notice: DogWalkNoticeItem
  onOpenDate: (dateKey: string) => void
  onDismiss: (key: string) => void
}

/** One notice row — alarm-bordered only for the urgent tier (today/tomorrow); quiet-tier
 *  rows (standalone or inside the collapsed summary) get the calm standard treatment
 *  (FR-020, research R7c). */
function NoticeRow({ notice, onOpenDate, onDismiss }: NoticeRowProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-3 rounded-control px-3 py-2.5 text-sm text-ink',
        notice.tier === 'urgent' ? 'border-2 border-owner-both' : 'border border-border bg-surface-alt',
      )}
    >
      <span>
        {/* owner-both *is* the accent (index.css), so its text form takes the
            text-safe variant — see --accent-strong (T033 / audit F-20). */}
        <span className="font-medium text-accent-strong">Dog walk — {formatDayLabel(notice.date, { weekday: 'short', month: 'short', day: 'numeric' })}:</span>{' '}
        {reasonLabel(notice.reason, notice.dayPhrase)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenDate(notice.date)}
          className="min-h-[44px] rounded-control px-2 text-xs font-medium text-accent-strong hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open planner
        </button>
        <button
          type="button"
          onClick={() => onDismiss(notice.key)}
          aria-label="Dismiss notice"
          className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** Two or more quiet-tier notices collapse behind one summary row (FR-020) — expanding in
 *  place shows each one's full NoticeRow underneath. */
function CollapsedQuiet({ notices, onOpenDate, onDismiss }: { notices: DogWalkNoticeItem[]; onOpenDate: (dateKey: string) => void; onDismiss: (key: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[44px] items-center justify-between gap-2 rounded-control border border-border bg-surface-alt px-3 py-2.5 text-left text-sm text-ink hover:bg-surface"
      >
        <span>{notices.length} upcoming walks need a decision</span>
        <span className="shrink-0 text-xs font-medium text-accent-strong">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded &&
        notices.map((notice) => (
          <NoticeRow key={notice.key} notice={notice} onOpenDate={onOpenDate} onDismiss={onDismiss} />
        ))}
    </div>
  )
}

/** Dashboard notice for days the dog-walk finder couldn't place/keep a good walk (US6,
 *  FR-019/020): surfaces the reason and opens the planner so Max/Jaz can book it
 *  themselves. Dismissible per-device, mirroring feature 019's AckNotices pattern —
 *  `notices` already comes pre-filtered by persisted dismissal (`lib/dogwalks.ts`'s
 *  `dogWalkNotices` selector, feature 029 US3 fix), so a dismissal survives an in-session
 *  refetch or reload; `dismissedThisSession` only smooths the immediate click-to-hide. */
export function DogWalkNotice({ notices, onOpenDate }: DogWalkNoticeProps) {
  const [dismissedThisSession, setDismissedThisSession] = useState<Set<string>>(new Set())

  const visible = notices.filter((n) => !dismissedThisSession.has(n.key))
  if (visible.length === 0) return null

  function handleDismiss(key: string) {
    dismiss(key)
    setDismissedThisSession((prev) => new Set(prev).add(key))
  }

  const urgent = visible.filter((n) => n.tier === 'urgent')
  const quiet = visible.filter((n) => n.tier === 'quiet')

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      {urgent.map((notice) => (
        <NoticeRow key={notice.key} notice={notice} onOpenDate={onOpenDate} onDismiss={handleDismiss} />
      ))}
      {quiet.length >= 2 ? (
        <CollapsedQuiet notices={quiet} onOpenDate={onOpenDate} onDismiss={handleDismiss} />
      ) : (
        quiet.map((notice) => (
          <NoticeRow key={notice.key} notice={notice} onOpenDate={onOpenDate} onDismiss={handleDismiss} />
        ))
      )}
    </div>
  )
}
