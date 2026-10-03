import { describe, expect, it } from 'vitest'
import { returnPathFrom } from './returnPath'

describe('returnPathFrom', () => {
  it('returns the in-app path the user was sent to login from', () => {
    expect(returnPathFrom({ from: { pathname: '/admin/data-health', search: '?x=1' } })).toBe('/admin/data-health?x=1')
  })
  it('falls back to / for missing, login or external paths', () => {
    expect(returnPathFrom(null)).toBe('/')
    expect(returnPathFrom({ from: { pathname: '/login' } })).toBe('/')
    expect(returnPathFrom({ from: { pathname: '//evil.example' } })).toBe('/')
    expect(returnPathFrom({ from: { pathname: 'https://evil.example' } })).toBe('/')
  })
})
