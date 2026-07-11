import { beforeEach, describe, expect, it } from 'vitest'
import { clear, getActingPerson, getAutoSignIn, setActingPerson, setAutoSignIn } from './session-store'

describe('session-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reports no auto sign-in hint until one is set', () => {
    expect(getAutoSignIn()).toBe(false)
    setAutoSignIn()
    expect(getAutoSignIn()).toBe(true)
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

  it('treats a corrupt auto-sign-in value as absent', () => {
    localStorage.setItem('hq.autoSignIn', 'yes-please')
    expect(getAutoSignIn()).toBe(false)
  })

  it('clear() removes both keys', () => {
    setAutoSignIn()
    setActingPerson('max')
    clear()
    expect(getAutoSignIn()).toBe(false)
    expect(getActingPerson()).toBeNull()
  })
})
