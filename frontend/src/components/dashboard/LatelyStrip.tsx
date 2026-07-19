import { useActivity } from '@/hooks/useActivity'
import { activityActorStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'

interface LatelyStripProps {
  onSeeAll: () => void
}

const CAP = 4

/** Small, quiet strip of the most recent household activity (feature 032 US2, FR-009, audit
 *  F-18): so the other person's completions are visible on Home without a trip to
 *  More → Feed. A secondary surface — any load failure or empty feed hides it entirely
 *  rather than showing an error on the dashboard (spec edge case).
 *
 *  Filtered to max/jaz actors: live data showed automated entries (digests, push pings, dog-
 *  walk moves) dominate the raw feed — the strip's whole point is "see what the other person
 *  did," so system noise would otherwise bury or crowd out every human entry (spec deviation,
 *  written back to spec.md). The full Feed (FeedView) is the unfiltered audit trail and is
 *  unaffected. */
export function LatelyStrip({ onSeeAll }: LatelyStripProps) {
  const { data, isPending, isError } = useActivity()

  const entries = (data ?? []).filter((entry) => entry.actor === 'max' || entry.actor === 'jaz').slice(0, CAP)
  if (isPending || isError || entries.length === 0) return null

  return (
    <section aria-labelledby="lately-heading" className="px-4 pb-2 pt-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="lately-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Lately
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="min-h-[44px] rounded-control px-1 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          See all
        </button>
      </div>
      <ul role="list" className="flex flex-col gap-2">
        {entries.map((entry, i) => {
          const style = activityActorStyle(entry.actor)
          return (
            <li key={entry.id ?? i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
                  style.bgClass,
                )}
                aria-label={style.label}
              >
                {style.initial}
              </span>
              <span className="flex-1 text-sm text-ink-muted">{entry.summary}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
