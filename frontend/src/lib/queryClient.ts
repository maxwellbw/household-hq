import { QueryClient } from '@tanstack/react-query'
import { isTransientError } from './api'

// Feature 030 US3: reads retry a bounded number of times, but only on a transient error
// (network/timeout/malformed response) — a genuine error (validation, forbidden, etc.) is
// surfaced immediately rather than wasting the retry budget (FR-012/014). Mutations keep
// TanStack's default `retry: 0` — writes are never auto-retried (FR-013); recovery is the
// optimistic-revert path instead.
export const MAX_QUERY_RETRIES = 3

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => failureCount < MAX_QUERY_RETRIES && isTransientError(err),
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    },
  },
})
