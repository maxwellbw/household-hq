import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { List, ListItem, ListSection } from '@/types/domain'

const SAVE_ERROR_MESSAGE = "Couldn't save — try again"

/** Optimistic create (US4 030, mirrors useCreateEvent's client-minted-id pattern, R2/R6) —
 *  the optimistic row *is* the real row; backend id-replay makes retries duplicate-proof. */
export function useCreateList() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      try {
        return await authedCall<{ list: List }>('lists.create', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] })
      const previous = queryClient.getQueryData<List[]>(['lists'])
      const optimistic: List = { id: payload.id, name: payload.name }
      queryClient.setQueryData<List[] | undefined>(['lists'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['lists'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  })

  return {
    ...mutation,
    mutate: (name: string, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ id: crypto.randomUUID(), name }, options),
    mutateAsync: (name: string) => mutation.mutateAsync({ id: crypto.randomUUID(), name }),
  }
}

/** Deletes a list and cascades to its items server-side (contracts/api-024.md) — optimistic
 *  removal of the list plus every item that belonged to it (US4 030), revert both on failure. */
export function useDeleteList() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (listId: string) => {
      try {
        return await authedCall('lists.delete', { id: listId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (listId: string) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] })
      await queryClient.cancelQueries({ queryKey: ['listItems'] })
      const previousLists = queryClient.getQueryData<List[]>(['lists'])
      const previousItems = queryClient.getQueryData<ListItem[]>(['listItems'])
      queryClient.setQueryData<List[] | undefined>(['lists'], (old) => old?.filter((l) => l.id !== listId))
      queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) => old?.filter((item) => item.listId !== listId))
      return { previousLists, previousItems }
    },
    onError: (_err, _listId, context) => {
      if (context?.previousLists) queryClient.setQueryData(['lists'], context.previousLists)
      if (context?.previousItems) queryClient.setQueryData(['listItems'], context.previousItems)
      toast.show(SAVE_ERROR_MESSAGE)
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
 *  same list instead of duplicating it (research R3). Optimistically (US4 030) we replicate
 *  that same name-match check against the cache: if a match exists, flip it to 'need' in
 *  place (no duplicate row); otherwise insert a new client-minted-id row that becomes the
 *  real row on success (same id-replay pattern as useCreateEvent). */
export function useCreateListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (payload: CreateListItemPayload & { id: string }) => {
      try {
        return await authedCall<{ item: ListItem }>('listItems.create', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['listItems'] })
      const previous = queryClient.getQueryData<ListItem[]>(['listItems'])
      const nameLower = payload.name.trim().toLowerCase()
      const existing = previous?.find(
        (item) => item.listId === payload.listId && item.name.trim().toLowerCase() === nameLower,
      )
      if (existing) {
        queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) =>
          old?.map((item) => (item.id === existing.id ? { ...item, status: 'need' } : item)),
        )
      } else {
        const optimistic: ListItem = {
          id: payload.id,
          listId: payload.listId,
          name: payload.name,
          status: 'need',
          section: payload.section ?? '',
          staple: payload.staple ?? 'FALSE',
          note: payload.note,
        }
        queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) => (old ? [...old, optimistic] : [optimistic]))
      }
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['listItems'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })

  return {
    ...mutation,
    mutate: (payload: CreateListItemPayload, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...payload, id: crypto.randomUUID() }, options),
    mutateAsync: (payload: CreateListItemPayload) => mutation.mutateAsync({ ...payload, id: crypto.randomUUID() }),
  }
}

export type UpdateListItemPayload = {
  id: string
  name?: string
  section?: ListSection
  staple?: 'TRUE' | 'FALSE'
  note?: string
}

/** Optimistic patch (US4 030), revert + toast on failure, invalidate on settle. */
export function useUpdateListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: UpdateListItemPayload) => {
      try {
        return await authedCall<{ item: ListItem }>('listItems.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['listItems'] })
      const previous = queryClient.getQueryData<ListItem[]>(['listItems'])
      queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) =>
        old?.map((item) => (item.id === payload.id ? { ...item, ...payload } : item)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['listItems'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
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
 *  routine cycle). Optimistic removal (US4 030), revert + toast on failure. */
export function useDeleteListItem() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (itemId: string) => {
      try {
        return await authedCall('listItems.delete', { id: itemId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: ['listItems'] })
      const previous = queryClient.getQueryData<ListItem[]>(['listItems'])
      queryClient.setQueryData<ListItem[] | undefined>(['listItems'], (old) => old?.filter((item) => item.id !== itemId))
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(['listItems'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listItems'] }),
  })
}
