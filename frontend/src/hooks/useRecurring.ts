import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { RecurringRule } from '@/types/domain'

const SAVE_ERROR_MESSAGE = "Couldn't save — try again"

export function useRecurring() {
  const { session, authedCall, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      try {
        const { recurring } = await authedCall<{ recurring: RecurringRule[] }>('recurring.list')
        return recurring
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

/** Optimistic create (US4 030, client-minted id — same id-replay pattern as useCreateEvent). */
export function useCreateRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (payload: Omit<RecurringRule, 'id' | 'lastGenerated'> & { id: string }) => {
      try {
        return await authedCall<{ recurring: RecurringRule }>('recurring.create', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['recurring'] })
      const previous = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      const optimistic: RecurringRule = { ...payload, lastGenerated: '' }
      queryClient.setQueryData<RecurringRule[] | undefined>(['recurring'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['recurring'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })

  return {
    ...mutation,
    mutate: (
      payload: Omit<RecurringRule, 'id' | 'lastGenerated'>,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => mutation.mutate({ ...payload, id: crypto.randomUUID() }, options),
    mutateAsync: (payload: Omit<RecurringRule, 'id' | 'lastGenerated'>) =>
      mutation.mutateAsync({ ...payload, id: crypto.randomUUID() }),
  }
}

/** Optimistic patch (US4 030), revert + toast on failure, invalidate on settle. */
export function useUpdateRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: Partial<RecurringRule> & { id: string }) => {
      try {
        return await authedCall<{ recurring: RecurringRule }>('recurring.update', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['recurring'] })
      const previous = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      queryClient.setQueryData<RecurringRule[] | undefined>(['recurring'], (old) =>
        old?.map((r) => (r.id === payload.id ? { ...r, ...payload } : r)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['recurring'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

/** Optimistic removal (US4 030), revert + toast on failure. */
export function useDeleteRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await authedCall<{ id: string }>('recurring.delete', { id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['recurring'] })
      const previous = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      queryClient.setQueryData<RecurringRule[] | undefined>(['recurring'], (old) => old?.filter((r) => r.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['recurring'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}
