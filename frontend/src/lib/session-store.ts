// Tiny localStorage-backed session state (feature 018 data-model.md, revised
// 2026-07-12). Holds the backend-minted household session token (hqs1.*) plus
// which acting person to pre-select. The session token is a credential, but a
// household-scoped one: the backend re-checks the allowlist on every request,
// re-mints it on every boot (sliding 30-day window), and rotating the backend
// secret invalidates it everywhere. Reads are defensive: any unexpected value
// is treated as absent rather than trusted.

const SESSION_TOKEN_KEY = 'hq.sessionToken'
const ACTING_PERSON_KEY = 'hq.actingPerson'
// Pre-revision 018 hint, no longer written; still cleared so old devices tidy up.
const LEGACY_AUTO_SIGN_IN_KEY = 'hq.autoSignIn'

export function getSessionToken(): string | null {
  const value = localStorage.getItem(SESSION_TOKEN_KEY)
  return value && value.startsWith('hqs1.') ? value : null
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

/** Drop only the credential (expiry/revocation) — the acting person survives
 *  so a re-sign-in doesn't re-ask "Max or Jaz?". Full sign-out uses clear(). */
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

export function getActingPerson(): 'max' | 'jaz' | null {
  const value = localStorage.getItem(ACTING_PERSON_KEY)
  return value === 'max' || value === 'jaz' ? value : null
}

export function setActingPerson(person: 'max' | 'jaz'): void {
  localStorage.setItem(ACTING_PERSON_KEY, person)
}

export function clear(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(ACTING_PERSON_KEY)
  localStorage.removeItem(LEGACY_AUTO_SIGN_IN_KEY)
}
