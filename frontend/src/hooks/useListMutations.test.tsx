import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCreateList,
  useDeleteList,
  useCreateListItem,
  useUpdateListItem,
  useDeleteListItem,
} from './useListMutations'
import type { List, ListItem } from '@/types/domain'

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

describe('useCreateList (optimistic create, US4 030)', () => {
  it('inserts the optimistic list before the mutation resolves, with a client-minted id', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<List[]>(['lists'], [])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useCreateList(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('Groceries')
    })

    await waitFor(() => {
      const lists = queryClient.getQueryData<List[]>(['lists'])
      expect(lists).toHaveLength(1)
      expect(lists?.[0]).toMatchObject({ name: 'Groceries' })
      expect(lists?.[0]?.id).toBeTruthy()
    })

    resolveCall({ list: { id: 'server-id', name: 'Groceries' } })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<List[]>(['lists'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateList(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('Groceries')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<List[]>(['lists'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useDeleteList (optimistic removal + cascade, US4 030)', () => {
  const lists: List[] = [{ id: 'l1', name: 'Groceries' }, { id: 'l2', name: 'Hardware' }]
  const items: ListItem[] = [
    { id: 'i1', listId: 'l1', name: 'Milk', status: 'need', section: '', staple: 'FALSE' },
    { id: 'i2', listId: 'l2', name: 'Nails', status: 'need', section: '', staple: 'FALSE' },
  ]

  it('removes the list and its items before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<List[]>(['lists'], lists)
    queryClient.setQueryData<ListItem[]>(['listItems'], items)
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteList(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('l1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<List[]>(['lists'])).toEqual([lists[1]])
      expect(queryClient.getQueryData<ListItem[]>(['listItems'])).toEqual([items[1]])
    })

    resolveCall({ id: 'l1' })
  })

  it('reverts the list and its items on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<List[]>(['lists'], lists)
    queryClient.setQueryData<ListItem[]>(['listItems'], items)
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteList(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('l1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<List[]>(['lists'])).toEqual(lists)
      expect(queryClient.getQueryData<ListItem[]>(['listItems'])).toEqual(items)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useCreateListItem (optimistic create with reuse-and-flip parity, US4 030)', () => {
  it('inserts a new optimistic item when no same-name item exists on the list', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [])
    authedCall.mockResolvedValue({ item: {} })

    const { result } = renderHook(() => useCreateListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ listId: 'l1', name: 'Milk' })
    })

    await waitFor(() => {
      const items = queryClient.getQueryData<ListItem[]>(['listItems'])
      expect(items).toHaveLength(1)
      expect(items?.[0]).toMatchObject({ listId: 'l1', name: 'Milk', status: 'need' })
    })
  })

  it('flips an existing same-name item to need instead of duplicating it (research R3 parity)', async () => {
    const queryClient = newQueryClient()
    const existing: ListItem = { id: 'i1', listId: 'l1', name: 'Milk', status: 'stocked', section: '', staple: 'FALSE' }
    queryClient.setQueryData<ListItem[]>(['listItems'], [existing])
    authedCall.mockResolvedValue({ item: {} })

    const { result } = renderHook(() => useCreateListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ listId: 'l1', name: 'milk' }) // case-insensitive match
    })

    await waitFor(() => {
      const items = queryClient.getQueryData<ListItem[]>(['listItems'])
      expect(items).toHaveLength(1) // no duplicate row
      expect(items?.[0]).toMatchObject({ id: 'i1', status: 'need' })
    })
  })

  it('reverts the optimistic insert and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useCreateListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ listId: 'l1', name: 'Milk' })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<ListItem[]>(['listItems'])).toHaveLength(0)
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useUpdateListItem (optimistic patch, US4 030)', () => {
  const existing: ListItem = { id: 'i1', listId: 'l1', name: 'Milk', status: 'need', section: '', staple: 'FALSE' }

  it('patches the matching item before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'i1', note: '2 gallons' })
    })

    await waitFor(() => {
      const items = queryClient.getQueryData<ListItem[]>(['listItems'])
      expect(items?.find((i) => i.id === 'i1')?.note).toBe('2 gallons')
    })

    resolveCall({ item: {} })
  })

  it('reverts the patch on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ id: 'i1', note: '2 gallons' })
    })

    await waitFor(() => {
      const items = queryClient.getQueryData<ListItem[]>(['listItems'])
      expect(items?.find((i) => i.id === 'i1')?.note).toBeUndefined()
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})

describe('useDeleteListItem (optimistic removal, US4 030)', () => {
  const existing: ListItem = { id: 'i1', listId: 'l1', name: 'Milk', status: 'need', section: '', staple: 'FALSE' }

  it('removes the item before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [existing])
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useDeleteListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('i1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<ListItem[]>(['listItems'])).toHaveLength(0)
    })

    resolveCall({})
  })

  it('reverts the removal and shows a toast on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData<ListItem[]>(['listItems'], [existing])
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useDeleteListItem(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate('i1')
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<ListItem[]>(['listItems'])).toEqual([existing])
    })
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again")
  })
})
