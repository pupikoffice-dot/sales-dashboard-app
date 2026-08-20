import { describe, expect, it } from 'vitest'
import { pickOversightMode, sortAgentIds, sumGoals } from './uiModules'

describe('pickOversightMode', () => {
  it('returns suite when class has an oversight suite', () => {
    expect(pickOversightMode([{ id: 'sales_manager', surface: 'oversight', kind: 'suite' }])).toEqual({
      mode: 'suite', suiteId: 'sales_manager',
    })
  })
  it('ignores addons when suite present', () => {
    expect(pickOversightMode([
      { id: 'sales_manager', surface: 'oversight', kind: 'suite' },
      { id: 'something', surface: 'oversight', kind: 'addon' },
    ]).mode).toBe('suite')
  })
  it('returns classic with addons when no suite', () => {
    expect(pickOversightMode([{ id: 'x', surface: 'oversight', kind: 'addon' }])).toEqual({
      mode: 'classic', addonIds: ['x'],
    })
  })
})

describe('sortAgentIds', () => {
  it('sorts numeric-ish agent codes ascending', () => {
    expect(sortAgentIds(['27', '9', '24'])).toEqual(['9', '24', '27'])
  })
})

describe('sumGoals', () => {
  it('sums targets; missing treated as 0', () => {
    expect(sumGoals(['24', '25'], { '24': 100, '25': undefined })).toBe(100)
  })
})
