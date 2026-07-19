import { cn } from '@/lib/utils'
import type { LoadBalanceResult } from '@/lib/dashboard'
import type { Owner } from '@/types/domain'

interface Props {
  weekBalance: LoadBalanceResult
  monthBalance: LoadBalanceResult
  viewer: 'max' | 'jaz' | null
}

const OWNER_META: Record<'max' | 'jaz', { fullName: string; initial: string }> = {
  max: { fullName: 'Max', initial: 'M' },
  jaz: { fullName: 'Jaz', initial: 'J' },
}

function OwnerDot({ owner }: { owner: Owner }) {
  const initial = owner === 'both' ? 'MJ' : OWNER_META[owner].initial
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

/** Plain-sentence leader description (feature 032 US2, FR-011, audit F-19): replaces the
 *  three-row breakdown + cryptic "MORE" chip with one quiet line, using the "You" vs owner
 *  name convention already established by TaskRow/LoadBalance's own dashboard neighbors. */
function periodLine(balance: LoadBalanceResult, viewer: 'max' | 'jaz' | null, periodLabel: string): { text: string; leader: 'max' | 'jaz' | null } {
  if (balance.max === 0 && balance.jaz === 0 && balance.both === 0) {
    return { text: `Nothing tracked ${periodLabel}.`, leader: null }
  }
  if (balance.max === balance.jaz) {
    return { text: `Max and Jaz are evenly matched ${periodLabel}.`, leader: null }
  }
  const leader = balance.max > balance.jaz ? 'max' : 'jaz'
  const isViewer = viewer === leader
  const name = isViewer ? 'You' : OWNER_META[leader].fullName
  const verb = isViewer ? "'re" : ' is'
  return { text: `${name}${verb} carrying more ${periodLabel}.`, leader }
}

function PeriodLine({ label, balance, viewer }: { label: string; balance: LoadBalanceResult; viewer: 'max' | 'jaz' | null }) {
  const { text, leader } = periodLine(balance, viewer, label)
  return (
    <div className="flex items-center gap-2.5 py-1">
      {leader ? <OwnerDot owner={leader} /> : <span className="h-5 w-5 shrink-0" aria-hidden="true" />}
      <p className={cn('text-sm', leader ? 'text-ink' : 'text-ink-muted')}>{text}</p>
    </div>
  )
}

export function LoadBalance({ weekBalance, monthBalance, viewer }: Props) {
  return (
    <section aria-labelledby="lb-heading" className="px-4 pb-2 pt-1">
      <h2 id="lb-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Load balance
      </h2>
      <div className="flex flex-col">
        <PeriodLine label="this week" balance={weekBalance} viewer={viewer} />
        <PeriodLine label="this month" balance={monthBalance} viewer={viewer} />
      </div>
    </section>
  )
}
