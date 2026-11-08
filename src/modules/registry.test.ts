import { describe, expect, it } from 'vitest'

import { canShowModule } from '../lib/permissions'
import type { DashboardAccess } from '../types/dashboard'
import { MODULE_REGISTRY, NAV_EXTRAS } from './registry'

const access = (modules: DashboardAccess['modules']): DashboardAccess => ({
  userId: 'u', modules, companies: ['pupik'], agents: null, defaultModule: 'oversite', active: true,
  showItemCost: false, showClientProfit: false, hiddenSidebar: [], hiddenYears: [], thisYearOnly: false, oversiteModules: [],
})

describe('page permissions', () => {
  it('every sidebar page that is not super-admin-only is a grantable module of the same section', () => {
    for (const x of NAV_EXTRAS.filter(e => !e.superAdminOnly)) {
      const m = MODULE_REGISTRY.find(r => r.id === x.id)
      expect(m, `${x.id} is in the sidebar but not in MODULE_REGISTRY, so it could not be granted`).toBeTruthy()
      expect(m?.section).toBe(x.section)
      expect(m?.path).toBe(x.path)
    }
  })
  it('pages are granted one by one: Item card yes, Yearly data no', () => {
    const a = access(['rnd_item_card'])
    expect(canShowModule(a, 'rnd_item_card')).toBe(true)
    expect(canShowModule(a, 'rnd_year')).toBe(false)
    expect(canShowModule(a, 'rnd_client_card')).toBe(false)
  })
  it('a super admin sees every page', () => {
    expect(canShowModule(access([]), 'rnd_year', true)).toBe(true)
  })
  it('sub pages are never offered as the default landing module', () => {
    const landing = MODULE_REGISTRY.filter(m => !m.subpage).map(m => m.id)
    for (const m of MODULE_REGISTRY.filter(m => m.subpage)) expect(landing).not.toContain(m.id)
  })
})
