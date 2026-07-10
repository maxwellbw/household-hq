import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { TaskTemplate } from '@/types/domain'

export function useTemplates() {
  const { session, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      try {
        const { templates } = await apiCall<{ templates: TaskTemplate[] }>(
          'templates.list',
          {},
          { token: session!.token },
        )
        return templates
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

export function useCreateTemplate() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<TaskTemplate, 'id'>) => {
      try {
        return await apiCall<{ template: TaskTemplate }>(
          'templates.create',
          payload as Record<string, unknown>,
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}

export function useUpdateTemplate() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<TaskTemplate> & { id: string }) => {
      try {
        return await apiCall<{ template: TaskTemplate }>(
          'templates.update',
          payload as Record<string, unknown>,
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}

export function useDeleteTemplate() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await apiCall<{ id: string }>(
          'templates.delete',
          { id },
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}
