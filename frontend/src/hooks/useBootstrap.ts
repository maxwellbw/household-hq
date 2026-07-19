import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import type {
  DogWalk,
  Event,
  List,
  ListItem,
  RecurringEventRule,
  RecurringRule,
  Settings,
  Task,
  TaskTemplate,
} from '@/types/domain'

interface BootstrapData {
  events: Event[]
  tasks: Task[]
  recurring: RecurringRule[]
  recurringEvents: RecurringEventRule[]
  lists: List[]
  listItems: ListItem[]
  templates: TaskTemplate[]
  settings: Settings
  dogWalks: DogWalk[]
}

const BOOTSTRAP_ARRAY_KEYS = [
  'events',
  'tasks',
  'recurring',
  'recurringEvents',
  'lists',
  'listItems',
  'templates',
  'dogWalks',
] as const

// FR-010: a partial/malformed bootstrap payload must not crash the app or silently seed an
// incomplete cache — treat it as a (transient) BAD_RESPONSE so it falls into the same
// retry-then-recoverable-screen path as a network failure, instead of the queryFn returning
// success with holes.
function assertBootstrapPayload(data: unknown): asserts data is BootstrapData {
  const valid =
    !!data &&
    typeof data === 'object' &&
    BOOTSTRAP_ARRAY_KEYS.every((key) => Array.isArray((data as Record<string, unknown>)[key])) &&
    typeof (data as Record<string, unknown>).settings === 'object' &&
    (data as Record<string, unknown>).settings !== null
  if (!valid) {
    throw new ApiError('BAD_RESPONSE', 'Bootstrap response was incomplete or malformed.')
  }
}

/**
 * One cold-load request (feature 030 US1) that seeds every primary-view dataset's query
 * cache via `setQueryData`. Seeded data is stamped fresh under the existing 30s staleTime,
 * so each per-dataset hook (useTasks, useEvents, …) mounts without firing its own fetch —
 * they are left otherwise unchanged. `activity` is deliberately not seeded: it stays a lazy
 * load fired whenever something mounts `useActivity` -- the More -> Feed screen, and
 * (feature 032 US2) the dashboard's Lately strip. Its own query failures are independent
 * of this bootstrap request by design (audit F-09: investigated, not a seeding gap).
 */
export function useBootstrap() {
  const { session, status, authedCall, handleAuthError, reportBootError } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      try {
        const data = await authedCall<BootstrapData>('data.bootstrap')
        assertBootstrapPayload(data)
        queryClient.setQueryData(['events'], data.events)
        queryClient.setQueryData(['tasks'], data.tasks)
        queryClient.setQueryData(['recurring'], data.recurring)
        queryClient.setQueryData(['recurringEvents'], data.recurringEvents)
        queryClient.setQueryData(['lists'], data.lists)
        queryClient.setQueryData(['listItems'], data.listItems)
        queryClient.setQueryData(['templates'], data.templates)
        queryClient.setQueryData(['settings'], { settings: data.settings })
        queryClient.setQueryData(['dogWalks'], data.dogWalks)
        return data
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })

  // Feature 030 US2/FR-010: once the query's own retry budget (queryClient's
  // isTransientError-gated retry, US3) is exhausted, a bootstrap that still can't load after
  // a successful whoami folds into the same recoverable screen as a whoami-transient
  // failure, rather than leaving `status: 'signed-in'` with an unseeded cache.
  useEffect(() => {
    if (query.isError && status === 'signed-in') {
      reportBootError()
    }
  }, [query.isError, status, reportBootError])

  return query
}
