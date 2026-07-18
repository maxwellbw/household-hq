import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { RecurringEventRule } from '@/types/domain'

const SAVE_ERROR_MESSAGE = "Couldn't save — try again"

export function useRecurringEvents() {
  const { session, authedCall, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['recurringEvents'],
    queryFn: async () => {
      try {
        const { recurringEvents } = await authedCall<{ recurringEvents: RecurringEventRule[] }>('recurringEvents.list')
        return recurringEvents
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

/** Optimistic create (US4 030, client-minted id — same id-replay pattern as useCreateEvent). */
export function useCreateRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (payload: Omit<RecurringEventRule, 'id' | 'lastGenerated'> & { id: string }) => {
      try {
        return await authedCall<{ recurringEvent: RecurringEventRule }>('recurringEvents.create', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['recurringEvents'] })
      const previous = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      const optimistic: RecurringEventRule = { ...payload, lastGenerated: '' }
      queryClient.setQueryData<RecurringEventRule[] | undefined>(['recurringEvents'], (old) =>
        old ? [...old, optimistic] : [optimistic],
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['recurringEvents'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringEvents'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  return {
    ...mutation,
    mutate: (
      payload: Omit<RecurringEventRule, 'id' | 'lastGenerated'>,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => mutation.mutate({ ...payload, id: crypto.randomUUID() }, options),
    mutateAsync: (payload: Omit<RecurringEventRule, 'id' | 'lastGenerated'>) =>
      mutation.mutateAsync({ ...payload, id: crypto.randomUUID() }),
  }
}

/** Optimistic patch (US4 030), revert + toast on failure, invalidate on settle. */
export function useUpdateRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: Partial<RecurringEventRule> & { id: string }) => {
      try {
        return await authedCall<{ recurringEvent: RecurringEventRule }>('recurringEvents.update', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['recurringEvents'] })
      const previous = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      queryClient.setQueryData<RecurringEventRule[] | undefined>(['recurringEvents'], (old) =>
        old?.map((r) => (r.id === payload.id ? { ...r, ...payload } : r)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['recurringEvents'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recurringEvents'] }),
  })
}

/** Optimistic removal (US4 030), revert + toast on failure. */
export function useDeleteRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await authedCall<{ id: string }>('recurringEvents.delete', { id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['recurringEvents'] })
      const previous = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      queryClient.setQueryData<RecurringEventRule[] | undefined>(['recurringEvents'], (old) => old?.filter((r) => r.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['recurringEvents'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['recurringEvents'] }),
  })
}
