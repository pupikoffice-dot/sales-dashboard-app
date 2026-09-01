import { describe, expect, it } from 'vitest'
import {
  bumpProductVersion,
  parsePromoteVersion,
  readBetaProductVersion,
} from './productVersion.mjs'

describe('productVersion', () => {
  it('parses promote commit message', () => {
    expect(parsePromoteVersion('Promote beta v2.1 to production (main).')).toBe('2.1')
    expect(parsePromoteVersion('fix: something')).toBeNull()
  })

  it('bumps minor product line', () => {
    expect(bumpProductVersion('2.1')).toBe('2.2')
    expect(bumpProductVersion('2.9')).toBe('2.10')
  })

  it('reads current beta fallback from appChannel.ts', () => {
    expect(readBetaProductVersion()).toMatch(/^\d+\.\d+$/)
  })
})
