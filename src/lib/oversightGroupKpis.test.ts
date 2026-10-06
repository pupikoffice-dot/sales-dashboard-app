import { describe, expect, it } from 'vitest'
import { computeGroupKpis, salesLyToDate, type GroupKpiInput } from './oversightGroupKpis'
import type { SalesRow } from '../types/dashboard'

const col = (o: Partial<{ sales: number; ly: number; d720: number; debt: number | null }>): GroupKpiInput => ({
  salesMtd: { cash: o.sales ?? 0, lyCash: 999999 },
  salesLyToDate: o.ly ?? 0,
  delivery720Mtd: { cash: o.d720 ?? 0 },
  ordersToday: { clients: 2, cash: 100 },
  ordersMtd: { clients: 5, cash: 1000 },
  openOrders: { qty: 7, cash: 300 },
  returnsMtd: { cash: 40 },
  debtSummary: o.debt === null ? null : { grandTotal: o.debt ?? 0 },
})

const all = { show: () => true, includeDeliveryNotes: false }

describe('computeGroupKpis', () => {
  it('sums the companies on screen', () => {
    const k = computeGroupKpis([col({ sales: 600, ly: 500, debt: 10 }), col({ sales: 400, ly: 500, debt: null })], all)
    const by = Object.fromEntries(k.map(x => [x.id, x]))
    expect(by.salesMtd.value).toBe(1000)
    expect(by.salesMtd.lyPct).toBe(0)
    expect(by.ordersToday.value).toBe(200)
    expect(by.ordersToday.sub).toBe(4)
    expect(by.openOrders.sub).toBe(14)
    expect(by.debt.value).toBe(10)
    expect(by.returns.value).toBe(80)
  })

  it('adds delivery notes to sales only when that module is on', () => {
    const cols = [col({ sales: 100, ly: 100, d720: 50 })]
    expect(computeGroupKpis(cols, all)[0].value).toBe(100)
    const withNotes = computeGroupKpis(cols, { ...all, includeDeliveryNotes: true })[0]
    expect(withNotes.value).toBe(150)
    expect(withNotes.lyPct).toBe(50)
  })

  it('has no change % when last year is zero', () => {
    expect(computeGroupKpis([col({ sales: 100, ly: 0 })], all)[0].lyPct).toBeNull()
  })

  it('hides cards for sections the user may not see', () => {
    const k = computeGroupKpis([col({})], { show: id => id !== 'debt' && id !== 'returns', includeDeliveryNotes: false })
    expect(k.map(x => x.id)).toEqual(['salesMtd', 'ordersToday', 'ordersMtd', 'openOrders'])
  })

  it('last year to date counts only days 1..today of the same month', () => {
    const rows = [
      { company: 'pupik', year: 2025, month: 10, date: '2025-10-03', cash: 100 },
      { company: 'pupik', year: 2025, month: 10, date: '2025-10-06', cash: 50 },
      { company: 'pupik', year: 2025, month: 10, date: '2025-10-07', cash: 999 },
      { company: 'pupik', year: 2025, month: 9, date: '2025-09-03', cash: 999 },
      { company: 'mt', year: 2025, month: 10, date: '2025-10-01', cash: 999 },
    ] as unknown as SalesRow[]
    expect(salesLyToDate(rows, 'pupik', 2026, 10, 6)).toBe(150)
  })

  it('returns nothing without companies', () => {
    expect(computeGroupKpis([], all)).toEqual([])
  })
})
