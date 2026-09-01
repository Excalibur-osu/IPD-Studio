import { describe, expect, it } from 'vitest'
import { AUTH_MESSAGES, authErrorMessage } from '../../src/auth/errors'

describe('authErrorMessage', () => {
  it('turns every mapped code into a sentence that is not the code itself', () => {
    for (const [code, message] of Object.entries(AUTH_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toContain(code)
      expect(authErrorMessage({ code })).toBe(message)
    }
  })

  it('explains an unconfigured provider rather than blaming the user', () => {
    const msg = authErrorMessage({ code: 'auth/operation-not-allowed' })
    expect(msg).toMatch(/not enabled/i)
  })

  it('falls back to the error message when the code is unknown', () => {
    expect(authErrorMessage({ code: 'auth/some-new-code', message: 'Something specific went wrong.' }))
      .toBe('Something specific went wrong.')
  })

  it('falls back to a generic sentence when there is nothing to go on', () => {
    const msg = authErrorMessage({})
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).toMatch(/[a-z]/i)
  })

  it('survives being handed something that is not an error at all', () => {
    expect(authErrorMessage(null).length).toBeGreaterThan(0)
    expect(authErrorMessage(undefined).length).toBeGreaterThan(0)
    expect(authErrorMessage('a string').length).toBeGreaterThan(0)
  })
})
