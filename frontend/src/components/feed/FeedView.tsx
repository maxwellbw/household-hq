import { useActivity } from '@/hooks/useActivity'
import { useSettings } from '@/hooks/useSettings'
import { ownerStyle } from '@/lib/owners'
import { formatDate, formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import type { ActivityEntry } from '@/types/domain'

function FeedItem({ entry, timezone }: { entry: ActivityEntry; timezone: string }) {
  const style = ownerStyle(entry.actor)
  const dateLabel = formatDate(entry.timestamp, timezone, { month: 'short', day: 'numeric' })
  const timeLabel = formatTime(entry.timestamp, timezone)

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
          entry.actor === 'max' && 'bg-owner-max',
          entry.actor === 'jaz' && 'bg-owner-jaz',
        )}
        aria-label={style.label}
      >
        {style.initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{entry.summary}</p>
        <p className="mt-0.5 text-xs tabular-nums text-ink-faint">
          {dateLabel} · {timeLabel}
        </p>
      </div>
    </li>
  )
}

/** Reverse-chronological activity stream (US5) — backend returns newest-first. */
export function FeedView() {
  const { data: entries, isPending, isError } = useActivity()
  const { timezone } = useSettings()

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6" aria-busy="true" aria-label="Loading feed">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-surface-alt" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-alt" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-alt" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">Could not load activity</p>
        <p className="text-sm text-ink-muted">Check your connection and try again.</p>
      </div>
    )
  }

  if (!entries?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">No activity yet</p>
        <p className="text-sm text-ink-muted">
          Actions like completing tasks, adding events, and snoozing will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <h2 className="mb-1 px-0 text-xs font-medium uppercase tracking-wide text-ink-faint">
        Recent activity
      </h2>
      <ul className="rounded-card bg-surface shadow-card" aria-label="Activity feed, newest first">
        {entries.map((entry, i) => (
          <FeedItem key={entry.id ?? i} entry={entry} timezone={timezone} />
        ))}
      </ul>
    </div>
  )
}
