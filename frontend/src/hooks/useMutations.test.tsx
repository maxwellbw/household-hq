import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreateEvent,
  useCreateOneTimeTask,
  useUpdateEvent,
  useUpdateTask,
  useCreateRecurring,
  useScheduleTask,
  useRankTasks,
  useDeleteTask,
  useDeleteEvent,
} from './useMutations'
import type { Event, RecurringRule, Task } from '@/types/domain'

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

describe('useCreateEvent (optimistic create, R2)', () => {
  it('inserts the optimistic event into the ["events"] cache before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    })

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events).toHaveLength(1)
      expect(events?.[0]).toMatchObject({ title: 'Dentist', owner: 'jaz', start: '2026-07-20T14:30' })
    })

    resolveCall({})
  })

  it('mints a client id, sends it in the payload, and the optimistic row carries it', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [])
    authedCall.mockResolvedValue({})

    const { result } = renderHook(() => useCreateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    })

    await waitFor(() => expect(authedCall).toHaveBeenCalled())
    const payload = authedCall.mock.calls[0][1] as { id: string }
    expect(payload.id).toBeTruthy()

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events?.[0]?.id).toBe(payload.id)
    })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Event[]>(['events'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })

  it('threads templateId through to the payload and the optimistic row (feature 029 US5)', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [])
    authedCall.mockResolvedValue({})

    const { result } = renderHook(() => useCreateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Trip', start: '2026-07-20T14:30', owner: 'jaz', templateId: 'Vacation' })
    })

    await waitFor(() => expect(authedCall).toHaveBeenCalled())
    const payload = authedCall.mock.calls[0][1] as { templateId?: string }
    expect(payload.templateId).toBe('Vacation')

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events?.[0]?.templateId).toBe('Vacation')
    })
  })
})

describe('useCreateOneTimeTask (optimistic create, R2)', () => {
  it('inserts the optimistic task into the ["tasks"] cache before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateOneTimeTask('America/Los_Angeles'), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Buy milk', owner: 'max' })
    })

    await waitFor(() => {
      const tasks = queryClient.getQueryData<Task[]>(['tasks'])
      expect(tasks).toHaveLength(1)
      expect(tasks?.[0]).toMatchObject({ title: 'Buy milk', owner: 'max', status: 'open' })
    })

    resolveCall({})
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateOneTimeTask('America/Los_Angeles'), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Buy milk', owner: 'max' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useUpdateEvent (optimistic patch, R2)', () => {
  const existing: Event = { id: 'e1', title: 'Old title', start: '2026-07-20T14:30', end: '2026-07-20T15:30', owner: 'jaz' }

  it('patches the matching event in the cache before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'e1', title: 'New title' })
    })

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events?.find((e) => e.id === 'e1')?.title).toBe('New title')
    })

    resolveCall({})
  })

  it('reverts the patch and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'e1', title: 'New title' })
    })

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events?.find((e) => e.id === 'e1')?.title).toBe('Old title')
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })

  it('patches templateId in the cache and sends it in the payload (feature 029 US5)', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [existing])
    authedCall.mockResolvedValue({})

    const { result } = renderHook(() => useUpdateEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'e1', templateId: 'Trip' })
    })

    await waitFor(() => expect(authedCall).toHaveBeenCalled())
    const payload = authedCall.mock.calls[0][1] as { templateId?: string }
    expect(payload.templateId).toBe('Trip')

    await waitFor(() => {
      const events = queryClient.getQueryData<Event[]>(['events'])
      expect(events?.find((e) => e.id === 'e1')?.templateId).toBe('Trip')
    })
  })
})

describe('useUpdateTask (optimistic patch, R2)', () => {
  const existing: Task = { id: 't1', title: 'Old title', owner: 'max', status: 'open' }

  it('patches the matching task in the cache before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 't1', title: 'New title' })
    })

    await waitFor(() => {
      const tasks = queryClient.getQueryData<Task[]>(['tasks'])
      expect(tasks?.find((t) => t.id === 't1')?.title).toBe('New title')
    })

    resolveCall({})
  })

  it('reverts the patch and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 't1', title: 'New title' })
    })

    await waitFor(() => {
      const tasks = queryClient.getQueryData<Task[]>(['tasks'])
      expect(tasks?.find((t) => t.id === 't1')?.title).toBe('Old title')
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useCreateRecurring (optimistic create, US4 030)', () => {
  it('inserts the optimistic rule into ["recurring"] with a client-minted id before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateRecurring(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Clean bathroom', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' })
    })

    await waitFor(() => {
      const rules = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      expect(rules).toHaveLength(1)
      expect(rules?.[0]).toMatchObject({ title: 'Clean bathroom', cadence: 'weekly' })
      expect(rules?.[0]?.id).toBeTruthy()
    })

    resolveCall({})
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<RecurringRule[]>(['recurring'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateRecurring(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ title: 'Clean bathroom', cadence: 'weekly', anchorDate: '2026-07-20', defaultOwner: 'max' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<RecurringRule[]>(['recurring'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useScheduleTask (optimistic patch, US4 030)', () => {
  const existing: Task = { id: 't1', title: 'Fix fence', owner: 'max', status: 'open' }

  it('patches dueDate and owner before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useScheduleTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ taskId: 't1', date: '2026-08-01', owner: 'jaz' })
    })

    await waitFor(() => {
      const tasks = queryClient.getQueryData<Task[]>(['tasks'])
      expect(tasks?.find((t) => t.id === 't1')).toMatchObject({ dueDate: '2026-08-01', owner: 'jaz' })
    })

    resolveCall({})
  })

  it('reverts the patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useScheduleTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ taskId: 't1', date: '2026-08-01', owner: 'jaz' })
    })

    await waitFor(() => {
      const task = queryClient.getQueryData<Task[]>(['tasks'])?.find((t) => t.id === 't1')
      expect(task?.owner).toBe('max')
      expect(task?.dueDate).toBeUndefined()
    })
  })
})

describe('useRankTasks (optimistic patch, US4 030)', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'A', owner: 'max', status: 'open', somedayRank: '2' },
    { id: 't2', title: 'B', owner: 'jaz', status: 'open', somedayRank: '1' },
    { id: 't3', title: 'C', owner: 'both', status: 'open' },
  ]

  it('applies dense best-to-worst ranks and clears ranks for tasks left out of order', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], tasks)
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useRankTasks(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate(['t2', 't1'])
    })

    await waitFor(() => {
      const updated = queryClient.getQueryData<Task[]>(['tasks'])
      expect(updated?.find((t) => t.id === 't2')?.somedayRank).toBe('1')
      expect(updated?.find((t) => t.id === 't1')?.somedayRank).toBe('2')
      expect(updated?.find((t) => t.id === 't3')?.somedayRank).toBe('')
    })

    resolveCall({ ranked: 2 })
  })

  it('reverts the rank patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], tasks)
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useRankTasks(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate(['t2', 't1'])
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toEqual(tasks)
    })
  })
})

describe('useDeleteTask (optimistic removal, US4 030)', () => {
  const existing: Task = { id: 't1', title: 'Fix fence', owner: 'max', status: 'open' }

  it('removes the task before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('t1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toHaveLength(0)
    })

    resolveCall({})
  })

  it('reverts the removal on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Task[]>(['tasks'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteTask(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('t1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toEqual([existing])
    })
  })
})

describe('useDeleteEvent (optimistic removal + prep-task cascade, US4 030)', () => {
  const event: Event = { id: 'e1', title: 'Dentist', start: '2026-07-20T14:30', end: '2026-07-20T15:30', owner: 'jaz' }
  const tasks: Task[] = [
    { id: 't1', title: 'Prep for dentist', owner: 'jaz', status: 'open', eventId: 'e1' },
    { id: 't2', title: 'Unrelated task', owner: 'max', status: 'open' },
  ]

  it('removes the event and its prep tasks before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [event])
    queryClient.setQueryData<Task[]>(['tasks'], tasks)
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('e1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Event[]>(['events'])).toHaveLength(0)
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toEqual([tasks[1]])
    })

    resolveCall({})
  })

  it('reverts the event and its prep tasks on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<Event[]>(['events'], [event])
    queryClient.setQueryData<Task[]>(['tasks'], tasks)
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteEvent(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('e1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Event[]>(['events'])).toEqual([event])
      expect(queryClient.getQueryData<Task[]>(['tasks'])).toEqual(tasks)
    })
  })
})
