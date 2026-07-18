import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateSettings } from './useSettings'
import type { Settings } from '@/types/domain'

const authedCall = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ authedCall, handleAuthError: vi.fn(), session: { who: { identity: 'max' } } }),
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
})

describe('useUpdateSettings (optimistic patch, US4 030)', () => {
  const existing: { settings: Settings } = { settings: { timezone: 'America/Los_Angeles', digestHour: '7' } }

  it('merges the changed keys into the ["settings"] cache before the mutation resolves', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData(['settings'], existing)
    let resolveCall: (v: unknown) => void = () => {}
    authedCall.mockImplementation(() => new Promise((resolve) => { resolveCall = resolve }))

    const { result } = renderHook(() => useUpdateSettings(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ digestHour: '9' })
    })

    await waitFor(() => {
      const settings = queryClient.getQueryData<{ settings: Settings }>(['settings'])
      expect(settings?.settings.digestHour).toBe('9')
      expect(settings?.settings.timezone).toBe('America/Los_Angeles')
    })

    resolveCall({ settings: { ...existing.settings, digestHour: '9' }, changed: ['digestHour'], digestTriggerReinstalled: true })
  })

  it('reverts the merge on failure', async () => {
    const queryClient = newQueryClient()
    queryClient.setQueryData(['settings'], existing)
    authedCall.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useUpdateSettings(), { wrapper: wrapperFor(queryClient) })
    act(() => {
      result.current.mutate({ digestHour: '9' })
    })

    await waitFor(() => {
      const settings = queryClient.getQueryData<{ settings: Settings }>(['settings'])
      expect(settings?.settings.digestHour).toBe('7')
    })
  })
})
