import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'
import { useRecurring } from '@/hooks/useRecurring'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { highlights, loadBalance, resolveViewer, sevenDayTiles, smartViews } from '@/lib/dashboard'
import { monthRange, weekRange } from '@/lib/datetime'
import { SmartViews } from '@/components/dashboard/SmartViews'
import { LoadBalance } from '@/components/dashboard/LoadBalance'
import { Highlights } from '@/components/dashboard/Highlights'
import { SevenDayStrip } from '@/components/dashboard/SevenDayStrip'

interface DashboardHomeProps {
  onOpenDate: (dateKey: string) => void
}

export function DashboardHome({ onOpenDate }: DashboardHomeProps) {
  const tasksQuery = useTasks()
  const eventsQuery = useEvents()
  const recurringQuery = useRecurring()
  const { timezone } = useSettings()
  const { session } = useAuth()

  const isPending = tasksQuery.isPending || eventsQuery.isPending || recurringQuery.isPending
  const isError = tasksQuery.isError || eventsQuery.isError || recurringQuery.isError

  const views = useMemo(
    () => smartViews(tasksQuery.data ?? [], eventsQuery.data ?? [], timezone),
    [tasksQuery.data, eventsQuery.data, timezone],
  )

  const weekBal = useMemo(
    () => loadBalance(tasksQuery.data ?? [], weekRange(timezone)),
    [tasksQuery.data, timezone],
  )

  const monthBal = useMemo(
    () => loadBalance(tasksQuery.data ?? [], monthRange(timezone)),
    [tasksQuery.data, timezone],
  )

  const viewer = resolveViewer(session)

  const highlightItems = useMemo(
    () => highlights(eventsQuery.data ?? [], recurringQuery.data ?? [], tasksQuery.data ?? [], timezone),
    [eventsQuery.data, recurringQuery.data, tasksQuery.data, timezone],
  )

  const strip = useMemo(
    () => sevenDayTiles(tasksQuery.data ?? [], eventsQuery.data ?? [], timezone),
    [tasksQuery.data, eventsQuery.data, timezone],
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true" aria-label="Loading dashboard">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-alt" />
            <div className="h-11 animate-pulse rounded-control bg-surface-alt" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">Couldn't load the dashboard</p>
        <p className="text-sm text-ink-muted">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col py-2">
      <SevenDayStrip tiles={strip} onOpenDate={onOpenDate} />
      <SmartViews views={views} timezone={timezone} />
      <LoadBalance weekBalance={weekBal} monthBalance={monthBal} viewer={viewer} />
      <Highlights items={highlightItems} />
    </div>
  )
}
