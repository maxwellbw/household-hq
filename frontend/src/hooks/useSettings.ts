import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { Settings } from '@/types/domain'
import type { EditableSettings } from '@/lib/settings'

const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export function useSettings() {
  const { session, authedCall, handleAuthError } = useAuth()

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        return await authedCall<{ settings: Settings }>('settings.list')
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })

  return {
    ...query,
    timezone: query.data?.settings.timezone || DEFAULT_TIMEZONE,
  }
}

interface UpdateSettingsResult {
  settings: Settings
  changed: string[]
  digestTriggerReinstalled: boolean
}

/** Saves only the changed curated-settings fields via `settings.update` (feature 020) —
 *  optimistic merge into the `['settings']` cache (US4 030), revert on failure (the caller,
 *  SettingsView, already surfaces its own field/form error from the rejected promise),
 *  invalidate on settle so the form reflects what actually persisted. */
export function useUpdateSettings() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<EditableSettings>) => {
      try {
        return await authedCall<UpdateSettingsResult>(
          'settings.update',
          payload as Record<string, unknown>,
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] })
      const previous = queryClient.getQueryData<{ settings: Settings }>(['settings'])
      queryClient.setQueryData<{ settings: Settings } | undefined>(['settings'], (old) =>
        old ? { ...old, settings: { ...old.settings, ...payload } as Settings } : old,
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['settings'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}
