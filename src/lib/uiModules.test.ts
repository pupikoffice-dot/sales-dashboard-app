import { describe, expect, it } from 'vitest'
import type { AppUiModule } from '../types/uiModules'
import {
  countOversightSuiteItemKeys,
  mapGrantKeysToUiModules,
  parseUiModuleGrantKey,
  pickOversightMode,
  sortAgentIds,
  sumGoals,
  uiModuleGrantKey,
} from './uiModules'

const catalog: AppUiModule[] = [
  {
    id: 'sales_manager',
    label: 'Sales Manager',
    surface: 'oversight',
    kind: 'suite',
    active: true,
    sortOrder: 10,
    description: null,
  },
  {
    id: 'extra_addon',
    label: 'Extra',
    surface: 'oversight',
    kind: 'addon',
    active: true,
    sortOrder: 20,
    description: null,
  },
  {
    id: 'inactive_suite',
    label: 'Off',
    surface: 'oversight',
    kind: 'suite',
    active: false,
    sortOrder: 30,
    description: null,
  },
]

describe('parseUiModuleGrantKey / uiModuleGrantKey', () => {
  it('round-trips suite and addon keys', () => {
    expect(uiModuleGrantKey('oversight', 'suite', 'sales_manager')).toBe(
      'ui.oversight.suite.sales_manager',
    )
    expect(parseUiModuleGrantKey('ui.oversight.suite.sales_manager')).toEqual({
      surface: 'oversight',
      kind: 'suite',
      id: 'sales_manager',
    })
    expect(parseUiModuleGrantKey('ui.oversight.addon.extra_addon')).toEqual({
      surface: 'oversight',
      kind: 'addon',
      id: 'extra_addon',
    })
  })

  it('rejects legacy widget keys and malformed strings', () => {
    expect(parseUiModuleGrantKey('widget.ordersToday')).toBeNull()
    expect(parseUiModuleGrantKey('ui.oversight.sales_manager')).toBeNull()
    expect(parseUiModuleGrantKey('ui.oversight.suite.')).toBeNull()
  })
})

describe('countOversightSuiteItemKeys', () => {
  it('counts only oversight suite node item keys', () => {
    expect(
      countOversightSuiteItemKeys([
        'node:ui.oversight.suite.sales_manager:',
        'node:ui.oversight.addon.extra_addon:',
        'node:view.oversite:',
        'scope:company:pupik',
      ]),
    ).toBe(1)
    expect(
      countOversightSuiteItemKeys([
        'node:ui.oversight.suite.sales_manager:',
        'node:ui.oversight.suite.other_suite:',
      ]),
    ).toBe(2)
  })
})

describe('mapGrantKeysToUiModules', () => {
  it('maps allow keys onto catalog refs', () => {
    expect(
      mapGrantKeysToUiModules(
        ['ui.oversight.suite.sales_manager', 'ui.oversight.addon.extra_addon'],
        catalog,
      ),
    ).toEqual([
      { id: 'sales_manager', surface: 'oversight', kind: 'suite' },
      { id: 'extra_addon', surface: 'oversight', kind: 'addon' },
    ])
  })

  it('skips unknown, inactive, and surface/kind mismatches', () => {
    expect(
      mapGrantKeysToUiModules(
        [
          'ui.oversight.suite.missing',
          'ui.oversight.suite.inactive_suite',
          'ui.oversight.addon.sales_manager',
          'widget.ordersToday',
        ],
        catalog,
      ),
    ).toEqual([])
  })
})

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
