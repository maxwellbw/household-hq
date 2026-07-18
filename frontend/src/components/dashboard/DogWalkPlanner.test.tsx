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

  it('labels cached weather with its age (FR-012)', () => {
    const plan = basePlan({
      forecast: { source: 'cache', fetchedAt: '2026-07-20T00:00:00-07:00', ageMinutes: 480, usableForBooking: true, reliable: true },
    })
    mockUseDogWalkDay.mockReturnValue({ data: plan, isPending: false, isError: false })
    render(<DogWalkPlanner dateKey="2026-07-20" timezone={TZ} onClose={vi.fn()} />)
    expect(screen.getByText(/cached weather/i)).toBeInTheDocument()
    expect(screen.getByText(/8h ago/)).toBeInTheDocument()
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
    expect(screen.getByText("Book 11:30 AM–12:00 PM (30m, primary)?")).toBeInTheDocument()

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
})
