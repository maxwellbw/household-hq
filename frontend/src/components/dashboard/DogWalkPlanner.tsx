import { useRef, useState } from 'react'
import { AlertTriangle, Check, Minus, Plus, X } from 'lucide-react'
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

/** An ineligible hour run only collapses into a compact band once it's at least this long —
 *  a single bad hour isn't worth the extra tap to expand (F-22). */
const MIN_BAND_HOURS = 2

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

/** The `[start, end]` ISO-with-offset pair for a walk of `durationMin` starting `startMin`
 *  minutes into `dateKey` (household-local) — used both for hour taps (top of the hour) and
 *  for a pending booking's steppers-adjusted start (US5, T022). */
function windowIsoFromMinutes(dateKey: string, startMin: number, durationMin: number, timezone: string): { start: string; end: string } {
  const startZdt = toZonedDateTime(`${dateKey}T00:00:00`, timezone).add({ minutes: startMin })
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

/** A booking window the user is one confirm away from submitting (US5). `startMin` is
 *  minutes-of-day, household-local, adjustable ±15 min via the confirm bar's steppers; the
 *  duration picker only applies to `slot: 'primary'` — `second` always books at
 *  `plan.secondDurationMin`, the only duration the backend accepts for that slot. */
interface PendingBooking {
  slot: 'primary' | 'second'
  startMin: number
  durationMin: number
}

/** Client-side mirror of the backend's booking checks (band, busy overlap, hourly weather
 *  gates) — a best-effort pre-check so Confirm can be disabled with a reason before a round
 *  trip, not a replacement for `bookWalkManually_`, which remains authoritative (data-model.md
 *  "Validation rules"). Hours the day plan doesn't cover are treated as passing (no known
 *  failure) rather than blocking, so sparse/partial `hours` data degrades gracefully. */
function validatePendingWindow(
  plan: DogWalkDayPlan,
  startMin: number,
  durationMin: number,
  range: [number, number],
  timezone: string,
): { ok: true } | { ok: false; reason: string } {
  const endMin = startMin + durationMin
  if (startMin < range[0] || endMin > range[1]) {
    return { ok: false, reason: 'Outside the walk-eligible hours' }
  }
  const conflict = plan.busyBlocks.find((b) => {
    const bStart = minutesOfDay(b.start, timezone)
    const bEnd = minutesOfDay(b.end, timezone)
    return bStart < endMin && bEnd > startMin
  })
  if (conflict) {
    return { ok: false, reason: `Conflicts with ${ownerStyle(conflict.owner).label}${conflict.title ? ` (${conflict.title})` : ''}` }
  }
  const failedLabels = new Set<string>()
  plan.hours.forEach((gate) => {
    const gStart = hourKeyMinutes(gate.hour, timezone)
    const gEnd = gStart + 60
    if (gStart < endMin && gEnd > startMin && !gate.passes) {
      gate.failedGates.forEach((g) => failedLabels.add(GATE_LABEL[g]))
    }
  })
  if (failedLabels.size > 0) {
    return { ok: false, reason: `Fails: ${[...failedLabels].join(', ')}` }
  }
  return { ok: true }
}

/** True when every 15-min slot in `hourStartMin`..+60 is covered by a busy block — used to
 *  decide whether a whole hour is worth compressing into a band (F-22), distinct from
 *  `HourGate.passes` (weather-only). */
function isHourFullyBusy(hourStartMin: number, busyBlocks: BusyBlock[], timezone: string): boolean {
  for (let offset = 0; offset < 60; offset += 15) {
    const slotStart = hourStartMin + offset
    const slotEnd = slotStart + 15
    const covered = busyBlocks.some(
      (b) => minutesOfDay(b.start, timezone) <= slotStart && minutesOfDay(b.end, timezone) >= slotEnd,
    )
    if (!covered) return false
  }
  return true
}

type RunMode = 'timeline' | 'band'

interface HourRun {
  startMin: number
  endMin: number
  mode: RunMode
  hours: HourGate[]
}

/**
 * Groups `plan.hours` into contiguous runs (F-22): consecutive ineligible hours (gate-failed
 * or fully busy) become one `'band'` run once there are at least `MIN_BAND_HOURS`, collapsing
 * to a compact expandable row instead of ten screens of scrolling; everything else — including
 * a lone bad hour, not worth collapsing — stays `'timeline'` mode at the normal `PX_PER_MIN`
 * scale. Expanding a band (via `expandedBands`) turns it back into `'timeline'` hours, which
 * then re-merge with neighboring timeline runs so there's no visual seam.
 */
function buildHourRuns(plan: DogWalkDayPlan, timezone: string, expandedBands: Set<number>): HourRun[] {
  const raw: { startMin: number; endMin: number; ineligible: boolean; hours: HourGate[] }[] = []
  for (const hour of plan.hours) {
    const startMin = hourKeyMinutes(hour.hour, timezone)
    const endMin = startMin + 60
    const ineligible = !hour.passes || isHourFullyBusy(startMin, plan.busyBlocks, timezone)
    const last = raw[raw.length - 1]
    if (last && last.ineligible === ineligible) {
      last.endMin = endMin
      last.hours.push(hour)
    } else {
      raw.push({ startMin, endMin, ineligible, hours: [hour] })
    }
  }

  const withMode: HourRun[] = raw.map((g) => ({
    startMin: g.startMin,
    endMin: g.endMin,
    hours: g.hours,
    mode: g.ineligible && g.hours.length >= MIN_BAND_HOURS && !expandedBands.has(g.startMin) ? 'band' : 'timeline',
  }))

  const merged: HourRun[] = []
  for (const run of withMode) {
    const last = merged[merged.length - 1]
    if (last && last.mode === 'timeline' && run.mode === 'timeline') {
      last.endMin = run.endMin
      last.hours.push(...run.hours)
    } else {
      merged.push({ ...run, hours: [...run.hours] })
    }
  }
  return merged
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

function ForecastBanner({ forecast, timezone }: { forecast: DogWalkDayPlan['forecast']; timezone: string }) {
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
    const time = forecast.fetchedAt ? formatTime(forecast.fetchedAt, timezone) : 'an earlier time'
    parts.push(`Cached forecast · from ${time}.${forecast.usableForBooking ? '' : ' Too old to book against.'}`)
  } else {
    const age = forecast.ageMinutes ?? 0
    parts.push(`Live forecast · updated ${age === 0 ? 'just now' : `${age} min ago`}.`)
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
 *  never disagree with the text label when more than one gate fails at once. `selected`
 *  mirrors this hour into the confirm bar's pending window (US5, F-06) via `aria-pressed` so
 *  the selection is announced, not just painted. */
function HourRow({
  hour,
  timezone,
  rangeStart,
  selected,
  onTap,
}: {
  hour: HourGate
  timezone: string
  rangeStart: number
  selected: boolean
  onTap: () => void
}) {
  const startMin = hourKeyMinutes(hour.hour, timezone)
  const reason = hour.failedGates.map((g) => GATE_LABEL[g]).join(', ')
  const label = `${hourKeyLabel(hour.hour, timezone)}, ${hour.tempF != null ? `${hour.tempF}°, ` : ''}${hour.passes ? 'walk-eligible' : reason} — tap to book the primary walk here`
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onTap}
      className={cn(
        'absolute inset-x-0 flex flex-col justify-center gap-0.5 border-t border-border/60 py-0.5 pl-1 pr-1 text-left text-[11px] hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        selected && 'bg-accent-soft ring-1 ring-inset ring-accent',
      )}
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

/** A collapsed run of ineligible hours (F-22): one compact, always-44px-tall row standing in
 *  for hours that would otherwise cost ten screens of scrolling. One-way disclosure — once
 *  expanded it stays expanded (re-collapsing isn't worth the extra control). */
function CollapsedBand({ run, timezone, onExpand }: { run: HourRun; timezone: string; onExpand: () => void }) {
  const first = run.hours[0]
  const last = run.hours[run.hours.length - 1]
  const endLabel = formatTime(formatIsoWithOffset(toZonedDateTime(`${last.hour}:00:00`, timezone).add({ minutes: 60 })), timezone)
  const summary = `${hourKeyLabel(first.hour, timezone)}–${endLabel}, ${run.hours.length} hours unavailable`
  return (
    <button
      type="button"
      aria-label={`${summary} — tap to expand`}
      onClick={onExpand}
      className="flex min-h-[44px] items-center justify-between gap-2 rounded-control border border-dashed border-ink-faint bg-surface-alt px-3 text-left text-xs font-medium text-ink-muted hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span>{summary}</span>
      <span className="shrink-0 text-accent">Expand</span>
    </button>
  )
}

type LaneEntry = { kind: 'busy'; block: BusyBlock } | { kind: 'candidate'; candidate: CandidateWindow }

/** One [startMin, endMin) slice of the timeline at the normal `PX_PER_MIN` scale: the hourly
 *  weather column and the busy/candidate column, scoped to just this slice's items. Reused for
 *  both a `'timeline'`-mode `HourRun` and — with an empty `hours` array — the no-weather
 *  fallback (`plan.hours.length === 0`), so there's exactly one rendering path for "a
 *  contiguous stretch of real time" regardless of whether it's band-compressed elsewhere. */
function TimelineSlice({
  startMin,
  endMin,
  hours,
  plan,
  timezone,
  pendingStartMin,
  onHourTap,
  onCandidateTap,
}: {
  startMin: number
  endMin: number
  hours: HourGate[]
  plan: DogWalkDayPlan
  timezone: string
  pendingStartMin: number | null
  onHourTap: (hour: HourGate) => void
  onCandidateTap: (candidate: CandidateWindow) => void
}) {
  const totalHeight = (endMin - startMin) * PX_PER_MIN
  const candidates = plan.candidates.filter((c) => minutesOfDay(c.start, timezone) < endMin && minutesOfDay(c.end, timezone) > startMin)
  const busyBlocks = plan.busyBlocks.filter((b) => minutesOfDay(b.start, timezone) < endMin && minutesOfDay(b.end, timezone) > startMin)
  const chosenCandidates = candidates.filter((c) => c.chosen)
  const rejectedCandidates = candidates.filter((c) => !c.chosen)

  // Busy blocks and rejected candidates share ONE lane layout: a rejected candidate very
  // commonly overlaps the busy block that caused its rejection, and without a shared layout
  // the two would render in the identical rectangle, hiding one under the other.
  const laneEntries: LaneEntry[] = [
    ...busyBlocks.map((block): LaneEntry => ({ kind: 'busy', block })),
    ...rejectedCandidates.map((candidate): LaneEntry => ({ kind: 'candidate', candidate })),
  ]
  const lanes = layoutLanes(
    laneEntries,
    (e) => minutesOfDay(e.kind === 'busy' ? e.block.start : e.candidate.start, timezone),
    (e) => minutesOfDay(e.kind === 'busy' ? e.block.end : e.candidate.end, timezone),
  )

  return (
    <div className="flex gap-2">
      <div role="list" aria-label="Hourly weather" className="relative w-24 shrink-0" style={{ height: `${totalHeight}px` }}>
        {hours.map((h) => {
          const hStart = hourKeyMinutes(h.hour, timezone)
          const selected = pendingStartMin != null && hStart <= pendingStartMin && pendingStartMin < hStart + 60
          return <HourRow key={h.hour} hour={h} timezone={timezone} rangeStart={startMin} selected={selected} onTap={() => onHourTap(h)} />
        })}
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
              rangeStart={startMin}
              lane={lane}
              lanes={lanes.lanes}
            />
          ) : (
            <RejectedCandidateBand
              key={`candidate-${item.candidate.slot}-${item.candidate.start}-${i}`}
              candidate={item.candidate}
              timezone={timezone}
              rangeStart={startMin}
              lane={lane}
              lanes={lanes.lanes}
              onTap={() => onCandidateTap(item.candidate)}
            />
          ),
        )}
        {chosenCandidates.map((c, i) => (
          <ChosenCandidateBand key={`chosen-${c.slot}-${c.start}-${i}`} candidate={c} timezone={timezone} rangeStart={startMin} />
        ))}
      </div>
    </div>
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
 * The day planner (feature 031 US2/US3, reworked 033 US5): a vertical timeline of the
 * walk-eligible band showing merged busy blocks (owner-colored), per-hour weather with named
 * gate failures, and every candidate window with the chosen one marked. Assembled entirely
 * from `dogwalks.day`'s server-derived response — no gate or window-selection logic is
 * reimplemented here (FR-015). Tapping a rejected candidate or an hour selects a pending
 * booking (F-06) whose confirm bar — pinned to the bottom of this sheet — offers ±15-min start
 * steppers, a duration picker seeded from the household's configured walk lengths, and a
 * "Book backup" action for the second slot (F-07); a gate-failing or busy window the client
 * missed comes back from the backend as `OVERRIDE_REQUIRED` and is shown as a named
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

  const [pendingBook, setPendingBook] = useState<PendingBooking | null>(null)
  const [overrideInfo, setOverrideInfo] = useState<{ input: BookWalkInput; details: OverrideDetails } | null>(null)
  const [unbookTarget, setUnbookTarget] = useState<DogWalk | null>(null)
  const [expandedBands, setExpandedBands] = useState<Set<number>>(new Set())

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
    setPendingBook({ slot: c.slot, startMin: minutesOfDay(c.start, timezone), durationMin: c.durationMin })
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
    setOverrideInfo(null)
    setPendingBook({ slot: 'primary', startMin: hourKeyMinutes(hour.hour, timezone), durationMin })
  }

  const range = plan ? timelineRangeMinutes(plan, timezone) : null
  const hourRuns = plan && plan.hours.length > 0 ? buildHourRuns(plan, timezone, expandedBands) : null

  const pendingWindow = pendingBook ? windowIsoFromMinutes(dateKey, pendingBook.startMin, pendingBook.durationMin, timezone) : null
  const pendingValidation = pendingBook && plan && range ? validatePendingWindow(plan, pendingBook.startMin, pendingBook.durationMin, range, timezone) : null
  const canStepBack = !!(pendingBook && range && pendingBook.startMin - 15 >= range[0])
  const canStepForward = !!(pendingBook && range && pendingBook.startMin + 15 + pendingBook.durationMin <= range[1])
  const durationOptions = plan?.primaryDurationsMin ?? []
  const backupAvailable = !!(pendingBook && pendingBook.slot === 'primary' && plan && typeof plan.secondDurationMin === 'number' && plan.secondDurationMin > 0)
  const backupWindow = backupAvailable && pendingBook && plan ? windowIsoFromMinutes(dateKey, pendingBook.startMin, plan.secondDurationMin, timezone) : null
  const backupValidation =
    backupAvailable && pendingBook && plan && range ? validatePendingWindow(plan, pendingBook.startMin, plan.secondDurationMin, range, timezone) : null

  function stepPendingStart(deltaMin: number) {
    setPendingBook((p) => (p ? { ...p, startMin: p.startMin + deltaMin } : p))
  }

  function setPendingDuration(durationMin: number) {
    setPendingBook((p) => (p ? { ...p, durationMin } : p))
  }

  function confirmPending() {
    if (!pendingBook || !pendingWindow) return
    attemptBook({ date: dateKey, slot: pendingBook.slot, windowStart: pendingWindow.start, windowEnd: pendingWindow.end, durationMin: pendingBook.durationMin })
  }

  function confirmBackup() {
    if (!plan || !backupWindow) return
    attemptBook({ date: dateKey, slot: 'second', windowStart: backupWindow.start, windowEnd: backupWindow.end, durationMin: plan.secondDurationMin })
  }

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
            <ForecastBanner forecast={plan.forecast} timezone={timezone} />

            {!plan.calendarsReadable && (
              <p className="flex items-center gap-2 rounded-control border border-danger px-3 py-2 text-xs text-danger">
                <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
                A source calendar couldn't be read — busy times below may be incomplete, not a fully free day.
              </p>
            )}

            {range ? (
              hourRuns ? (
                <div className="flex flex-col gap-1.5">
                  {hourRuns.map((run) =>
                    run.mode === 'band' ? (
                      <CollapsedBand
                        key={run.startMin}
                        run={run}
                        timezone={timezone}
                        onExpand={() => setExpandedBands((prev) => new Set(prev).add(run.startMin))}
                      />
                    ) : (
                      <TimelineSlice
                        key={run.startMin}
                        startMin={run.startMin}
                        endMin={run.endMin}
                        hours={run.hours}
                        plan={plan}
                        timezone={timezone}
                        pendingStartMin={pendingBook?.startMin ?? null}
                        onHourTap={handleHourTap}
                        onCandidateTap={handleCandidateTap}
                      />
                    ),
                  )}
                </div>
              ) : (
                <TimelineSlice
                  startMin={range[0]}
                  endMin={range[1]}
                  hours={[]}
                  plan={plan}
                  timezone={timezone}
                  pendingStartMin={pendingBook?.startMin ?? null}
                  onHourTap={handleHourTap}
                  onCandidateTap={handleCandidateTap}
                />
              )
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">No calendar or weather data available for this day.</p>
            )}

            {plan.candidates.length === 0 && plan.calendarsReadable && plan.forecast.source !== 'none' && (
              <p className="text-xs text-ink-muted">
                No eligible window today — every walk-eligible hour is either busy or fails a weather gate. Tap an hour above to book anyway.
              </p>
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

        {pendingBook && pendingWindow && (
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-3 flex flex-col gap-2 border-t border-border bg-surface px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {formatTime(pendingWindow.start, timezone)}–{formatTime(pendingWindow.end, timezone)} · {pendingBook.durationMin}m ·{' '}
                {pendingBook.slot === 'primary' ? 'Primary' : 'Backup'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Start 15 minutes earlier"
                  disabled={!canStepBack}
                  onClick={() => stepPendingStart(-15)}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-control border border-border text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Start 15 minutes later"
                  disabled={!canStepForward}
                  onClick={() => stepPendingStart(15)}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-control border border-border text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {pendingBook.slot === 'primary' && durationOptions.length > 0 && (
              <div role="group" aria-label="Walk duration" className="flex gap-1">
                {durationOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={pendingBook.durationMin === d}
                    onClick={() => setPendingDuration(d)}
                    className={cn(
                      'min-h-[36px] flex-1 rounded-control border px-2 text-xs font-medium',
                      pendingBook.durationMin === d
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-border text-ink-muted hover:bg-surface-alt',
                    )}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            )}

            {pendingValidation && !pendingValidation.ok && <p className="text-xs text-warning">{pendingValidation.reason}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingBook(null)}
                className="min-h-[44px] rounded-control px-2 text-xs font-medium text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
              {backupAvailable && (
                <button
                  type="button"
                  onClick={confirmBackup}
                  disabled={bookWalk.isPending || !(backupValidation?.ok ?? false)}
                  className="min-h-[44px] rounded-control border border-accent px-3 text-xs font-medium text-ink hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {bookWalk.isPending ? '…' : 'Book backup'}
                </button>
              )}
              <button
                type="button"
                onClick={confirmPending}
                disabled={bookWalk.isPending || !(pendingValidation?.ok ?? false)}
                className="min-h-[44px] rounded-control bg-accent px-3 text-xs font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              >
                {bookWalk.isPending ? 'Booking…' : 'Book'}
              </button>
            </div>
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
