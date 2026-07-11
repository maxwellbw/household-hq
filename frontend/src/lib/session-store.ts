// Tiny localStorage-backed session hints (feature 018 data-model.md). No
// credential ever lives here — just enough to decide whether to attempt a
// silent restore on boot and which acting person to pre-select. Reads are
// defensive: any unexpected value is treated as absent rather than trusted.

const AUTO_SIGN_IN_KEY = 'hq.autoSignIn'
const ACTING_PERSON_KEY = 'hq.actingPerson'

export function getAutoSignIn(): boolean {
  return localStorage.getItem(AUTO_SIGN_IN_KEY) === '1'
}

export function setAutoSignIn(): void {
  localStorage.setItem(AUTO_SIGN_IN_KEY, '1')
}

export function getActingPerson(): 'max' | 'jaz' | null {
  const value = localStorage.getItem(ACTING_PERSON_KEY)
  return value === 'max' || value === 'jaz' ? value : null
}

export function setActingPerson(person: 'max' | 'jaz'): void {
  localStorage.setItem(ACTING_PERSON_KEY, person)
}

export function clear(): void {
  localStorage.removeItem(AUTO_SIGN_IN_KEY)
  localStorage.removeItem(ACTING_PERSON_KEY)
}
