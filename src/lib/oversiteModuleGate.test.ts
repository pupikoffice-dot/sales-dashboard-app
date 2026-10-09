import { describe, expect, it } from 'vitest'
import type { DashboardAccess } from '../types/dashboard'
import { canShowOversiteModule } from './oversiteModuleGate'

function access(modules: string[]): DashboardAccess {
  return {
    active: true,
    userId: 'u1',
    modules: ['oversite'],
    companies: ['pupik'],
    agents: null,
    defaultModule: 'oversite',
    showItemCost: false,
    showClientProfit: false,
    hiddenSidebar: [],
    oversiteModules: modules,
  }
}

describe('canShowOversiteModule', () => {
  const summary = ['salesMtd', 'ordersToday', 'ordersMtd', 'openOrders', 'debt', 'returns', 'deliveryNotes'] as const

  it('shows summary totals only to the super admin', () => {
    for (const id of summary) {
      expect(canShowOversiteModule(access([...summary]), id)).toBe(false)
      expect(canShowOversiteModule(access([]), id, true)).toBe(true)
    }
  })

  it('still grants the other Oversight sections per user', () => {
    expect(canShowOversiteModule(access(['topItems']), 'topItems')).toBe(true)
    expect(canShowOversiteModule(access([]), 'receipts')).toBe(false)
    expect(canShowOversiteModule(access([]), 'stockAlerts', true)).toBe(true)
  })

  it('hides every section when access is inactive', () => {
    const off = { ...access(['topItems']), active: false }
    expect(canShowOversiteModule(off, 'topItems', true)).toBe(false)
    expect(canShowOversiteModule(off, 'salesMtd', true)).toBe(false)
  })
})
