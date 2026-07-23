import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DogWalkPlanner } from './DogWalkPlanner'
import { ApiError } from '@/lib/api'
import type { DogWalkDayPlan } from '@/types/domain'

const mockUseDogWalkDay = vi.fn()
const bookMutate = vi.fn()
const unbookMutate = vi.fn()
const releaseMutate = vi.fn()
const toastShow = vi.fn()

vi.mock('@/hooks/useDogWalks', () => ({
  useDogWalkDay: (date: string | null) => mockUseDogWalkDay(date),
  useBookWalk: () => ({ mutate: bookMutate, isPending: false }),
  useUnbookWalk: () => ({ mutate: unbookMutate, isPending: false }),
  useReleaseWalk: () => ({ mutate: releaseMutate, isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: toastShow }),
}))

const TZ = 'America/Los_Angeles'

function basePlan(overrides: Partial<DogWalkDayPlan> = {}): DogWalkDayPlan {
  return {
    date: '2026-07-20',
    forecast: { source: 'live', fetchedAt: '2026-07-20T06:00:00-07:00', ageMinutes: 0, usableForBooking: true, reliable: true },
    calendarsReadable: true,
    busyBlocks: [],
    hours: [
      { hour: '2026-07-20T08', tempF: 66, precipProbPct: 5, wmoCode: 1, passes: true, failedGates: [] },
      { hour: '2026-07-20T13', tempF: 88, precipProbPct: 5, wmoCode: 1, passes: false, failedGates: ['heat'] },
    ],
    candidates: [
      { start: '2026-07-20T10:30:00-07:00', end: '2026-07-20T11:30:00-07:00', durationMin: 60, chosen: true, slot: 'primary' },
      { start: '2026-07-20T11:30:00-07:00', end: '2026-07-20T12:00:00-07:00', durationMin: 30, chosen: false, slot: 'primary' },
    ],
    walks: [],
    primaryDurationsMin: [60, 45, 30],
    secondDurationMin: 30,
    ...overrides,
  }
}

beforeEach(() => {
  bookMutate.mockReset()
  unbookMutate.mockReset()
  releaseMutate.mockReset()
  toastShow.mockReset()
})

describe('DogWalkPlanner', () => {
  it('names the failed gate for a failing hour (FR-010)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText('Too hot')).toBeInTheDocument()
  })

  it('visibly distinguishes the chosen candidate window (FR-011)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText('Chosen')).toBeInTheDocument()
  })

  it('labels cached weather with a plain-language freshness timestamp (FR-012, F-21)', () => {
    const plan = basePlan({
      forecast: { source: 'cache', fetchedAt: '2026-07-20T00:00:00-07:00', ageMinutes: 480, usableForBooking: true, reliable: true },
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/Cached forecast · from 12:00 AM/)).toBeInTheDocument()
  })

  it('flags a stale cache as too old to book against (F-21)', () => {
    const plan = basePlan({
      forecast: { source: 'cache', fetchedAt: '2026-07-19T08:00:00-07:00', ageMinutes: 1500, usableForBooking: false, reliable: true },
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/Cached forecast · from 8:00 AM\. Too old to book against\./)).toBeInTheDocument()
  })

  it('reads live weather as human copy with freshness (F-21)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/Live forecast · updated just now\./)).toBeInTheDocument()
  })

  it('reads a stale-but-live forecast age in minutes (F-21)', () => {
    const plan = basePlan({
      forecast: { source: 'live', fetchedAt: '2026-07-20T06:00:00-07:00', ageMinutes: 12, usableForBooking: true, reliable: true },
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/Live forecast · updated 12 min ago\./)).toBeInTheDocument()
  })

  it('marks a day beyond the reliable horizon (FR-013)', () => {
    const plan = basePlan({
      forecast: { source: 'live', fetchedAt: '2026-08-01T06:00:00-07:00', ageMinutes: 0, usableForBooking: true, reliable: false },
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-08-01" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/beyond the reliable forecast range/i)).toBeInTheDocument()
  })

  it('warns when a source calendar is unreadable, rather than rendering a free day (FR-014)', () => {
    const plan = basePlan({ calendarsReadable: false, busyBlocks: [] })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/couldn't be read/i)).toBeInTheDocument()
  })

  it('shows a loading state while the day plan is in flight', () => {
    mockUseDogWalkDay.mockReturnValue({ data: undefined, isPending: true, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Loading day planner')).toBeInTheDocument()
  })

  it('confirms then books a rejected candidate window the finder did not choose (US3 scenario 1)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Candidate window: 11:30 AM.*tap to book/i }))
    expect(screen.getByText('11:30 AM–12:00 PM · 30m · Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Book' }))
    expect(bookMutate).toHaveBeenCalledWith(
      { date: '2026-07-20', slot: 'primary', windowStart: '2026-07-20T11:30:00-07:00', windowEnd: '2026-07-20T12:00:00-07:00', durationMin: 30 },
      expect.any(Object),
    )
  })

  it('names the failed gate on OVERRIDE_REQUIRED, then books anyway on explicit confirmation (FR-021a)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Candidate window: 11:30 AM.*tap to book/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Book' }))

    const [, options] = bookMutate.mock.calls[0] as [unknown, { onError: (err: unknown) => void }]
    act(() => {
      options.onError(new ApiError('OVERRIDE_REQUIRED', 'Window fails a check.', undefined, { failedGates: ['heat'], conflicts: [] }))
    })

    expect(screen.getByText(/fails: Too hot/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Book anyway' }))
    expect(bookMutate).toHaveBeenLastCalledWith(expect.objectContaining({ confirmOverride: true }), expect.any(Object))
  })

  it('shows a decidedBy badge and returns a user-decided walk to automatic handling (FR-022)', () => {
    const plan = basePlan({
      walks: [
        {
          id: 'w1', date: '2026-07-20', slot: 'primary', status: 'booked',
          windowStart: '2026-07-20T10:30:00-07:00', windowEnd: '2026-07-20T11:30:00-07:00',
          durationMin: 60, reason: null, decidedBy: 'max',
        },
      ],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    expect(screen.getByText('Decided by Max')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Auto' }))
    expect(releaseMutate).toHaveBeenCalledWith({ date: '2026-07-20', slot: 'primary' }, expect.any(Object))
  })

  it('confirms before unbooking a booked walk', () => {
    const plan = basePlan({
      walks: [
        {
          id: 'w1', date: '2026-07-20', slot: 'primary', status: 'booked',
          windowStart: '2026-07-20T10:30:00-07:00', windowEnd: '2026-07-20T11:30:00-07:00',
          durationMin: 60, reason: null, decidedBy: null,
        },
      ],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Unbook' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove this walk?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unbook' }))

    expect(unbookMutate).toHaveBeenCalledWith({ date: '2026-07-20', slot: 'primary' }, expect.any(Object))
  })
  // Regression (031 follow-up): the deployed backend briefly omitted `primaryDurationsMin`,
  // so `plan.primaryDurationsMin.length` threw inside the click handler. React swallowed the
  // TypeError, leaving every hour tap a silent no-op while the UI still invited the user to
  // "tap an hour above to book anyway". Both halves are pinned below.
  it('opens the booking confirmation when an hour is tapped (FR-021a)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))

    expect(screen.getByText('8:00 AM–9:00 AM · 60m · Primary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book' })).not.toBeDisabled()
  })

  it('surfaces a toast instead of dying silently when the plan carries no durations', () => {
    const plan = basePlan()
    delete (plan as Partial<DogWalkDayPlan>).primaryDurationsMin
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))

    expect(toastShow).toHaveBeenCalledWith("Can't book by hour — the server didn't send walk durations")
    expect(screen.queryByRole('button', { name: 'Book' })).not.toBeInTheDocument()
  })

  // --- US5 (T021-T026): selection state, sticky confirm, steppers, duration, backup, ---
  // --- compressed timeline, status copy. ---

  it('shows the tapped hour as selected via aria-pressed (F-06)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    const hourButton = screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ })
    expect(hourButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(hourButton)
    expect(hourButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the confirm bar reachable without scrolling once a selection exists (F-06)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))

    const confirmBar = screen.getByRole('button', { name: 'Book' }).closest('div.sticky')
    expect(confirmBar).not.toBeNull()
    expect(confirmBar).toHaveClass('bottom-0')
  })

  it('adjusts the start in 15-minute steps within the eligible band (F-07)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))
    expect(screen.getByText('8:00 AM–9:00 AM · 60m · Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start 15 minutes later' }))
    expect(screen.getByText('8:15 AM–9:15 AM · 60m · Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start 15 minutes later' }))
    expect(screen.getByText('8:30 AM–9:30 AM · 60m · Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start 15 minutes earlier' }))
    expect(screen.getByText('8:15 AM–9:15 AM · 60m · Primary')).toBeInTheDocument()
  })

  it('disables the earlier stepper at the start of the eligible band (F-07 edge case)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))
    expect(screen.getByRole('button', { name: 'Start 15 minutes earlier' })).toBeDisabled()
  })

  it('disables the later stepper once the window would run past the band end', () => {
    const plan = basePlan({
      hours: [{ hour: '2026-07-20T16', tempF: 70, precipProbPct: 5, wmoCode: 1, passes: true, failedGates: [] }],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /4:00 PM.*tap to book the primary walk here/ }))
    expect(screen.getByRole('button', { name: 'Start 15 minutes later' })).toBeDisabled()
  })

  // US1 (feature 034): a busy conflict is *overridable*, not a hard block — Book stays enabled,
  // shows the reason, and routes through the backend's OVERRIDE_REQUIRED → "Book anyway" flow.
  it('keeps Book (and Book backup) enabled on a conflict and books anyway on confirmation (US1, FR-001)', () => {
    const plan = basePlan({
      busyBlocks: [{ start: '2026-07-20T08:00:00-07:00', end: '2026-07-20T08:30:00-07:00', owner: 'max', title: 'Standup' }],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))

    expect(screen.getByText(/Conflicts with Max \(Standup\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Book backup' })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Book' }))
    const [, options] = bookMutate.mock.calls[0] as [unknown, { onError: (err: unknown) => void }]
    act(() => {
      options.onError(
        new ApiError('OVERRIDE_REQUIRED', 'Window fails a check.', undefined, {
          failedGates: [],
          conflicts: [{ owner: 'max', title: 'Standup', start: '2026-07-20T08:00:00-07:00', end: '2026-07-20T08:30:00-07:00' }],
        }),
      )
    })
    expect(screen.getByText(/conflicts with Max \(Standup\)/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Book anyway' }))
    expect(bookMutate).toHaveBeenLastCalledWith(expect.objectContaining({ confirmOverride: true }), expect.any(Object))
  })

  // US1: the one genuinely non-overridable case — a window outside the walk-eligible band
  // (mirrors the backend's non-overridable BAD_REQUEST) keeps Book disabled.
  it('keeps Book disabled only for an out-of-band window (US1, FR-005)', () => {
    const plan = basePlan({
      hours: [{ hour: '2026-07-20T08', tempF: 66, precipProbPct: 5, wmoCode: 1, passes: true, failedGates: [] }],
      // A primary candidate whose 60-min window (8:30–9:30) runs past the single-hour band end (9:00).
      candidates: [{ start: '2026-07-20T08:30:00-07:00', end: '2026-07-20T09:30:00-07:00', durationMin: 60, chosen: false, slot: 'primary' }],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Candidate window: 8:30 AM.*tap to book/i }))

    expect(screen.getByText(/Outside the walk-eligible hours/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled()
  })

  it('offers a duration control seeded from primaryDurationsMin and rebuilds the window on change (F-07)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))
    const durationGroup = screen.getByRole('group', { name: 'Walk duration' })
    expect(within(durationGroup).getByRole('button', { name: '60m' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(durationGroup).getByRole('button', { name: '30m' })).toBeInTheDocument()

    fireEvent.click(within(durationGroup).getByRole('button', { name: '30m' }))
    expect(screen.getByText('8:00 AM–8:30 AM · 30m · Primary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Book' }))
    expect(bookMutate).toHaveBeenCalledWith(
      { date: '2026-07-20', slot: 'primary', windowStart: '2026-07-20T08:00:00-07:00', windowEnd: '2026-07-20T08:30:00-07:00', durationMin: 30 },
      expect.any(Object),
    )
  })

  it('books the backup (second) slot at the selected time via "Book backup" (F-07, FR-016)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /8:00 AM.*tap to book the primary walk here/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Book backup' }))

    expect(bookMutate).toHaveBeenCalledWith(
      { date: '2026-07-20', slot: 'second', windowStart: '2026-07-20T08:00:00-07:00', windowEnd: '2026-07-20T08:30:00-07:00', durationMin: 30 },
      expect.any(Object),
    )
  })

  it('does not offer "Book backup" once a backup-slot candidate is already selected', () => {
    const plan = basePlan({
      candidates: [{ start: '2026-07-20T08:00:00-07:00', end: '2026-07-20T08:30:00-07:00', durationMin: 30, chosen: false, slot: 'second' }],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Candidate window: 8:00 AM.*tap to book/i }))
    expect(screen.getByText('8:00 AM–8:30 AM · 30m · Backup')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book backup' })).not.toBeInTheDocument()
  })

  it('compresses a stretch of ineligible hours into an expandable band (F-22)', () => {
    const plan = basePlan({
      hours: [
        { hour: '2026-07-20T08', tempF: 66, precipProbPct: 5, wmoCode: 1, passes: true, failedGates: [] },
        { hour: '2026-07-20T09', tempF: 90, precipProbPct: 5, wmoCode: 1, passes: false, failedGates: ['heat'] },
        { hour: '2026-07-20T10', tempF: 91, precipProbPct: 5, wmoCode: 1, passes: false, failedGates: ['heat'] },
        { hour: '2026-07-20T11', tempF: 92, precipProbPct: 5, wmoCode: 1, passes: false, failedGates: ['heat'] },
        { hour: '2026-07-20T12', tempF: 70, precipProbPct: 5, wmoCode: 1, passes: true, failedGates: [] },
      ],
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /10:00 AM.*tap to book the primary walk here/ })).not.toBeInTheDocument()
    const band = screen.getByRole('button', { name: /3 hours unavailable.*tap to expand/i })
    expect(band).toBeInTheDocument()

    fireEvent.click(band)
    expect(screen.queryByRole('button', { name: /3 hours unavailable.*tap to expand/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10:00 AM.*tap to book the primary walk here/ })).toBeInTheDocument()
  })

  it('does not collapse a single ineligible hour (F-22)', () => {
    mockUseDogWalkDay.mockReturnValue({ data: basePlan(), isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: /1:00 PM.*tap to book the primary walk here/ })).toBeInTheDocument()
    expect(screen.queryByText(/hours unavailable/i)).not.toBeInTheDocument()
  })
})
