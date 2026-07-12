import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { List, ListItem } from '@/types/domain'

export function useLists() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      try {
        const { lists } = await authedCall<{ lists: List[] }>('lists.list')
        return lists
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

/** All list items, unfiltered (research R5) — cheap enough (tens-to-low-hundreds of
 *  rows) to fetch once and reuse for both the Lists screen and the Home dashboard's
 *  staple-nudge count, rather than a per-list fetch. */
export function useListItems() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['listItems'],
    queryFn: async () => {
      try {
        const { items } = await authedCall<{ items: ListItem[] }>('listItems.list')
        return items
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
