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

/** Saves only the changed curated-settings fields via `settings.update` (feature 020) and
 *  refreshes the `['settings']` query so the form reflects what actually persisted. */
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}
