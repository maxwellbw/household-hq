import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateRecurringRule, useUpdateRecurringRule, useDeleteRecurringRule } from './useRecurring'
import type { RecurringRule } from '@/types/domain'

const authedCall = vi.fn()
const toastShow = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ authedCall, handleAuthError: vi.fn(), session: { who: { identity: 'max' } } }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: toastShow }),
}))

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

beforeEach(() => {
  authedCall.mockReset()
  toastShow.mockReset()
})

describe('useCreateRecurringRule (optimistic create, US4 030)', () => {
  it('inserts the optimistic rule with a client-minted id before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Clean bathroom', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      expect(rules).toHaveLength(1)
      expect(rules?.[0]).toMatchObject({ title: 'Clean bathroom', cadence: 'weekly' })
      expect(rules?.[0]?.id).toBeTruthy()
    })

    resolveCall({ recurring: {} })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Clean bathroom', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringRule[]>(['recurring'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useUpdateRecurringRule (optimistic patch, US4 030)', () => {
  const existing: RecurringRule = { id: 'r1', title: 'Old title', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' }

  it('patches the matching rule before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'r1', title: 'New title' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      expect(rules?.find((r) => r.id === 'r1')?.title).toBe('New title')
    })

    resolveCall({ recurring: {} })
  })

  it('reverts the patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'r1', title: 'New title' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      expect(rules?.find((r) => r.id === 'r1')?.title).toBe('Old title')
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useDeleteRecurringRule (optimistic removal, US4 030)', () => {
  const existing: RecurringRule = { id: 'r1', title: 'Clean bathroom', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' }

  it('removes the rule before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('r1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringRule[]>(['recurring'])).toHaveLength(0)
    })

    resolveCall({ id: 'r1' })
  })

  it('reverts the removal and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteRecurringRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('r1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringRule[]>(['recurring'])).toEqual([existing])
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})
