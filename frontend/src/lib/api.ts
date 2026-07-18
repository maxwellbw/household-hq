// Typed client for the Household HQ backend (contracts/api-client.md).
// Every call is a text/plain POST carrying a JSON envelope; HTTP status is
// always 200 — `ok` is the sole success discriminator (feature-001 CORS
// decision: text/plain avoids the preflight Apps Script won't answer).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

const TIMEOUT_MS = 15_000

const TRANSIENT_CODES = new Set(['NETWORK_ERROR', 'TIMEOUT', 'BAD_RESPONSE'])

export class ApiError extends Error {
  code: string
  field?: string
  // Structured data beyond `message` (feature 031: OVERRIDE_REQUIRED carries named
  // failedGates/conflicts so the client can render a real confirmation step). Undefined for
  // every other error code.
  details?: unknown

  constructor(code: string, message: string, field?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
    this.details = details
  }
}

// FR-012/014 (feature 030): distinguishes a self-healing blip (network/timeout/parse) from a
// genuine error that would waste the retry budget or mask a real auth rejection.
export function isTransientError(err: unknown): boolean {
  return err instanceof ApiError && TRANSIENT_CODES.has(err.code)
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string; field?: string; details?: unknown }
}

interface CallOptions {
  token?: string
  actingPerson?: 'max' | 'jaz'
}

export async function apiCall<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<T> {
  const body: Record<string, unknown> = { action, payload }
  if (options.token) body.token = options.token
  if (options.actingPerson) {
    body.payload = { ...payload, actingPerson: options.actingPerson }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'The server took too long to respond.')
    }
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.')
  } finally {
    clearTimeout(timer)
  }

  let envelope: Envelope<T>
  try {
    envelope = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError('BAD_RESPONSE', 'The server returned an unexpected response.')
  }

  if (!envelope.ok) {
    const err = envelope.error ?? { code: 'INTERNAL', message: 'An unexpected error occurred.' }
    throw new ApiError(err.code, err.message, err.field, err.details)
  }

  return envelope.data as T
}
