import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT_STYLE, LAYOUT_STYLE_IDS, isLayoutStyle } from './layoutStyle'

describe('layout styles', () => {
  it('defaults to the current look', () => {
    expect(DEFAULT_LAYOUT_STYLE).toBe('current')
    expect(LAYOUT_STYLE_IDS[0]).toBe('current')
  })

  it('recognises only known styles', () => {
    expect(isLayoutStyle('ledger')).toBe(true)
    expect(isLayoutStyle('calm')).toBe(true)
    expect(isLayoutStyle('console')).toBe(true)
    expect(isLayoutStyle('neon')).toBe(false)
    expect(isLayoutStyle(null)).toBe(false)
  })
})
