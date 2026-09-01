import { describe, expect, it } from 'vitest'

import { filterDebtRows } from './debtMetrics'
import {
  canShowClientProfit,
  canShowItemCost,
  canShowModule,
  filterRows,
} from './permissions'
import type { DashboardAccess, DebtRow, SalesRow } from '../types/dashboard'

/**
 * These tests pin the CURRENT client-side permission semantics.
 *
 * They exist because that logic is being moved server-side into `resolve_access`
 * (see the class/permission plan). When it moves, these are the spec the SQL must
 * reproduce — especially the two non-obvious rules called out below. Any change
 * here should be a deliberate decision, not a silent drift.
 */

function access(over: Partial<DashboardAccess> = {}): DashboardAccess {
  return {
    userId: 'u1',
    modules: ['oversite'],
    companies: ['pupik'],
    agents: null,
    defaultModule: 'oversite',
    active: true,
    showItemCost: false,
    showClientProfit: false,
    oversiteModules: [],
    ...over,
  }
}

const row = (company: string, agent?: string): SalesRow =>
  ({ company, agent }) as SalesRow

const debt = (company: string, agent?: string): DebtRow =>
  ({ company, agent }) as unknown as DebtRow

describe('filterRows — sales row scoping', () => {
  it('keeps only rows in an allowed company', () => {
    const rows = [row('pupik'), row('mt'), row('grow')]
    expect(filterRows(access({ companies: ['pupik'] }), rows)).toEqual([row('pupik')])
  })

  it('resolves tagged company variants back to their logical company', () => {
    // 'orders-mt' / 'openorders' / 'returns-mt' all belong to a logical company.
    // A user scoped to 'mt' must see mt's orders and returns, not just bare 'mt'.
    const rows = [row('orders-mt'), row('returns-mt'), row('mt'), row('orders-pupik')]
    const kept = filterRows(access({ companies: ['mt'] }), rows)
    expect(kept.map(r => r.company)).toEqual(['orders-mt', 'returns-mt', 'mt'])
  })

  it("maps bare 'openorders' to pupik", () => {
    // Legacy quirk: pupik's open orders are tagged 'openorders' with no suffix.
    expect(filterRows(access({ companies: ['pupik'] }), [row('openorders')])).toHaveLength(1)
    expect(filterRows(access({ companies: ['mt'] }), [row('openorders')])).toHaveLength(0)
  })

  it('drops rows whose company tag is unrecognised', () => {
    expect(filterRows(access({ companies: ['pupik'] }), [row('not-a-company')])).toEqual([])
  })

  it('restricts to the listed agents when agents is a non-empty array', () => {
    const rows = [row('pupik', 'A1'), row('pupik', 'A2'), row('pupik', 'A3')]
    const kept = filterRows(access({ agents: ['A1', 'A3'] }), rows)
    expect(kept.map(r => r.agent)).toEqual(['A1', 'A3'])
  })

  it('treats agents:null as ALL agents', () => {
    const rows = [row('pupik', 'A1'), row('pupik', 'A2')]
    expect(filterRows(access({ agents: null }), rows)).toHaveLength(2)
  })

  it('treats agents:[] as ALL agents, not none', () => {
    // Non-obvious and load-bearing: the guard is `length > 0`, so an empty array
    // is "no agent restriction". Server-side this must map to agents_all = true,
    // NOT to an empty allow-list, or every such user silently loses all data.
    const rows = [row('pupik', 'A1'), row('pupik', 'A2')]
    expect(filterRows(access({ agents: [] }), rows)).toHaveLength(2)
  })

  it('applies company and agent scope together', () => {
    const rows = [row('pupik', 'A1'), row('mt', 'A1'), row('pupik', 'A2')]
    const kept = filterRows(access({ companies: ['pupik'], agents: ['A1'] }), rows)
    expect(kept).toEqual([row('pupik', 'A1')])
  })
})

describe('filterDebtRows — debt row scoping', () => {
  it('keeps only rows in an allowed company', () => {
    const rows = [debt('pupik'), debt('mt')]
    expect(filterDebtRows(access({ companies: ['pupik'] }), rows)).toEqual([debt('pupik')])
  })

  it('does NOT resolve tagged company variants (diverges from filterRows)', () => {
    // Documented divergence, not an endorsement: debt rows compare the raw string,
    // so a tagged company would be dropped here but kept by filterRows. Debt data
    // currently only ever carries bare company names, which is why this is latent.
    // The server-side version should use ONE rule for both.
    expect(filterDebtRows(access({ companies: ['mt'] }), [debt('orders-mt')])).toEqual([])
  })

  it('restricts to the listed agents, and treats null/[] as ALL', () => {
    const rows = [debt('pupik', 'A1'), debt('pupik', 'A2')]
    expect(filterDebtRows(access({ agents: ['A1'] }), rows)).toEqual([debt('pupik', 'A1')])
    expect(filterDebtRows(access({ agents: null }), rows)).toHaveLength(2)
    expect(filterDebtRows(access({ agents: [] }), rows)).toHaveLength(2)
  })
})

describe('field permissions', () => {
  it('denies cost and profit by default', () => {
    expect(canShowItemCost(access())).toBe(false)
    expect(canShowClientProfit(access())).toBe(false)
  })

  it('grants when the flag is set', () => {
    expect(canShowItemCost(access({ showItemCost: true }))).toBe(true)
    expect(canShowClientProfit(access({ showClientProfit: true }))).toBe(true)
  })

  it('denies when the access row is inactive, even with the flag set', () => {
    const inactive = access({ active: false, showItemCost: true, showClientProfit: true })
    expect(canShowItemCost(inactive)).toBe(false)
    expect(canShowClientProfit(inactive)).toBe(false)
  })

  it('denies when there is no access row at all', () => {
    expect(canShowItemCost(null)).toBe(false)
    expect(canShowClientProfit(null)).toBe(false)
  })

  it('super admin bypasses both flags, and even a null access row', () => {
    expect(canShowItemCost(null, true)).toBe(true)
    expect(canShowClientProfit(null, true)).toBe(true)
    expect(canShowItemCost(access({ active: false }), true)).toBe(true)
  })
})

describe('module visibility', () => {
  it('grants a non-restricted module that is in the user list', () => {
    expect(canShowModule(access({ modules: ['oversite'] }), 'oversite')).toBe(true)
  })

  it('denies a module absent from the user list', () => {
    expect(canShowModule(access({ modules: [] }), 'oversite')).toBe(false)
  })

  it('grants any module present in the user access list', () => {
    expect(canShowModule(access({ modules: ['debt'] }), 'debt')).toBe(true)
    expect(canShowModule(access({ modules: ['stock'] }), 'stock')).toBe(true)
    expect(canShowModule(access({ modules: ['sales_performance'] }), 'sales_performance')).toBe(true)
  })

  it('grants everything to a super admin', () => {
    expect(canShowModule(access({ modules: [] }), 'debt', true)).toBe(true)
  })

  it('denies everything when the access row is inactive, super admin included', () => {
    expect(canShowModule(access({ active: false }), 'oversite', true)).toBe(false)
  })

  it('denies when there is no access row', () => {
    expect(canShowModule(null, 'oversite')).toBe(false)
  })
})
