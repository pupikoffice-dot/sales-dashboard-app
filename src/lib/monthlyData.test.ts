import { describe, expect, it } from 'vitest'
import {
  availableYears,
  combinePicks,
  receiptsByMonth,
  salesByDay,
  salesByMonth,
  summarize,
  RECEIPTS_VAT_RATE,
} from './monthlyData'
import type { SalesRow } from '../types/dashboard'

const r = (company: string, date: string, cash: number): SalesRow => ({
  company,
  date,
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  cash,
})

const rows = [
  r('pupik', '2025-03-05', 100),
  r('pupik', '2025-03-20', 50),
  r('pupik', '2026-03-01', 400),
  r('pupik', '2026-04-10', 70),
  r('orders-pupik', '2026-03-02', 9999), // orders are not sales
  r('mt', '2026-03-03', 5),
]

describe('monthly data', () => {
  it('lists the years that have sales or receipts for one company', () => {
    expect(availableYears(rows, undefined, 'pupik')).toEqual([2025, 2026])
    expect(availableYears(rows, { '2024-12': 10 }, 'pupik')).toEqual([2024, 2025, 2026])
    expect(availableYears(rows, undefined, 'mt')).toEqual([2026])
    expect(availableYears(rows, undefined, 'gold')).toEqual([])
  })

  it('combines chosen years and months, oldest first', () => {
    expect(combinePicks([2026, 2025], [4, 3])).toEqual([
      { year: 2025, month: 3 }, { year: 2025, month: 4 }, { year: 2026, month: 3 }, { year: 2026, month: 4 },
    ])
  })

  it('adds sales per chosen month for the company only', () => {
    const picks = combinePicks([2025, 2026], [3])
    const m = salesByMonth(rows, 'pupik', picks)
    expect(m.get(2025 * 12 + 2)).toBe(150)
    expect(m.get(2026 * 12 + 2)).toBe(400)
    expect(m.get(2026 * 12 + 3)).toBeUndefined() // April was not chosen
  })

  it('splits one month by day', () => {
    const d = salesByDay(rows, 'pupik', 2025, 3)
    expect(d).toHaveLength(31)
    expect(d[4]).toBe(100)
    expect(d[19]).toBe(50)
    expect(d.reduce((a, b) => a + b, 0)).toBe(150)
  })

  it('turns gross receipts into net and builds the summary with a receipts/sales ratio', () => {
    const picks = combinePicks([2026], [3, 4])
    const rec = receiptsByMonth({ '2026-03': 590 }, picks)
    expect(rec.get(2026 * 12 + 2)).toBeCloseTo(590 / RECEIPTS_VAT_RATE)
    const s = summarize(picks, salesByMonth(rows, 'pupik', picks), rec)
    expect(s[0]).toMatchObject({ year: 2026, month: 3, sales: 400, receipts: 500 })
    expect(s[0].ratio).toBeCloseTo(125)
    expect(s[1]).toMatchObject({ month: 4, sales: 70, receipts: null, ratio: null })
  })
})
