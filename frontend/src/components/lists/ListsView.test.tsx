import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListsView } from './ListsView'
import type { List, ListItem } from '@/types/domain'

const lists: List[] = [
  { id: 'l1', name: 'Groceries' },
  { id: 'l2', name: 'Not grocery' },
]
const items: ListItem[] = [
  { id: 'i1', listId: 'l1', name: 'Milk', status: 'need', section: 'dairy', staple: 'TRUE', note: '' },
  { id: 'i2', listId: 'l1', name: 'Eggs', status: 'need', section: 'dairy', staple: 'FALSE', note: '' },
  { id: 'i3', listId: 'l1', name: 'Butter', status: 'stocked', section: 'dairy', staple: 'FALSE', note: '' },
  { id: 'i4', listId: 'l2', name: 'Batteries', status: 'stocked', section: '', staple: 'FALSE', note: '' },
]

vi.mock('@/hooks/useLists', () => ({
  useLists: () => ({ data: lists, isPending: false, isError: false, refetch: vi.fn() }),
  useListItems: () => ({ data: items, isPending: false, isError: false, isFetching: false, refetch: vi.fn() }),
}))

vi.mock('@/hooks/useListMutations', () => ({
  useCreateList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateListItem: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
  useToggleListItem: () => ({ mutate: vi.fn() }),
  useUpdateListItem: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteListItem: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

describe('ListsView — staple discoverability (feature 032 US5, FR-021, audit F-15)', () => {
  it('explains what the staple star means, in-product, without opening an item', () => {
    render(<ListsView />)
    expect(screen.getByText(/Staple — stays on the list/)).toBeInTheDocument()
  })
})

describe('ListsView — add affordances (feature 032 US5, FR-021, audit F-15)', () => {
  it('has exactly one add-a-list control and one add-an-item control per context', () => {
    render(<ListsView />)
    expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })
})

describe('ListsView — needed-item pill counts (US8, FR-026)', () => {
  it('shows the needed count on a pill with needed items and hides it at zero', () => {
    render(<ListsView />)
    const groceriesPill = screen.getByRole('button', { name: 'Groceries · 2' })
    expect(groceriesPill).toBeInTheDocument()
    const notGroceryPill = screen.getByRole('button', { name: 'Not grocery' })
    expect(notGroceryPill).toBeInTheDocument()
  })
})

describe('ListsView — All-view arrangement (034 US4)', () => {
  it('shows the Sort A–Z and Group-by-section toggles only in the All view', () => {
    render(<ListsView />)
    // Needed view (default): no arrangement toggles.
    expect(screen.queryByRole('button', { name: 'Sort A–Z' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Group by section' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('button', { name: 'Sort A–Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Group by section' })).toBeInTheDocument()
  })

  it('places stocked items above needed items (unchecked sinks to the bottom)', () => {
    render(<ListsView />)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    const butter = rows.findIndex((t) => t.includes('Butter')) // stocked
    const milk = rows.findIndex((t) => t.includes('Milk')) // needed
    const eggs = rows.findIndex((t) => t.includes('Eggs')) // needed
    expect(butter).toBeLessThan(milk)
    expect(butter).toBeLessThan(eggs)
  })

  it('groups by section (with headings) when the toggle is on', () => {
    render(<ListsView />)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.queryByText('Dairy')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Group by section' }))
    // A Dairy heading appears in each block that has dairy items (stocked Butter + needed Milk/Eggs).
    expect(screen.getAllByText('Dairy').length).toBeGreaterThan(0)
  })
})
