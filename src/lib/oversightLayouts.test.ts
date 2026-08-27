import { describe, expect, it } from 'vitest'
import {
  resolveOversightDisplay,
  isOversightAlternateLayoutId,
} from './oversightLayouts'

describe('isOversightAlternateLayoutId', () => {
  it('allows sales_manager only', () => {
    expect(isOversightAlternateLayoutId('sales_manager')).toBe(true)
    expect(isOversightAlternateLayoutId('best_sold_items')).toBe(false)
  })
})

describe('resolveOversightDisplay', () => {
  const classic = { mode: 'classic' as const, addonIds: [] as string[] }

  it('forces suite when class grants suite (no toggle)', () => {
    const r = resolveOversightDisplay({
      classMode: { mode: 'suite', suiteId: 'sales_manager' },
      alternateLayoutIds: ['sales_manager'],
      preference: 'classic',
    })
    expect(r.canToggle).toBe(false)
    expect(r.display).toEqual({ mode: 'suite', suiteId: 'sales_manager' })
  })

  it('classic only when no alternate grants', () => {
    const r = resolveOversightDisplay({
      classMode: classic,
      alternateLayoutIds: [],
      preference: { suiteId: 'sales_manager' },
    })
    expect(r.canToggle).toBe(false)
    expect(r.display).toEqual(classic)
  })

  it('defaults to classic when both available and no preference', () => {
    const r = resolveOversightDisplay({
      classMode: classic,
      alternateLayoutIds: ['sales_manager'],
      preference: null,
    })
    expect(r.canToggle).toBe(true)
    expect(r.display).toEqual(classic)
    expect(r.options[0]).toBe('classic')
  })

  it('honours suite preference when both available', () => {
    const r = resolveOversightDisplay({
      classMode: classic,
      alternateLayoutIds: ['sales_manager'],
      preference: { suiteId: 'sales_manager' },
    })
    expect(r.display).toEqual({ mode: 'suite', suiteId: 'sales_manager' })
    expect(r.canToggle).toBe(true)
  })

  it('ignores preference for unknown suite id', () => {
    const r = resolveOversightDisplay({
      classMode: classic,
      alternateLayoutIds: ['sales_manager'],
      preference: { suiteId: 'other_suite' },
    })
    expect(r.display).toEqual(classic)
  })
})
