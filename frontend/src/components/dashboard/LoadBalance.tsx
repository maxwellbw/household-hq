import { cn } from '@/lib/utils'
import type { LoadBalanceResult } from '@/lib/dashboard'
import type { Owner } from '@/types/domain'

interface Props {
  weekBalance: LoadBalanceResult
  monthBalance: LoadBalanceResult
  viewer: 'max' | 'jaz' | null
}

const OWNER_META: Record<'max' | 'jaz' | 'both', { fullName: string; initial: string }> = {
  max: { fullName: 'Max', initial: 'M' },
  jaz: { fullName: 'Jaz', initial: 'J' },
  both: { fullName: 'Both', initial: 'MJ' },
}

function displayName(owner: 'max' | 'jaz' | 'both', viewer: 'max' | 'jaz' | null): string {
  if (owner !== 'both' && viewer === owner) return 'You'
  return OWNER_META[owner].fullName
}

function OwnerDot({ owner }: { owner: Owner }) {
  const { initial } = OWNER_META[owner]
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
        owner === 'max' && 'bg-owner-max',
        owner === 'jaz' && 'bg-owner-jaz',
        owner === 'both' && 'bg-accent-hover',
      )}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

interface PeriodProps {
  headingId: string
  label: string
  balance: LoadBalanceResult
  viewer: 'max' | 'jaz' | null
}

function PeriodSection({ headingId, label, balance, viewer }: PeriodProps) {
  const maxLeads = balance.max > balance.jaz
  const jazLeads = balance.jaz > balance.max

  const rows: Array<{ owner: 'max' | 'jaz' | 'both'; leads: boolean }> = [
    { owner: 'max', leads: maxLeads },
    { owner: 'jaz', leads: jazLeads },
    { owner: 'both', leads: false },
  ]

  return (
    <div>
      <p id={headingId} className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <ul
        role="list"
        aria-labelledby={headingId}
        className="divide-y divide-border rounded-control border border-border bg-surface"
      >
        {rows.map(({ owner, leads }) => {
          const name = displayName(owner, viewer)
          return (
            <li
              key={owner}
              className={cn('flex min-h-[44px] items-center gap-3 px-3 py-2', leads && 'bg-surface-alt')}
            >
              <OwnerDot owner={owner} />
              <span className={cn('flex-1 text-sm', leads ? 'font-semibold text-ink' : 'text-ink')}>
                {name}
              </span>
              {leads && (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  more
                </span>
              )}
              <span
                className={cn(
                  'shrink-0 tabular-nums text-sm',
                  leads ? 'font-semibold text-ink' : 'text-ink-muted',
                )}
                aria-label={`${name} — ${balance[owner]} task${balance[owner] === 1 ? '' : 's'}`}
              >
                {balance[owner]}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function LoadBalance({ weekBalance, monthBalance, viewer }: Props) {
  return (
    <section aria-labelledby="lb-heading" className="px-4 pb-2 pt-1">
      <h2 id="lb-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Load balance
      </h2>
      <div className="flex flex-col gap-4">
        <PeriodSection
          headingId="lb-week"
          label="This week"
          balance={weekBalance}
          viewer={viewer}
        />
        <PeriodSection
          headingId="lb-month"
          label="This month"
          balance={monthBalance}
          viewer={viewer}
        />
      </div>
    </section>
  )
}
