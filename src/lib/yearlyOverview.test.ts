import { describe, expect, it } from 'vitest'
import { buildBrandMatrix, buildYearRows, type YearlyOverview } from './yearlyOverview'

const overview: YearlyOverview = {
  years: [
    { year: 2024, sold: 1000, returned: 100, qtySold: 10, qtyReturned: 1 },
    { year: 2025, sold: 1500, returned: 300, qtySold: 15, qtyReturned: 3 },
  ],
  receipts: [{ year: 2025, cash: 900 }],
  imports: [{ year: 2026, qty: 50, value: null, docs: 2 }],
  brandSales: [],
  brandImports: [],
}

describe('yearly overview helpers', () => {
  it('builds a row per year with net sales, return rate and change on the year before', () => {
    const rows = buildYearRows(overview)
    expect(rows.map(r => r.year)).toEqual([2024, 2025, 2026])
    expect(rows[0]).toMatchObject({ net: 900, returned: 100, vsPrev: null })
    expect(rows[0].rate).toBeCloseTo(0.1)
    expect(rows[1].net).toBe(1200)
    expect(rows[1].vsPrev).toBeCloseTo(300 / 900)
    expect(rows[1].receipts).toBe(900)
    expect(rows[0].receipts).toBeNull()
  })
  it('keeps missing imports and receipts null, not zero, and has no rate without sales', () => {
    const rows = buildYearRows(overview)
    expect(rows[0].importQty).toBeNull()
    expect(rows[2]).toMatchObject({ importQty: 50, importValue: null, rate: null, net: 0 })
  })
  it('builds a brand x year matrix sorted by total with Other last', () => {
    const m = buildBrandMatrix([
      { year: 2025, brand: 'Other', value: 500 },
      { year: 2025, brand: 'Funko', value: 100 },
      { year: 2026, brand: 'Funko', value: 50 },
      { year: 2026, brand: 'Bandai', value: 300 },
    ])
    expect(m.years).toEqual([2025, 2026])
    expect(m.rows.map(r => r.brand)).toEqual(['Bandai', 'Funko', 'Other'])
    expect(m.rows[1]).toMatchObject({ total: 150, byYear: { 2025: 100, 2026: 50 } })
  })
})
