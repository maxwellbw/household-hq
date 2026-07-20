import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarHome } from './CalendarHome'
import { ALL_OWNERS } from '@/lib/owners'

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useSnoozeTask: () => ({ mutate: vi.fn() }),
  useUnsnoozeTask: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEvent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      who: { identity: 'max', displayName: 'Max', email: 'max@test.com', needsActingPerson: false },
      actingPerson: undefined,
    },
  }),
}))

vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({
    data: [
      {
        id: 'e1',
        title: 'Dentist',
        start: '2026-07-20T14:30',
        end: '2026-07-20T15:30',
        owner: 'jaz',
      },
      {
        id: 'e2',
        title: 'Family dinner',
        start: '2026-07-21T18:00',
        end: '2026-07-21T20:00',
        owner: 'both',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
}))

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    data: [
      { id: 't1', title: 'Confirm appointment', owner: 'jaz', status: 'open', eventId: 'e1', dueDate: '2026-07-18' },
      { id: 't2', title: 'Water the plants', owner: 'max', status: 'open', dueDate: '2026-07-22' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
}))

const mockUseDogWalks = vi.fn(
  (): { data: unknown[]; isPending: boolean; isError: boolean } => ({ data: [], isPending: false, isError: false }),
)
vi.mock('@/hooks/useDogWalks', () => ({ useDogWalks: () => mockUseDogWalks() }))

function renderCalendar(props: Partial<ComponentProps<typeof CalendarHome>> = {}) {
  return render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} onOpenWalkPlanner={vi.fn()} {...props} />)
}

describe('CalendarHome', () => {
  it('renders the Schedule-X calendar with fixture events without crashing', async () => {
    renderCalendar()
    expect(await screen.findByText('Dentist')).toBeInTheDocument()
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()
  })

  it('shows a prep-count indicator on an event with tethered tasks', async () => {
    renderCalendar()
    // t1 is tethered to e1 (Dentist) via eventId — the tether should surface
    // as a "0/1 tasks" done/total badge on the event chip (EventContent).
    expect(await screen.findByText('0/1 tasks')).toBeInTheDocument()
  })

  it('renders a standalone task (no eventId) on its own date, not dropped', async () => {
    renderCalendar()
    expect(await screen.findByText('Water the plants')).toBeInTheDocument()
  })

  it('hides events and standalone tasks whose owner is filtered out', async () => {
    renderCalendar({ visibleOwners: new Set(['both']) })
    // Only e2 (Family dinner, owner "both") should remain visible.
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()
    expect(screen.queryByText('Dentist')).not.toBeInTheDocument()
    expect(screen.queryByText('Water the plants')).not.toBeInTheDocument()
  })

  it('tapping an event chip opens EventDetailSheet (US4, FR-013)', async () => {
    renderCalendar()
    fireEvent.click(await screen.findByText('Dentist'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Dentist')
  })

  it('tapping a standalone task chip opens TaskDetailSheet, not ignored (US4, FR-014 — regression guard for the ignored-task-tap bug)', async () => {
    renderCalendar()
    fireEvent.click(await screen.findByText('Water the plants'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Water the plants')
    // The task detail sheet (not the event sheet) is open — it has an Edit task button.
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
  })

  it('does not tear down and rebuild calendar chips on a re-render with unchanged data (feature 029 US7 — flash regression guard)', async () => {
    // Root cause (pinned live): ScheduleXCalendar's own effect destroys + re-renders the
    // whole calendar whenever its `customComponents` prop gets a new reference — an inline
    // object literal recreated it on every CalendarHome render, even a harmless one. A new
    // but equivalent `visibleOwners` Set is exactly that kind of harmless re-render trigger.
    const { rerender } = renderCalendar()
    const chipBefore = await screen.findByText('Dentist')

    rerender(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} onOpenWalkPlanner={vi.fn()} />)

    const chipAfter = await screen.findByText('Dentist')
    expect(chipAfter).toBe(chipBefore)
  })

  describe('focusDate consume-on-mount (feature 033 T005/T006, F-04 race fix)', () => {
    it('calls onConsumedFocusDate once after mount', async () => {
      const onConsumedFocusDate = vi.fn()
      renderCalendar({ focusDate: '2026-07-21', onConsumedFocusDate })
      await screen.findByText('Family dinner')
      expect(onConsumedFocusDate).toHaveBeenCalledTimes(1)
    })

    it('does not throw or skip consumption when onConsumedFocusDate is omitted', async () => {
      renderCalendar({ focusDate: '2026-07-21' })
      expect(await screen.findByText('Family dinner')).toBeInTheDocument()
    })
  })

  describe('dog-walk items (feature 033 US4, T017/T018/T020)', () => {
    const walkFixtures = [
      {
        id: 'w1',
        date: '2026-07-20',
        slot: 'primary',
        status: 'booked',
        windowStart: '2026-07-20T08:00:00-07:00',
        windowEnd: '2026-07-20T08:30:00-07:00',
        durationMin: 30,
        reason: null,
      },
      {
        id: 'w2',
        date: '2026-07-22',
        slot: 'primary',
        status: 'needs-decision',
        windowStart: null,
        windowEnd: null,
        durationMin: null,
        // null (rather than a mapped reason code) renders the generic "needs a decision"
        // label — keeps this fixture's text unambiguous from the booked chip's plain
        // "Dog walk" span, which also exists on the same grid.
        reason: null,
      },
    ]

    beforeEach(() => {
      mockUseDogWalks.mockReturnValue({ data: walkFixtures, isPending: false, isError: false })
    })

    afterEach(() => {
      mockUseDogWalks.mockReturnValue({ data: [], isPending: false, isError: false })
    })

    it('renders a booked walk chip on the month grid with its time window', async () => {
      renderCalendar()
      expect(await screen.findByText('8:00 AM–8:30 AM')).toBeInTheDocument()
      expect(screen.getAllByText('Dog walk').length).toBeGreaterThan(0)
    })

    // The reason text sits as a sibling text node alongside a nested "Dog walk" span
    // (EventContent's dogwalk-flag markup), so RTL's default text matcher — which only
    // concatenates an element's *direct* text-node children — can't match the combined
    // string via getByText('Dog walk — needs a decision'); a full-textContent predicate
    // finds the unique wrapping span instead.
    function findFlagLabel() {
      return screen.findByText(
        (_, element) => element?.tagName.toLowerCase() === 'span' && element.textContent === 'Dog walk — needs a decision',
      )
    }

    it('renders a needs-decision walk chip with urgent (warning-bordered) styling', async () => {
      renderCalendar()
      const label = await findFlagLabel()
      expect(label.closest('div')).toHaveClass('border-l-warning')
    })

    it('tapping a booked walk chip on the month grid opens the planner for that date, not a detail sheet', async () => {
      const onOpenWalkPlanner = vi.fn()
      renderCalendar({ onOpenWalkPlanner })
      fireEvent.click(await screen.findByText('8:00 AM–8:30 AM'))
      expect(onOpenWalkPlanner).toHaveBeenCalledWith('2026-07-20')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('tapping a needs-decision walk chip opens the planner for that date', async () => {
      const onOpenWalkPlanner = vi.fn()
      renderCalendar({ onOpenWalkPlanner })
      fireEvent.click(await findFlagLabel())
      expect(onOpenWalkPlanner).toHaveBeenCalledWith('2026-07-22')
    })
  })
})
