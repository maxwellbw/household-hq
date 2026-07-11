import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'
import { ApiError } from '@/lib/api'
import * as sessionStore from '@/lib/session-store'

const { fetchWhoAmIMock, promptSilentMock, setupGisMock, signOutMock, apiCallMock } = vi.hoisted(() => ({
  fetchWhoAmIMock: vi.fn(),
  promptSilentMock: vi.fn(),
  setupGisMock: vi.fn(),
  signOutMock: vi.fn(),
  apiCallMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  fetchWhoAmI: fetchWhoAmIMock,
  promptSilent: promptSilentMock,
  setupGis: setupGisMock,
  renderSignInButton: vi.fn(),
  signOut: signOutMock,
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiCall: apiCallMock }
})

const PERSONAL_WHO = { identity: 'max' as const, displayName: 'Max', email: 'max@x.com', needsActingPerson: false }
const SHARED_WHO = { identity: 'shared' as const, displayName: 'Household', email: 'h@x.com', needsActingPerson: true }

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
  fetchWhoAmIMock.mockReset()
  promptSilentMock.mockReset()
  setupGisMock.mockReset()
  signOutMock.mockReset()
  apiCallMock.mockReset()
  // Default: setupGis never fires its callback unless a test triggers it.
  setupGisMock.mockImplementation(async () => {})
  // Default: silent prompt never resolves (simulates "still deciding") unless overridden.
  promptSilentMock.mockImplementation(() => new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('boot restore', () => {
  it('goes straight to signed-out when no auto-sign-in hint is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
  })

  it('restores to signed-in via silent callback when the hint is set', async () => {
    sessionStore.setAutoSignIn()
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('fresh-token')
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.session?.token).toBe('fresh-token')
  })

  it('seeds the remembered acting person on restore for the shared account', async () => {
    sessionStore.setAutoSignIn()
    sessionStore.setActingPerson('jaz')
    fetchWhoAmIMock.mockResolvedValue(SHARED_WHO)
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('fresh-token')
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.session?.actingPerson).toBe('jaz')
  })

  it('falls back to signed-out once when GIS declines silently (no loop)', async () => {
    sessionStore.setAutoSignIn()
    promptSilentMock.mockResolvedValue('declined')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(setupGisMock).toHaveBeenCalledTimes(1)
  })

  it('lands on forbidden when whoami reports the account is not on the allowlist', async () => {
    sessionStore.setAutoSignIn()
    fetchWhoAmIMock.mockRejectedValue(new ApiError('FORBIDDEN', 'Not allowed'))
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('fresh-token')
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('forbidden'))
  })
})

describe('authedCall reactive refresh', () => {
  function renderSignedIn() {
    sessionStore.setAutoSignIn()
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('token-1')
    })
    return renderHook(() => useAuth(), { wrapper })
  }

  async function signIn(result: { current: ReturnType<typeof useAuth> }) {
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
  }

  it('retries exactly once after a silent refresh on an expired credential', async () => {
    const { result } = renderSignedIn()
    await signIn(result)

    apiCallMock
      .mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', 'expired'))
      .mockResolvedValueOnce({ ok: true })

    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('token-2')
    })
    promptSilentMock.mockImplementation(() => new Promise(() => {}))
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)

    const response = await act(() => result.current.authedCall('tasks.list'))
    expect(response).toEqual({ ok: true })
    expect(apiCallMock).toHaveBeenCalledTimes(2)
    expect(apiCallMock.mock.calls[1][2]).toMatchObject({ token: 'token-2' })
  })

  it('shares one in-flight refresh across concurrent expired calls', async () => {
    const { result } = renderSignedIn()
    await signIn(result)

    apiCallMock.mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', 'expired'))
    apiCallMock.mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', 'expired'))
    apiCallMock.mockResolvedValue({ ok: true })

    let refreshCalls = 0
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      refreshCalls += 1
      onCredential('token-2')
    })
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)

    await act(async () => {
      await Promise.all([result.current.authedCall('tasks.list'), result.current.authedCall('events.list')])
    })

    // First setupGis call is the initial sign-in; exactly one more for the shared refresh.
    expect(refreshCalls).toBe(1)
  })

  it('falls back to signed-out when the silent refresh itself fails', async () => {
    const { result } = renderSignedIn()
    await signIn(result)

    apiCallMock.mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', 'expired'))
    promptSilentMock.mockResolvedValue('declined')
    setupGisMock.mockImplementation(async () => {})

    await act(async () => {
      await expect(result.current.authedCall('tasks.list')).rejects.toThrow()
    })
    expect(result.current.status).toBe('signed-out')
  })
})

describe('sign-out', () => {
  it('clears persisted hints so the next boot is signed-out with no auto re-entry', async () => {
    sessionStore.setAutoSignIn()
    sessionStore.setActingPerson('max')
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      onCredential('token-1')
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))

    act(() => result.current.signOut())

    expect(signOutMock).toHaveBeenCalled()
    expect(sessionStore.getAutoSignIn()).toBe(false)
    expect(sessionStore.getActingPerson()).toBeNull()
    expect(result.current.status).toBe('signed-out')
  })
})
