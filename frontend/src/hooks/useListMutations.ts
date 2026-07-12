import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { List, ListItem, ListSection } from '@/types/domain'

export function useCreateList() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      try {
        return await authedCall<{ list: List }>('lists.create', { name })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  })
}

/** Deletes a list and cascades to its items server-side (contracts/api-024.md) —
 *  invalidate both queries since we can't know client-side which items were removed. */
export function useDeleteList() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string) => {
      try {
        return await authedCall('lists.delete', { id: listId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['listItems'] })
    },
  })
}

export type CreateListItemPayload = {
  listId: string
  name: string
  section?: ListSection
  staple?: 'TRUE' | 'FALSE'
  note?: string
}

/** Add-by-name (US2) — the server reuses and flips an existing same-name item on the
 *  same list instead of duplicating it (research R3), so this always just invalidates
 *  rather than optimistically inserting (we can't know client-side which case applied). */
export function useCreateListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateListItemPayload) => {
      try {
        return await authedCall<{ item: ListItem }>('listItems.create', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })
}

export type UpdateListItemPayload = {
  id: string
  name?: string
  section?: ListSection
  staple?: 'TRUE' | 'FALSE'
  note?: string
}

export function useUpdateListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateListItemPayload) => {
      try {
        return await authedCall<{ item: ListItem }>('listItems.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })
}

/** One-tap status flip (US1, SC-002) — optimistic flip before the round-trip resolves,
 *  revert on failure (mirrors useSetTaskStatus/useSnoozeTask). */
export function useToggleListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      try {
        return await authedCall<{ item: ListItem; changed: boolean }>('listItems.toggle', { id: itemId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: ['listItems'] })
      const previous = queryClient.getQueryData<ListItem[]>(['listItems'])
      queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? { ...item, status: item.status === 'need' ? 'stocked' : 'need' }
            : item,
        ),
      )
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(['listItems'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })
}

/** Outright removal (distinct from toggling to stocked — FR-006 never deletes on the
 *  routine cycle). */
export function useDeleteListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      try {
        return await authedCall('listItems.delete', { id: itemId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })
}
