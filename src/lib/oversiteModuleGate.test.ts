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
    oversiteModules: modules,
  }
}

describe('canShowOversiteModule', () => {
  it('requires salesMtd for deliveryNotes add-on', () => {
    expect(canShowOversiteModule(access(['deliveryNotes']), 'deliveryNotes')).toBe(false)
    expect(canShowOversiteModule(access(['salesMtd', 'deliveryNotes']), 'deliveryNotes')).toBe(true)
  })

  it('super admin bypasses grants', () => {
    expect(canShowOversiteModule(access([]), 'deliveryNotes', true)).toBe(true)
  })
})
