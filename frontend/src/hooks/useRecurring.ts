import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { RecurringRule } from '@/types/domain'

export function useRecurring() {
  const { session, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      try {
        const { recurring } = await apiCall<{ recurring: RecurringRule[] }>(
          'recurring.list',
          {},
          { token: session!.token },
        )
        return recurring
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

export function useCreateRecurringRule() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<RecurringRule, 'id' | 'lastGenerated'>) => {
      try {
        return await apiCall<{ recurring: RecurringRule }>(
          'recurring.create',
          payload as Record<string, unknown>,
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useUpdateRecurringRule() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RecurringRule> & { id: string }) => {
      try {
        return await apiCall<{ recurring: RecurringRule }>(
          'recurring.update',
          payload as Record<string, unknown>,
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurringRule() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await apiCall<{ id: string }>(
          'recurring.delete',
          { id },
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}
