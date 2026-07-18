import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { MAX_QUERY_RETRIES, queryClient } from './queryClient'

function retryPredicate(failureCount: number, err: unknown) {
  const retry = queryClient.getDefaultOptions().queries?.retry
  if (typeof retry !== 'function') throw new Error('expected retry to be a function')
  return retry(failureCount, err as Error)
}

describe('queryClient retry predicate', () => {
  it('retries a transient error up to the bound', () => {
    const err = new ApiError('NETWORK_ERROR', 'offline')
    for (let n = 0; n < MAX_QUERY_RETRIES; n++) {
      expect(retryPredicate(n, err)).toBe(true)
    }
    expect(retryPredicate(MAX_QUERY_RETRIES, err)).toBe(false)
  })

  it('never retries a genuine error', () => {
    for (const code of ['VALIDATION_FAILED', 'FORBIDDEN', 'UNAUTHENTICATED', 'UNKNOWN_ACTION', 'INTERNAL']) {
      expect(retryPredicate(0, new ApiError(code, 'x'))).toBe(false)
    }
  })

  it('backs off exponentially between retries', () => {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay
    if (typeof retryDelay !== 'function') throw new Error('expected retryDelay to be a function')
    const d0 = retryDelay(0, new ApiError('TIMEOUT', 'x'))
    const d1 = retryDelay(1, new ApiError('TIMEOUT', 'x'))
    const d2 = retryDelay(2, new ApiError('TIMEOUT', 'x'))
    expect(d1).toBeGreaterThan(d0)
    expect(d2).toBeGreaterThan(d1)
  })

  it('leaves mutations at the TanStack default of no auto-retry', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBeUndefined()
  })
})
