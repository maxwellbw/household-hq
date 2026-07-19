import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListsView } from './ListsView'
import type { List, ListItem } from '@/types/domain'

const lists: List[] = [{ id: 'l1', name: 'Groceries' }]
const items: ListItem[] = [
  { id: 'i1', listId: 'l1', name: 'Milk', status: 'need', section: 'dairy', staple: 'TRUE', note: '' },
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
