import { beforeEach, describe, expect, it } from 'vitest'
import {
  clear,
  clearSessionToken,
  getActingPerson,
  getSessionToken,
  setActingPerson,
  setSessionToken,
} from './session-store'

describe('session-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips the session token', () => {
    expect(getSessionToken()).toBeNull()
    setSessionToken('hqs1.payload.sig')
    expect(getSessionToken()).toBe('hqs1.payload.sig')
  })

  it('treats a non-hqs1 stored value as absent (corruption defense)', () => {
    localStorage.setItem('hq.sessionToken', 'garbage-or-an-old-google-token')
    expect(getSessionToken()).toBeNull()
  })

  it('round-trips the acting person', () => {
    expect(getActingPerson()).toBeNull()
    setActingPerson('max')
    expect(getActingPerson()).toBe('max')
    setActingPerson('jaz')
    expect(getActingPerson()).toBe('jaz')
  })

  it('treats a corrupt acting-person value as absent', () => {
    localStorage.setItem('hq.actingPerson', 'garbage')
    expect(getActingPerson()).toBeNull()
  })

  it('clearSessionToken() drops the credential but keeps the acting person', () => {
    setSessionToken('hqs1.payload.sig')
    setActingPerson('jaz')
    clearSessionToken()
    expect(getSessionToken()).toBeNull()
    expect(getActingPerson()).toBe('jaz')
  })

  it('clear() removes everything, including the legacy auto-sign-in hint', () => {
    setSessionToken('hqs1.payload.sig')
    setActingPerson('max')
    localStorage.setItem('hq.autoSignIn', '1')
    clear()
    expect(getSessionToken()).toBeNull()
    expect(getActingPerson()).toBeNull()
    expect(localStorage.getItem('hq.autoSignIn')).toBeNull()
  })
})
