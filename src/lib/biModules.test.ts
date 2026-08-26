import { describe, expect, it } from 'vitest'
import { resolveVisibleBiModuleIds, validateHabitXY } from './biModules'
import type { AppBiModule } from '../types/biModules'

const catalog: AppBiModule[] = [
  {
    id: 'missed_items',
    label: 'Missed items',
    description: null,
    needsAgent: 'all_or_one',
    usesHabit: true,
    active: true,
    sortOrder: 10,
  },
  {
    id: 'missed_clients',
    label: 'Missed clients',
    description: null,
    needsAgent: 'all_or_one',
    usesHabit: true,
    active: true,
    sortOrder: 20,
  },
  {
    id: 'items_sold_by_others',
    label: 'Items sold by others',
    description: null,
    needsAgent: 'one_only',
    usesHabit: false,
    active: true,
    sortOrder: 30,
  },
  {
    id: 'inactive_bi',
    label: 'Inactive',
    description: null,
    needsAgent: 'all_or_one',
    usesHabit: false,
    active: false,
    sortOrder: 99,
  },
]

describe('validateHabitXY', () => {
  it('accepts 3 of 4', () => {
    expect(validateHabitXY(3, 4)).toBeNull()
  })

  it('rejects x > y or y > 24', () => {
    expect(validateHabitXY(5, 4)).toMatch(/greater/i)
    expect(validateHabitXY(3, 25)).toMatch(/24/)
  })
})

describe('resolveVisibleBiModuleIds', () => {
  it('super-admin not previewing gets all active modules', () => {
    expect(
      resolveVisibleBiModuleIds({
        isSuperAdmin: true,
        isPreviewing: false,
        grants: [],
        catalog,
      }),
    ).toEqual(['missed_items', 'missed_clients', 'items_sold_by_others'])
  })

  it('preview uses grant set ∩ active only', () => {
    expect(
      resolveVisibleBiModuleIds({
        isSuperAdmin: true,
        isPreviewing: true,
        grants: ['missed_items', 'inactive_bi'],
        catalog,
      }),
    ).toEqual(['missed_items'])
  })
})
