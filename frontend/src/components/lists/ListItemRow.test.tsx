import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListItemRow } from './ListItemRow'
import type { ListItem } from '@/types/domain'

const toggleMutate = vi.fn()
const updateMutate = vi.fn((_payload: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const createMutate = vi.fn()

vi.mock('@/hooks/useListMutations', () => ({
  useToggleListItem: () => ({ mutate: toggleMutate }),
  useUpdateListItem: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteListItem: () => ({ mutate: deleteMutate, isPending: false }),
  useCreateListItem: () => ({ mutate: createMutate }),
}))

const showToast = vi.fn()
const showUndo = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast, showUndo }),
}))

const item: ListItem = {
  id: 'i1',
  listId: 'l1',
  name: 'Milk',
  status: 'need',
  section: 'dairy',
  staple: 'TRUE',
  note: '2 gallons',
}

describe('ListItemRow', () => {
  it('toggles need/stocked on tap', () => {
    render(<ListItemRow item={item} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Milk stocked' }))
    expect(toggleMutate).toHaveBeenCalledWith('i1')
  })

  describe('delete — undoable, not a blocking confirm (feature 032 US3, contract C3)', () => {
    it('deletes immediately (no confirm step) and shows an Undo toast', () => {
      render(<ListItemRow item={item} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit Milk' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))

      expect(deleteMutate).toHaveBeenCalledWith('i1', expect.anything())
      expect(showUndo).toHaveBeenCalledWith('Deleted — Milk', expect.any(Function), undefined)
      // No "confirm delete" second tap required anywhere.
      expect(screen.queryByRole('button', { name: /Confirm delete/ })).not.toBeInTheDocument()
    })

    it('Undo re-creates the item with its original list/name/section/staple/note', () => {
      render(<ListItemRow item={item} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit Milk' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))

      const onUndo = showUndo.mock.calls.at(-1)?.[1]
      onUndo?.()

      expect(createMutate).toHaveBeenCalledWith({
        listId: 'l1',
        name: 'Milk',
        section: 'dairy',
        staple: 'TRUE',
        note: '2 gallons',
      })
    })
  })
})
