import { describe, expect, it } from 'vitest'
import type { AppUiModule } from '../types/uiModules'
import {
  isClassGrantableUiModule,
  isSuiteClassFeatureId,
  isSuiteMountableUiModuleId,
  resolveVisibleSuiteClassFeatureIds,
  resolveVisibleSuiteUiModuleIds,
} from './suiteUiModules'

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
    id: 'best_sold_items',
    label: 'Best sold items',
    surface: 'oversight',
    kind: 'addon',
    active: true,
    sortOrder: 20,
    description: null,
  },
  {
    id: 'best_clients',
    label: 'Best clients',
    surface: 'oversight',
    kind: 'addon',
    active: true,
    sortOrder: 30,
    description: null,
  },
  {
    id: 'other_addon',
    label: 'Other',
    surface: 'oversight',
    kind: 'addon',
    active: true,
    sortOrder: 40,
    description: null,
  },
  {
    id: 'year_net_sales',
    label: 'Sales year graph (891)',
    surface: 'oversight',
    kind: 'addon',
    active: true,
    sortOrder: 50,
    description: null,
  },
]

describe('suiteUiModules', () => {
  it('allowlists only best sold / best clients', () => {
    expect(isSuiteMountableUiModuleId('best_sold_items')).toBe(true)
    expect(isSuiteMountableUiModuleId('sales_manager')).toBe(false)
  })

  it('excludes allowlist from class-grantable UI modules', () => {
    expect(isClassGrantableUiModule(catalog[0]!)).toBe(true) // suite
    expect(isClassGrantableUiModule(catalog[1]!)).toBe(false)
    expect(isClassGrantableUiModule(catalog[2]!)).toBe(false)
    expect(isClassGrantableUiModule(catalog[4]!)).toBe(true) // year graph is a class feature
    expect(isSuiteClassFeatureId('year_net_sales')).toBe(true)
    expect(isSuiteClassFeatureId('best_sold_items')).toBe(false)
  })

  it('super-admin not previewing gets active allowlist', () => {
    expect(
      resolveVisibleSuiteUiModuleIds({
        isSuperAdmin: true,
        isPreviewing: false,
        grants: [],
        catalog,
      }),
    ).toEqual(['best_sold_items', 'best_clients'])
  })

  it('preview uses grants ∩ active allowlist', () => {
    expect(
      resolveVisibleSuiteUiModuleIds({
        isSuperAdmin: true,
        isPreviewing: true,
        grants: ['best_clients', 'sales_manager'],
        catalog,
      }),
    ).toEqual(['best_clients'])
  })

  it('super-admin not previewing sees class suite features', () => {
    expect(
      resolveVisibleSuiteClassFeatureIds({
        isSuperAdmin: true,
        isPreviewing: false,
        grantedModuleIds: [],
        catalog,
      }),
    ).toEqual(['year_net_sales'])
  })

  it('preview and regular users need the class grant', () => {
    expect(
      resolveVisibleSuiteClassFeatureIds({
        isSuperAdmin: true,
        isPreviewing: true,
        grantedModuleIds: [],
        catalog,
      }),
    ).toEqual([])
    expect(
      resolveVisibleSuiteClassFeatureIds({
        isSuperAdmin: false,
        isPreviewing: false,
        grantedModuleIds: ['year_net_sales', 'best_clients'],
        catalog,
      }),
    ).toEqual(['year_net_sales'])
  })
})
