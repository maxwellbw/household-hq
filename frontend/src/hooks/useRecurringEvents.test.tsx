import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateRecurringEventRule, useUpdateRecurringEventRule, useDeleteRecurringEventRule } from './useRecurringEvents'
import type { RecurringEventRule } from '@/types/domain'

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

describe('useCreateRecurringEventRule (optimistic create, US4 030)', () => {
  it('inserts the optimistic rule with a client-minted id before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Book club', cadence: 'monthly', anchorDate: '2026-07-20', defaultOwner: 'jaz' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      expect(rules).toHaveLength(1)
      expect(rules?.[0]).toMatchObject({ title: 'Book club', cadence: 'monthly' })
      expect(rules?.[0]?.id).toBeTruthy()
    })

    resolveCall({ recurringEvent: {} })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Book club', cadence: 'monthly', anchorDate: '2026-07-20', defaultOwner: 'jaz' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useUpdateRecurringEventRule (optimistic patch, US4 030)', () => {
  const existing: RecurringEventRule = { id: 'e1', title: 'Old title', cadence: 'monthly', anchorDate: '2026-07-20', defaultOwner: 'jaz' }

  it('patches the matching rule before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'e1', title: 'New title' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      expect(rules?.find((r) => r.id === 'e1')?.title).toBe('New title')
    })

    resolveCall({ recurringEvent: {} })
  })

  it('reverts the patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'e1', title: 'New title' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])
      expect(rules?.find((r) => r.id === 'e1')?.title).toBe('Old title')
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useDeleteRecurringEventRule (optimistic removal, US4 030)', () => {
  const existing: RecurringEventRule = { id: 'e1', title: 'Book club', cadence: 'monthly', anchorDate: '2026-07-20', defaultOwner: 'jaz' }

  it('removes the rule before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('e1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])).toHaveLength(0)
    })

    resolveCall({ id: 'e1' })
  })

  it('reverts the removal and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringEventRule[]>(['recurringEvents'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteRecurringEventRule(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('e1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringEventRule[]>(['recurringEvents'])).toEqual([existing])
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})
