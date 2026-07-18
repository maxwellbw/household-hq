import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBootstrap } from './useBootstrap'
import { useTasks } from './useTasks'
import { ApiError } from '@/lib/api'

const authedCall = vi.fn()
const reportBootError = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    authedCall,
    handleAuthError: vi.fn(),
    session: { who: { identity: 'max' } },
    status: 'signed-in',
    reportBootError,
  }),
}))

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// Mirrors the production QueryClient's staleTime (main.tsx) — the mechanism under test
// (a seeded key is "fresh" so a later observer doesn't refetch) only holds under it.
function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
}

const bootstrapResponse = {
  events: [{ id: 'e1', title: 'Vet', start: '2026-07-20', end: '2026-07-20', owner: 'max' }],
  tasks: [{ id: 't1', title: 'Buy milk', owner: 'max', status: 'open' }],
  recurring: [{ id: 'r1', title: 'Mow', cadence: 'weekly', anchorDate: '2026-06-01', defaultOwner: 'max', lastGenerated: '' }],
  recurringEvents: [],
  lists: [{ id: 'l1', name: 'Groceries' }],
  listItems: [{ id: 'i1', listId: 'l1', name: 'Milk', status: 'need' }],
  templates: [],
  settings: { timezone: 'America/Los_Angeles' },
  dogWalks: [],
}

beforeEach(() => {
  authedCall.mockReset()
  reportBootError.mockReset()
})

describe('useBootstrap (feature 030 US1)', () => {
  it('seeds all nine dataset query keys on success, and not activity', async () => {
    authedCall.mockResolvedValue(bootstrapResponse)
    const queryClient = newQueryClient()

    const { result } = renderHook(() => useBootstrap(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authedCall).toHaveBeenCalledWith('data.bootstrap')

    expect(queryClient.getQueryData(['events'])).toEqual(bootstrapResponse.events)
    expect(queryClient.getQueryData(['tasks'])).toEqual(bootstrapResponse.tasks)
    expect(queryClient.getQueryData(['recurring'])).toEqual(bootstrapResponse.recurring)
    expect(queryClient.getQueryData(['recurringEvents'])).toEqual(bootstrapResponse.recurringEvents)
    expect(queryClient.getQueryData(['lists'])).toEqual(bootstrapResponse.lists)
    expect(queryClient.getQueryData(['listItems'])).toEqual(bootstrapResponse.listItems)
    expect(queryClient.getQueryData(['templates'])).toEqual(bootstrapResponse.templates)
    expect(queryClient.getQueryData(['settings'])).toEqual({ settings: bootstrapResponse.settings })
    expect(queryClient.getQueryData(['dogWalks'])).toEqual(bootstrapResponse.dogWalks)
    expect(queryClient.getQueryData(['activity'])).toBeUndefined()
  })

  it('mounting a per-dataset hook after bootstrap settles issues no additional apiCall', async () => {
    authedCall.mockResolvedValue(bootstrapResponse)
    const queryClient = newQueryClient()

    const { result } = renderHook(() => useBootstrap(), { wrapper: wrapperFor(queryClient) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authedCall).toHaveBeenCalledTimes(1)

    const { result: tasks } = renderHook(() => useTasks(), { wrapper: wrapperFor(queryClient) })

    // The seeded ['tasks'] data is fresh under staleTime, so the newly-mounted observer
    // should read it straight from cache rather than firing tasks.list (SC-001).
    await waitFor(() => expect(tasks.current.data).toEqual(bootstrapResponse.tasks))
    expect(authedCall).toHaveBeenCalledTimes(1)
  })

  it('does not seed the cache and reports a boot error when the payload is malformed (FR-010)', async () => {
    authedCall.mockResolvedValue({ ...bootstrapResponse, tasks: undefined })
    const queryClient = newQueryClient()

    const { result } = renderHook(() => useBootstrap(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined()
    expect(queryClient.getQueryData(['events'])).toBeUndefined()
    expect(reportBootError).toHaveBeenCalled()
  })

  it('reports a boot error (rather than leaving signed-in with an unseeded cache) when bootstrap fails', async () => {
    authedCall.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline'))
    const queryClient = newQueryClient()

    const { result } = renderHook(() => useBootstrap(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(reportBootError).toHaveBeenCalled()
  })
})
