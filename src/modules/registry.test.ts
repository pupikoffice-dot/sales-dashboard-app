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
    const a = access(['rnd_grp_cards', 'rnd_item_card'])
    expect(canShowModule(a, 'rnd_item_card')).toBe(true)
    expect(canShowModule(a, 'rnd_year')).toBe(false)
    expect(canShowModule(a, 'rnd_client_card')).toBe(false)
  })
  it('a page inside the Cards group tab needs the group tab as well', () => {
    expect(canShowModule(access(['rnd_item_card']), 'rnd_item_card')).toBe(false)       // page without the group
    expect(canShowModule(access(['rnd_grp_cards']), 'rnd_item_card')).toBe(false)       // group without the page
    expect(canShowModule(access(['rnd_grp_cards', 'rnd_client_card']), 'rnd_client_card')).toBe(true)
    expect(canShowModule(access(['rnd_grp_cards', 'rnd_client_card']), 'rnd_item_card')).toBe(false)
  })
  it('the Expenses group and its pages are super admin only (not grantable)', () => {
    const exp = NAV_EXTRAS.filter(e => e.group === 'grp_expenses')
    expect(exp.length).toBe(3)
    expect(exp.every(e => e.superAdminOnly)).toBe(true)
    expect(MODULE_REGISTRY.some(m => (m.id as string) === 'grp_expenses' || m.group === 'grp_expenses')).toBe(false)
  })
  it('a super admin sees every page', () => {
    expect(canShowModule(access([]), 'rnd_year', true)).toBe(true)
  })
  it('sub pages are never offered as the default landing module', () => {
    const landing = MODULE_REGISTRY.filter(m => !m.subpage).map(m => m.id)
    for (const m of MODULE_REGISTRY.filter(m => m.subpage)) expect(landing).not.toContain(m.id)
  })
})
