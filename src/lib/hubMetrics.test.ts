import { describe, expect, it } from 'vitest'
import {
  addDays, agentLeaderboard, agentMonthHeatmap, categoryByMonth, dailySeries, lastMonths, monthlySales, squarify, topItems,
} from './hubMetrics'
import type { SalesRow } from '../types/dashboard'

const r = (o: Partial<SalesRow> & { company: string }): SalesRow => o as SalesRow

describe('hub metrics', () => {
  it('lastMonths crosses the year boundary, oldest first', () => {
    expect(lastMonths({ curYear: 2026, curMonth: 2 }, 3).map(m => m.ym)).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('addDays handles month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('dailySeries fills every day and counts orders and clients once', () => {
    const rows = [
      r({ company: 'orders-pupik', date: '2026-10-05', cash: 10, qty: 1, docNum: 'D1', clientID: 'C1' }),
      r({ company: 'orders-pupik', date: '2026-10-05', cash: 5, qty: 2, docNum: 'D1', clientID: 'C1' }),
      r({ company: 'orders-mt', date: '2026-10-06', cash: 7, docNum: 'D1', clientID: 'C1' }),
      r({ company: 'pupik', date: '2026-10-06', cash: 999 }),
    ]
    const s = dailySeries(rows, new Set(['orders-pupik', 'orders-mt']), '2026-10-04', '2026-10-06')
    expect(s.map(d => d.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06'])
    expect(s[1]).toMatchObject({ cash: 15, qty: 3, orders: 1, clients: 1 })
    expect(s[2]).toMatchObject({ cash: 7, orders: 1 })
  })

  it('agentLeaderboard groups by company and agent within the dates', () => {
    const tags = new Map([['orders-pupik', 'pupik' as const], ['orders-mt', 'mt' as const]])
    const rows = [
      r({ company: 'orders-pupik', date: '2026-10-02', agent: '24', cash: 100, clientID: 'A' }),
      r({ company: 'orders-pupik', date: '2026-10-03', agent: '24', cash: 50, clientID: 'B' }),
      r({ company: 'orders-mt', date: '2026-10-03', agent: '24', cash: 70, clientID: 'A' }),
      r({ company: 'orders-pupik', date: '2026-09-30', agent: '24', cash: 999 }),
    ]
    const lb = agentLeaderboard(rows, tags, '2026-10-01', '2026-10-06')
    expect(lb.map(a => [a.company, a.agent, a.cash, a.clients])).toEqual([['pupik', '24', 150, 2], ['mt', '24', 70, 1]])
  })

  it('monthly sales, heatmap, top items and categories use only the selected companies', () => {
    const months = lastMonths({ curYear: 2026, curMonth: 10 }, 2)
    const rows = [
      r({ company: 'pupik', year: 2026, month: 9, agent: '24', cash: 100, itemSKU: 'S1', itemName: 'One', tabletCat: 'Toys' }),
      r({ company: 'pupik', year: 2026, month: 10, agent: '24', cash: 40, itemSKU: 'S1', itemName: 'One', tabletCat: 'Toys' }),
      r({ company: 'pupik', year: 2026, month: 10, agent: '27', cash: 60, itemSKU: 'S2', tabletCat: '' }),
      r({ company: 'grow', year: 2026, month: 10, agent: '9', cash: 500, itemSKU: 'G1' }),
    ]
    const cos = new Set(['pupik'])
    expect(monthlySales(rows, cos, months).map(m => m.cash)).toEqual([100, 100])
    const hm = agentMonthHeatmap(rows, cos, months, () => 'P')
    expect(hm.rows.map(x => [x.label, x.values])).toEqual([['P · 24', [100, 40]], ['P · 27', [0, 60]]])
    expect(hm.max).toBe(100)
    expect(topItems(rows, cos, 2026, 10).map(t => [t.sku, t.label, t.cash])).toEqual([['S2', 'S2', 60], ['S1', 'One', 40]])
    const cats = categoryByMonth(rows, cos, months, 'Other')
    expect(cats.series).toEqual([{ label: 'Toys', values: [100, 40] }, { label: 'Other', values: [0, 60] }])
  })

  it('squarify fills the unit square with areas proportional to the values', () => {
    const rects = squarify([6, 6, 4, 3, 2, 2, 1])
    const total = rects.reduce((s, q) => s + q.w * q.h, 0)
    expect(total).toBeCloseTo(1, 6)
    expect(rects[0].w * rects[0].h).toBeCloseTo(6 / 24, 6)
    for (const q of rects) {
      expect(q.x).toBeGreaterThanOrEqual(-1e-9)
      expect(q.y).toBeGreaterThanOrEqual(-1e-9)
      expect(q.x + q.w).toBeLessThanOrEqual(1 + 1e-9)
      expect(q.y + q.h).toBeLessThanOrEqual(1 + 1e-9)
    }
    expect(squarify([0, 0]).every(q => q.w === 0)).toBe(true)
  })
})
