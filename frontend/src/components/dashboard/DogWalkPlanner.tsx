import { useRef, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import { useBookWalk, useDogWalkDay, useReleaseWalk, useUnbookWalk, type BookWalkInput } from '@/hooks/useDogWalks'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { formatDayLabel, formatTime, toZonedDateTime } from '@/lib/datetime'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/shell/ErrorState'
import type { BusyBlock, CandidateWindow, DogWalk, DogWalkDayPlan, HourGate, WeatherGateName } from '@/types/domain'

interface DogWalkPlannerProps {
  dateKey: string
  timezone: string
  onClose: () => void
}

interface OverrideDetails {
  failedGates: WeatherGateName[]
  conflicts: { owner: BusyBlock['owner']; title: string | null; start: string; end: string }[]
}

const PX_PER_MIN = 1.4

const GATE_LABEL: Record<WeatherGateName, string> = {
  heat: 'Too hot',
  cold: 'Too cold',
  precip: 'Rain likely',
  snowIce: 'Snow/ice',
  noForecast: 'No forecast',
}

/** Minutes since midnight, household-local, for a full ISO-with-offset datetime string. */
function minutesOfDay(iso: string, timezone: string): number {
  const zdt = toZonedDateTime(iso, timezone)
  return zdt.hour * 60 + zdt.minute
}

/** Minutes since midnight for a naive `'YYYY-MM-DDTHH'` hour key (already household-local by
 *  construction — no offset conversion needed, but reuses toZonedDateTime for one parse path). */
function hourKeyMinutes(hourKey: string, timezone: string): number {
  return toZonedDateTime(`${hourKey}:00:00`, timezone).hour * 60
}

function hourKeyLabel(hourKey: string, timezone: string): string {
  return formatTime(`${hourKey}:00:00`, timezone)
}

/** `Temporal.ZonedDateTime` -> the backend's `isoWithOffset_` format
 *  (`yyyy-MM-dd'T'HH:mm:ssXXX`) — `.toString()` would append a `[timezone]` suffix the
 *  backend's `parseIsoWithOffset_` regex doesn't accept. */
function formatIsoWithOffset(zdt: ReturnType<typeof toZonedDateTime>): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}T${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}${zdt.offset}`
}

/** The `[start, end]` ISO-with-offset pair for a walk of `durationMin` starting at the top
 *  of `hourKey` (feature 031 US3, T047) — used when proposing a booking at a tapped hour
 *  that has no pre-computed candidate at all (see contracts deviation note on
 *  `primaryDurationsMin`). */
function hourWindowIso(hourKey: string, durationMin: number, timezone: string): { start: string; end: string } {
  const startZdt = toZonedDateTime(`${hourKey}:00:00`, timezone)
  const endZdt = startZdt.add({ minutes: durationMin })
  return { start: formatIsoWithOffset(startZdt), end: formatIsoWithOffset(endZdt) }
}

/** The vertical timeline's [startMin, endMin) — anchored to the walk-eligible hour band
 *  (`hours`) when weather is available, since that's the finder's actual candidate window;
 *  falls back to the extent of busyBlocks/candidates when the forecast is unavailable
 *  (`hours` is then empty per contract), and `null` when there's nothing to anchor to. */
function timelineRangeMinutes(plan: DogWalkDayPlan, timezone: string): [number, number] | null {
  if (plan.hours.length > 0) {
    const first = hourKeyMinutes(plan.hours[0].hour, timezone)
    const last = hourKeyMinutes(plan.hours[plan.hours.length - 1].hour, timezone) + 60
    return [first, last]
  }
  const times = [
    ...plan.busyBlocks.flatMap((b) => [minutesOfDay(b.start, timezone), minutesOfDay(b.end, timezone)]),
    ...plan.candidates.flatMap((c) => [minutesOfDay(c.start, timezone), minutesOfDay(c.end, timezone)]),
  ]
  if (times.length === 0) return null
  return [Math.min(...times), Math.max(...times)]
}

function bandStyle(startMin: number, endMin: number, rangeStart: number) {
  return {
    top: `${(startMin - rangeStart) * PX_PER_MIN}px`,
    height: `${Math.max(endMin - startMin, 12) * PX_PER_MIN}px`,
  }
}

interface LaneItem<T> {
  item: T
  lane: number
}

/**
 * Greedy interval-scheduling column assignment (the same shape a calendar day view uses for
 * overlapping meetings): sorts by start time and places each item in the first lane whose
 * last-placed item has already ended, opening a new lane otherwise. Without this, two
 * concurrently busy blocks would render exactly on top of each other and only the
 * last-painted one would be legible — a common case (Max and Jaz are frequently busy at the
 * same time), not an edge case.
 */
function layoutLanes<T>(items: T[], startOf: (t: T) => number, endOf: (t: T) => number): { items: LaneItem<T>[]; lanes: number } {
  const sorted = items
    .map((item) => ({ item, start: startOf(item), end: endOf(item) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const laneEnds: number[] = []
  const laid: LaneItem<T>[] = sorted.map(({ item, start, end }) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    return { item, lane }
  })

  return { items: laid, lanes: Math.max(laneEnds.length, 1) }
}

function laneStyle(lane: number, lanes: number) {
  return {
    left: `${(lane / lanes) * 100}%`,
    width: `calc(${100 / lanes}% - 3px)`,
  }
}

function ForecastBanner({ forecast }: { forecast: DogWalkDayPlan['forecast'] }) {
  if (forecast.source === 'none') {
    return (
      <p className="flex items-center gap-2 rounded-control border border-danger px-3 py-2 text-xs text-danger">
        <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
        Weather forecast unavailable for this day.
      </p>
    )
  }

  const parts: string[] = []
  if (forecast.source === 'cache') {
    const age = forecast.ageMinutes ?? 0
    const ageLabel = age < 60 ? `${age} min ago` : `${Math.round(age / 60)}h ago`
    parts.push(`Showing cached weather, fetched ${ageLabel}${forecast.usableForBooking ? '' : ' — too old to book against'}.`)
  } else {
    parts.push('Live weather.')
  }
  if (!forecast.reliable) {
    parts.push('This day is beyond the reliable forecast range — weather here is less certain.')
  }

  const isWarning = !forecast.usableForBooking || !forecast.reliable
  return (
    <p
      className={cn(
        'rounded-control border px-3 py-2 text-xs',
        isWarning ? 'border-warning text-ink' : 'border-border text-ink-muted',
      )}
    >
      {parts.join(' ')}
    </p>
  )
}

const OWNER_BAND_BG: Record<BusyBlock['owner'], string> = {
  max: 'bg-owner-max-soft border-owner-max',
  jaz: 'bg-owner-jaz-soft border-owner-jaz',
  both: 'bg-owner-both-soft border-owner-both',
}

const OWNER_DOT_BG: Record<BusyBlock['owner'], string> = {
  max: 'bg-owner-max',
  jaz: 'bg-owner-jaz',
  both: 'bg-owner-both',
}

function busyBlockLabel(block: BusyBlock, timezone: string): string {
  const owner = ownerStyle(block.owner).label
  const time = `${formatTime(block.start, timezone)}–${formatTime(block.end, timezone)}`
  return `Busy: ${owner}, ${time}${block.title ? `, ${block.title}` : ''}`
}

function BusyBand({ block, timezone, rangeStart, lane, lanes }: { block: BusyBlock; timezone: string; rangeStart: number; lane: number; lanes: number }) {
  const style = ownerStyle(block.owner)
  const startMin = minutesOfDay(block.start, timezone)
  const endMin = Math.max(minutesOfDay(block.end, timezone), startMin + 12)
  return (
    <div
      role="listitem"
      aria-label={busyBlockLabel(block, timezone)}
      className={cn(
        'absolute flex items-center gap-1 overflow-hidden rounded-sm border-l-[3px] px-1 text-[11px]',
        OWNER_BAND_BG[block.owner],
      )}
      style={{ ...bandStyle(startMin, endMin, rangeStart), ...laneStyle(lane, lanes) }}
    >
      <span
        className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-surface', OWNER_DOT_BG[block.owner])}
        aria-hidden="true"
      >
        {style.initial}
      </span>
      <span className="truncate text-ink">{block.title ?? 'Busy'}</span>
    </div>
  )
}

function candidateLabel(candidate: CandidateWindow, timezone: string): string {
  const time = `${formatTime(candidate.start, timezone)}–${formatTime(candidate.end, timezone)}`
  const chosen = candidate.chosen ? ', chosen window' : ''
  return `Candidate window: ${time}, ${candidate.durationMin} minutes, ${candidate.slot} slot${chosen}`
}

/** The winning window (FR-011) — the one visual answer this feature exists to produce, so it
 *  renders full-width and unmissable rather than squeezed into a shared lane. Structurally
 *  safe to render outside the busy/candidate lane system: a chosen window is picked from
 *  mutual-*free* time, so it cannot time-overlap a busy block. */
function ChosenCandidateBand({ candidate, timezone, rangeStart }: { candidate: CandidateWindow; timezone: string; rangeStart: number }) {
  const startMin = minutesOfDay(candidate.start, timezone)
  const endMin = Math.max(minutesOfDay(candidate.end, timezone), startMin + 12)
  return (
    <div
      role="listitem"
      aria-label={candidateLabel(candidate, timezone)}
      className="absolute inset-x-0 flex items-center justify-between gap-1 overflow-hidden rounded-sm border-2 border-accent bg-accent-soft px-1.5 text-[11px] font-medium text-ink"
      style={bandStyle(startMin, endMin, rangeStart)}
    >
      <span className="truncate">
        {formatTime(candidate.start, timezone)}–{formatTime(candidate.end, timezone)} ({candidate.durationMin}m, {candidate.slot})
      </span>
      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-surface">
        <Check size={11} aria-hidden="true" /> Chosen
      </span>
    </div>
  )
}

function RejectedCandidateBand({
  candidate,
  timezone,
  rangeStart,
  lane,
  lanes,
  onTap,
}: {
  candidate: CandidateWindow
  timezone: string
  rangeStart: number
  lane: number
  lanes: number
  onTap: () => void
}) {
  const startMin = minutesOfDay(candidate.start, timezone)
  const endMin = Math.max(minutesOfDay(candidate.end, timezone), startMin + 12)
  return (
    // An explicit role="listitem" on the interactive control itself would override its
    // native button semantics (a screen reader would announce "list item", not "button") —
    // the listitem role belongs on this positioning wrapper; the button inside stays a plain
    // native button so its role/actionability are never in question.
    <div role="listitem" className="absolute" style={{ ...bandStyle(startMin, endMin, rangeStart), ...laneStyle(lane, lanes) }}>
      <button
        type="button"
        aria-label={`${candidateLabel(candidate, timezone)} — tap to book`}
        onClick={onTap}
        className="h-full w-full overflow-hidden truncate rounded-sm border border-dashed border-ink-faint px-1 text-left text-[11px] font-medium text-ink-muted hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        {formatTime(candidate.start, timezone)}–{formatTime(candidate.end, timezone)} ({candidate.durationMin}m, {candidate.slot})
      </button>
    </div>
  )
}

/** Stacked two-line layout (time+temp+icon, then the gate-failure reason on its own line) so
 *  a name like "Rain likely" has room to actually be legible in the narrow time column,
 *  rather than being squeezed into one row and overflowing invisibly behind the busy-blocks
 *  column next to it. A single check/no-check icon (never a per-gate icon) so the icon can
 *  never disagree with the text label when more than one gate fails at once. */
function HourRow({ hour, timezone, rangeStart, onTap }: { hour: HourGate; timezone: string; rangeStart: number; onTap: () => void }) {
  const startMin = hourKeyMinutes(hour.hour, timezone)
  const reason = hour.failedGates.map((g) => GATE_LABEL[g]).join(', ')
  const label = `${hourKeyLabel(hour.hour, timezone)}, ${hour.tempF != null ? `${hour.tempF}°, ` : ''}${hour.passes ? 'walk-eligible' : reason} — tap to book the primary walk here`
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTap}
      className="absolute inset-x-0 flex flex-col justify-center gap-0.5 border-t border-border/60 py-0.5 pl-1 pr-1 text-left text-[11px] hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      style={{ top: `${(startMin - rangeStart) * PX_PER_MIN}px`, height: `${60 * PX_PER_MIN}px` }}
    >
      <div className={cn('flex items-center gap-1', hour.passes ? 'text-ink-muted' : 'text-ink')}>
        <span className="tabular-nums">{hourKeyLabel(hour.hour, timezone)}</span>
        {hour.tempF != null && <span className="tabular-nums">{hour.tempF}°</span>}
        {hour.passes ? (
          <Check size={12} aria-hidden="true" className="shrink-0 text-success" />
        ) : (
          <X size={12} aria-hidden="true" className="shrink-0 text-warning" />
        )}
      </div>
      {!hour.passes && <span className="text-[10px] leading-tight text-warning">{reason}</span>}
    </button>
  )
}

const STATUS_LABEL: Record<DogWalk['status'], string> = {
  booked: 'Booked',
  suggested: 'Suggested',
  'needs-decision': 'Needs a decision',
  deferred: 'Deferred',
  skipped: 'Skipped',
}

/**
 * One row per existing ledger entry for the day (T047/T049): status, window, and — when a
 * human decided it — a visibly distinct badge with a one-tap release back to automatic
 * handling (FR-022). Kept as a separate list below the timeline rather than buttons crammed
 * into the compact visual bands, so every action clears the 44px touch-target minimum.
 */
function WalkRow({
  walk,
  timezone,
  onUnbook,
  onRelease,
  isReleasing,
}: {
  walk: DogWalk
  timezone: string
  onUnbook: () => void
  onRelease: () => void
  isReleasing: boolean
}) {
  const time = walk.windowStart && walk.windowEnd ? `${formatTime(walk.windowStart, timezone)}–${formatTime(walk.windowEnd, timezone)}` : null
  return (
    <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-ink">
          {walk.slot === 'primary' ? 'Primary walk' : 'Second walk'} — {STATUS_LABEL[walk.status]}
          {time && ` · ${time}`}
        </span>
        {walk.decidedBy && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-ink">
            Decided by {ownerStyle(walk.decidedBy).label}
          </span>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {walk.decidedBy && (
          <button
            type="button"
            onClick={onRelease}
            disabled={isReleasing}
            className="min-h-[44px] rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {isReleasing ? '…' : 'Auto'}
          </button>
        )}
        {walk.status === 'booked' && (
          <button
            type="button"
            onClick={onUnbook}
            className="min-h-[44px] rounded-control px-2 text-xs font-medium text-danger hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Unbook
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The day planner (feature 031 US2/US3): a vertical timeline of the walk-eligible band
 * showing merged busy blocks (owner-colored), per-hour weather with named gate failures, and
 * every candidate window with the chosen one marked. Assembled entirely from `dogwalks.day`'s
 * server-derived response — no gate or window-selection logic is reimplemented here
 * (FR-015). Tapping a rejected candidate or an hour proposes a manual booking (US3); a
 * gate-failing or busy window comes back as `OVERRIDE_REQUIRED` and is shown as a named
 * confirmation rather than a bare error (FR-021a).
 */
export function DogWalkPlanner({ dateKey, timezone, onClose }: DogWalkPlannerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)
  const { data: plan, isPending, isError, isFetching, refetch } = useDogWalkDay(dateKey)
  const longLabel = formatDayLabel(dateKey, { weekday: 'long', month: 'long', day: 'numeric' })

  const toast = useToast()
  const bookWalk = useBookWalk()
  const unbookWalk = useUnbookWalk()
  const releaseWalk = useReleaseWalk()

  const [pendingBook, setPendingBook] = useState<{ input: BookWalkInput; label: string } | null>(null)
  const [overrideInfo, setOverrideInfo] = useState<{ input: BookWalkInput; details: OverrideDetails } | null>(null)
  const [unbookTarget, setUnbookTarget] = useState<DogWalk | null>(null)

  function attemptBook(input: BookWalkInput) {
    bookWalk.mutate(input, {
      onSuccess: () => {
        setPendingBook(null)
        setOverrideInfo(null)
        toast.show('Walk booked')
      },
      onError: (err) => {
        setPendingBook(null)
        if (err instanceof ApiError && err.code === 'OVERRIDE_REQUIRED') {
          const details = (err.details as OverrideDetails | undefined) ?? { failedGates: [], conflicts: [] }
          setOverrideInfo({ input, details })
        } else {
          setOverrideInfo(null)
          toast.show("Couldn't book — try again")
        }
      },
    })
  }

  function handleCandidateTap(c: CandidateWindow) {
    setOverrideInfo(null)
    setPendingBook({
      input: { date: dateKey, slot: c.slot, windowStart: c.start, windowEnd: c.end, durationMin: c.durationMin },
      label: `${formatTime(c.start, timezone)}–${formatTime(c.end, timezone)} (${c.durationMin}m, ${c.slot})`,
    })
  }

  function handleHourTap(hour: HourGate) {
    if (!plan) return
    // Optional-chained on purpose: a backend too old to send `primaryDurationsMin` used to
    // throw here, and React swallowed it — every hour tap became a silent no-op with the
    // "tap an hour above to book anyway" hint still on screen. Degrade loudly instead.
    const durationMin = plan.primaryDurationsMin?.[0]
    if (durationMin == null) {
      toast.show("Can't book by hour — the server didn't send walk durations")
      return
    }
    const { start, end } = hourWindowIso(hour.hour, durationMin, timezone)
    setOverrideInfo(null)
    setPendingBook({
      input: { date: dateKey, slot: 'primary', windowStart: start, windowEnd: end, durationMin },
      label: `${formatTime(start, timezone)}–${formatTime(end, timezone)} (${durationMin}m, primary)`,
    })
  }

  const range = plan ? timelineRangeMinutes(plan, timezone) : null
  const totalHeight = range ? (range[1] - range[0]) * PX_PER_MIN : 0

  const chosenCandidates = plan?.candidates.filter((c) => c.chosen) ?? []
  const rejectedCandidates = plan?.candidates.filter((c) => !c.chosen) ?? []

  // Busy blocks and rejected candidates share ONE lane layout: a rejected candidate very
  // commonly overlaps the busy block that caused its rejection, and without a shared layout
  // the two would render in the identical rectangle, hiding one under the other.
  type LaneEntry = { kind: 'busy'; block: BusyBlock } | { kind: 'candidate'; candidate: CandidateWindow }
  const laneEntries: LaneEntry[] = [
    ...(plan?.busyBlocks.map((block): LaneEntry => ({ kind: 'busy', block })) ?? []),
    ...rejectedCandidates.map((candidate): LaneEntry => ({ kind: 'candidate', candidate })),
  ]
  const lanes = layoutLanes(
    laneEntries,
    (e) => minutesOfDay(e.kind === 'busy' ? e.block.start : e.candidate.start, timezone),
    (e) => minutesOfDay(e.kind === 'busy' ? e.block.end : e.candidate.end, timezone),
  )

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Dog-walk planner for ${longLabel}`}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">Dog-walk planner</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{longLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isPending && (
          <div className="flex flex-col gap-2 py-6" aria-busy="true" aria-label="Loading day planner">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-alt" />
            <div className="h-40 animate-pulse rounded-control bg-surface-alt" />
          </div>
        )}

        {isError && (
          <ErrorState
            title="Couldn't load the day planner"
            copy="Check your connection and try again."
            onRetry={() => void refetch()}
            busy={isFetching}
          />
        )}

        {plan && (
          <div className="flex flex-col gap-3">
            <ForecastBanner forecast={plan.forecast} />

            {!plan.calendarsReadable && (
              <p className="flex items-center gap-2 rounded-control border border-danger px-3 py-2 text-xs text-danger">
                <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
                A source calendar couldn't be read — busy times below may be incomplete, not a fully free day.
              </p>
            )}

            {range ? (
              <div className="flex gap-2">
                <div role="list" aria-label="Hourly weather" className="relative w-24 shrink-0" style={{ height: `${totalHeight}px` }}>
                  {plan.hours.map((h) => (
                    <HourRow key={h.hour} hour={h} timezone={timezone} rangeStart={range[0]} onTap={() => handleHourTap(h)} />
                  ))}
                </div>
                <div
                  role="list"
                  aria-label="Busy blocks and candidate walk windows"
                  className="relative flex-1 rounded-control border border-border bg-surface-alt"
                  style={{ height: `${totalHeight}px` }}
                >
                  {lanes.items.map(({ item, lane }, i) =>
                    item.kind === 'busy' ? (
                      <BusyBand
                        key={`busy-${item.block.owner}-${item.block.start}-${i}`}
                        block={item.block}
                        timezone={timezone}
                        rangeStart={range[0]}
                        lane={lane}
                        lanes={lanes.lanes}
                      />
                    ) : (
                      <RejectedCandidateBand
                        key={`candidate-${item.candidate.slot}-${item.candidate.start}-${i}`}
                        candidate={item.candidate}
                        timezone={timezone}
                        rangeStart={range[0]}
                        lane={lane}
                        lanes={lanes.lanes}
                        onTap={() => handleCandidateTap(item.candidate)}
                      />
                    ),
                  )}
                  {chosenCandidates.map((c, i) => (
                    <ChosenCandidateBand key={`chosen-${c.slot}-${c.start}-${i}`} candidate={c} timezone={timezone} rangeStart={range[0]} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">No calendar or weather data available for this day.</p>
            )}

            {plan.candidates.length === 0 && plan.calendarsReadable && plan.forecast.source !== 'none' && (
              <p className="text-xs text-ink-muted">
                No eligible window today — every walk-eligible hour is either busy or fails a weather gate. Tap an hour above to book anyway.
              </p>
            )}

            {pendingBook && (
              <div className="flex items-center justify-between gap-2 rounded-control border border-accent bg-accent-soft px-3 py-2">
                <span className="text-sm text-ink">Book {pendingBook.label}?</span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingBook(null)}
                    className="min-h-[44px] rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => attemptBook(pendingBook.input)}
                    disabled={bookWalk.isPending}
                    className="min-h-[44px] rounded-control bg-accent px-3 text-xs font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    {bookWalk.isPending ? 'Booking…' : 'Book'}
                  </button>
                </div>
              </div>
            )}

            {overrideInfo && (
              <div className="flex flex-col gap-2 rounded-control border border-warning px-3 py-2">
                <p className="text-sm text-ink">
                  This window
                  {overrideInfo.details.failedGates.length > 0 && (
                    <> fails: {overrideInfo.details.failedGates.map((g) => GATE_LABEL[g]).join(', ')}</>
                  )}
                  {overrideInfo.details.failedGates.length > 0 && overrideInfo.details.conflicts.length > 0 && ' and'}
                  {overrideInfo.details.conflicts.length > 0 && (
                    <>
                      {' '}
                      conflicts with{' '}
                      {overrideInfo.details.conflicts
                        .map((c) => `${ownerStyle(c.owner).label}${c.title ? ` (${c.title})` : ''}`)
                        .join(', ')}
                    </>
                  )}
                  .
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideInfo(null)}
                    className="min-h-[44px] rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => attemptBook({ ...overrideInfo.input, confirmOverride: true })}
                    disabled={bookWalk.isPending}
                    className="min-h-[44px] rounded-control bg-accent px-3 text-xs font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    {bookWalk.isPending ? 'Booking…' : 'Book anyway'}
                  </button>
                </div>
              </div>
            )}

            {plan.walks.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">This day's walks</h3>
                {plan.walks.map((w) => (
                  <WalkRow
                    key={w.id}
                    walk={w}
                    timezone={timezone}
                    onUnbook={() => setUnbookTarget(w)}
                    onRelease={() =>
                      releaseWalk.mutate(
                        { date: dateKey, slot: w.slot },
                        { onError: () => toast.show("Couldn't return to automatic — try again") },
                      )
                    }
                    isReleasing={releaseWalk.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    {unbookTarget && (
      <ConfirmDialog
        title="Remove this walk?"
        body="This removes the calendar invites for this walk. The finder won't automatically re-book this slot unless you also choose Auto."
        confirmLabel="Unbook"
        isPending={unbookWalk.isPending}
        onConfirm={() =>
          unbookWalk.mutate(
            { date: dateKey, slot: unbookTarget.slot },
            {
              onSuccess: () => setUnbookTarget(null),
              onError: () => {
                setUnbookTarget(null)
                toast.show("Couldn't unbook — try again")
              },
            },
          )
        }
        onClose={() => setUnbookTarget(null)}
      />
    )}
    </>
  )
}
