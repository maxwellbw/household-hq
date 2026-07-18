import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiCall, isTransientError } from './api'

function mockFetchOnce(response: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      json: async () => response,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('apiCall', () => {
  it('returns data on ok:true', async () => {
    mockFetchOnce({ ok: true, data: { events: [] } })
    const data = await apiCall<{ events: unknown[] }>('events.list', {}, { token: 't' })
    expect(data).toEqual({ events: [] })
  })

  it('throws a typed ApiError on ok:false', async () => {
    mockFetchOnce({ ok: false, error: { code: 'FORBIDDEN', message: 'Not authorized.' } })
    await expect(apiCall('events.list', {}, { token: 't' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'FORBIDDEN',
      message: 'Not authorized.',
    })
  })

  it('throws ApiError with a field when the error carries one', async () => {
    mockFetchOnce({ ok: false, error: { code: 'VALIDATION', message: 'Bad title', field: 'title' } })
    try {
      await apiCall('tasks.create', { title: '' }, { token: 't' })
      throw new Error('expected apiCall to reject')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).field).toBe('title')
    }
  })

  it('throws a network ApiError when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline')),
    )
    await expect(apiCall('events.list', {}, { token: 't' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
    })
  })

  it('throws a parse ApiError when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('not json')
        },
      }),
    )
    await expect(apiCall('events.list', {}, { token: 't' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'BAD_RESPONSE',
    })
  })

  it('attaches actingPerson to the payload for shared-account writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiCall('tasks.create', { title: 'Buy milk' }, { token: 't', actingPerson: 'jaz' })

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sentBody.payload.actingPerson).toBe('jaz')
  })

  it('aborts a stalled fetch at the timeout and throws a retryable TIMEOUT error', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const pending = apiCall('events.list', {}, { token: 't' })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'ApiError', code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})

describe('isTransientError', () => {
  it('is true for transient codes (network, timeout, malformed response)', () => {
    for (const code of ['NETWORK_ERROR', 'TIMEOUT', 'BAD_RESPONSE']) {
      expect(isTransientError(new ApiError(code, 'x'))).toBe(true)
    }
  })

  it('is false for genuine error codes', () => {
    for (const code of ['VALIDATION_FAILED', 'FORBIDDEN', 'UNAUTHENTICATED', 'UNKNOWN_ACTION', 'INTERNAL']) {
      expect(isTransientError(new ApiError(code, 'x'))).toBe(false)
    }
  })

  it('is false for non-ApiError values', () => {
    expect(isTransientError(new Error('boom'))).toBe(false)
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})
