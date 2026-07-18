import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from './useTemplates'
import type { TaskTemplate } from '@/types/domain'

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

describe('useCreateTemplate (optimistic create, US4 030)', () => {
  it('inserts the optimistic template with a client-minted id before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1, defaultOwner: 'both' })
    })

    await waitFor(() => {
      const templates = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      expect(templates).toHaveLength(1)
      expect(templates?.[0]).toMatchObject({ eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1 })
      expect(templates?.[0]?.id).toBeTruthy()
    })

    resolveCall({ template: {} })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1, defaultOwner: 'both' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskTemplate[]>(['templates'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useUpdateTemplate (optimistic patch, US4 030)', () => {
  const existing: TaskTemplate = { id: 't1', eventType: 'Trip', taskTitle: 'Old title', offsetDays: -1, defaultOwner: 'both' }

  it('patches the matching template before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 't1', taskTitle: 'New title' })
    })

    await waitFor(() => {
      const templates = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      expect(templates?.find((t) => t.id === 't1')?.taskTitle).toBe('New title')
    })

    resolveCall({ template: {} })
  })

  it('reverts the patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 't1', taskTitle: 'New title' })
    })

    await waitFor(() => {
      const templates = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      expect(templates?.find((t) => t.id === 't1')?.taskTitle).toBe('Old title')
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useDeleteTemplate (optimistic removal, US4 030)', () => {
  const existing: TaskTemplate = { id: 't1', eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1, defaultOwner: 'both' }

  it('removes the template before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('t1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskTemplate[]>(['templates'])).toHaveLength(0)
    })

    resolveCall({ id: 't1' })
  })

  it('reverts the removal and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<TaskTemplate[]>(['templates'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteTemplate(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('t1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskTemplate[]>(['templates'])).toEqual([existing])
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})
