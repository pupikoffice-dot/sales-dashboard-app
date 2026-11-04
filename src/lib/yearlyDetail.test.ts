import { describe, expect, it } from 'vitest'
import { buildMonthRows, buildYearTotal, pickableYears, type YearlyDetail } from './yearlyDetail'
import { buildBrandMatrix } from './yearlyOverview'

const detail: YearlyDetail = {
  year: 2025,
  sales: [
    { month: 1, sold: 1000, returned: 100, qtySold: 10, qtyReturned: 1 },
    { month: 2, sold: 500, returned: 0, qtySold: 5, qtyReturned: 0 },
    { month: 4, sold: 800, returned: 200, qtySold: 8, qtyReturned: 2 },
  ],
  receipts: [{ month: 2, cash: 700 }],
  imports: [
    { month: 3, qty: 40, value: null, docs: 2 },
    { month: 4, qty: 10, value: null, docs: 1 },
  ],
  importDocs: 3,
  brandSales: [],
  brandImports: [],
}

describe('yearly detail helpers', () => {
  it('always gives 12 months with net sales, rate and change on the month before', () => {
    const rows = buildMonthRows(detail)
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ month: 1, net: 900, returned: 100, vsPrev: null })
    expect(rows[0].rate).toBeCloseTo(0.1)
    expect(rows[1].vsPrev).toBeCloseTo(-400 / 900)
    expect(rows[2]).toMatchObject({ net: 0, rate: null, vsPrev: -1 })
    expect(rows[3].vsPrev).toBeNull() // March had no sales: no base
  })
  it('keeps months without receipts / imports null, not zero', () => {
    const rows = buildMonthRows(detail)
    expect(rows[0].receipts).toBeNull()
    expect(rows[1].receipts).toBe(700)
    expect(rows[2]).toMatchObject({ importQty: 40, importValue: null, importDocs: 2 })
    expect(rows[11].importQty).toBeNull()
  })
  it('year total equals the sum of the months; import documents are the distinct count', () => {
    const rows = buildMonthRows(detail)
    const t = buildYearTotal(detail)
    expect(t.net).toBe(rows.reduce((a, r) => a + r.net, 0))
    expect(t.returned).toBe(300)
    expect(t.rate).toBeCloseTo(300 / 2300)
    expect(t.receipts).toBe(700)
    expect(t.importQty).toBe(50)
    expect(t.importValue).toBeNull()
    expect(t.importDocs).toBe(3)
  })
  it('an empty year has null receipts and imports', () => {
    const t = buildYearTotal({ ...detail, sales: [], receipts: [], imports: [], importDocs: 0 })
    expect(t).toMatchObject({ net: 0, rate: null, receipts: null, importQty: null, importDocs: null })
  })
  it('lists pickable years newest first, without duplicates', () => {
    expect(pickableYears({ years: [{ year: 2024 }, { year: 2025 }], receipts: [{ year: 2025 }], imports: [{ year: 2026 }] })).toEqual([2026, 2025, 2024])
  })
  it('the brand matrix works with months as columns', () => {
    const m = buildBrandMatrix([
      { year: 2, brand: 'A', value: 5 },
      { year: 1, brand: 'A', value: 3 },
      { year: 1, brand: 'Other', value: 99 },
      { year: 2, brand: 'B', value: 10 },
    ])
    expect(m.years).toEqual([1, 2])
    expect(m.rows.map(r => r.brand)).toEqual(['B', 'A', 'Other'])
    expect(m.rows[1].byYear).toEqual({ 1: 3, 2: 5 })
  })
})
