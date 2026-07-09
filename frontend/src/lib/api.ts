// Typed client for the Household HQ backend (contracts/api-client.md).
// Every call is a text/plain POST carrying a JSON envelope; HTTP status is
// always 200 — `ok` is the sole success discriminator (feature-001 CORS
// decision: text/plain avoids the preflight Apps Script won't answer).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export class ApiError extends Error {
  code: string
  field?: string

  constructor(code: string, message: string, field?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
  }
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string; field?: string }
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

  let res: Response
  try {
    res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.')
  }

  let envelope: Envelope<T>
  try {
    envelope = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError('BAD_RESPONSE', 'The server returned an unexpected response.')
  }

  if (!envelope.ok) {
    const err = envelope.error ?? { code: 'INTERNAL', message: 'An unexpected error occurred.' }
    throw new ApiError(err.code, err.message, err.field)
  }

  return envelope.data as T
}
