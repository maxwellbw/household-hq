import { cn } from '@/lib/utils'
import type { Highlight } from '@/lib/dashboard'

const INITIAL: Record<string, string> = { max: 'M', jaz: 'J', both: 'MJ' }
const LABEL: Record<string, string> = { max: 'Max', jaz: 'Jaz', both: 'Both' }

interface Props {
  items: Highlight[]
}

export function Highlights({ items }: Props) {
  return (
    <section aria-labelledby="hl-heading" className="px-4 pb-4 pt-1">
      <h2 id="hl-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Coming up
      </h2>
      {items.length === 0 ? (
        <p className="py-3 font-display text-sm text-ink-muted">All quiet — nothing unusual ahead.</p>
      ) : (
        <ul role="list" className="flex flex-col gap-1">
          {items.map((h, i) => (
            <li key={i} className="flex min-h-[44px] items-center gap-3">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
                  h.owner === 'max' && 'bg-owner-max',
                  h.owner === 'jaz' && 'bg-owner-jaz',
                  h.owner === 'both' && 'bg-owner-both',
                )}
                aria-label={LABEL[h.owner]}
              >
                {INITIAL[h.owner]}
              </span>
              <span className="flex-1 text-sm text-ink">{h.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
