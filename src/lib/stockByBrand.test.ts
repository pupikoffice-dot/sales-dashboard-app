import { describe, expect, it } from 'vitest'
import {
  brandsForCompany,
  brandTotals,
  companiesWithStock,
  filterBrandRows,
  maskBrandPayloadForPreview,
  sortBrandRows,
  type BrandStockRow,
} from './stockByBrand'

const row = (over: Partial<BrandStockRow>): BrandStockRow => ({
  co: 'pupik', brand: 'Funko', items: 10, inStock: 8, units: 100, value: 1000, noCost: 0, ...over,
})

const rows = [
  row({ brand: 'Funko', units: 100, value: 1000, items: 10, inStock: 8, noCost: 1 }),
  row({ brand: 'Pathfinder', units: 300, value: 500, items: 3, inStock: 3 }),
  row({ brand: 'Alpha', units: 50, value: null, items: 2, inStock: 1, noCost: 1 }),
  row({ co: 'mt', brand: 'Funko', units: 7, value: 70, items: 1, inStock: 1 }),
]

describe('stock by brand helpers', () => {
  it('lists the companies that have stock, in sidebar order', () => {
    expect(companiesWithStock(rows, ['pupik', 'mt', 'grow', 'gold'])).toEqual(['pupik', 'mt'])
    expect(companiesWithStock(rows.filter(r => r.co === 'mt'), ['pupik', 'mt'])).toEqual(['mt'])
  })

  it('totals one company and skips value when it is hidden', () => {
    const p = brandsForCompany(rows, 'pupik')
    expect(p).toHaveLength(3)
    expect(brandTotals(p, true)).toEqual({ items: 15, inStock: 12, units: 450, value: 1500, noCost: 2 })
    expect(brandTotals(p, false).value).toBeNull()
  })

  it('sorts by number or name and filters by brand text', () => {
    const p = brandsForCompany(rows, 'pupik')
    expect(sortBrandRows(p, 'units', 'desc', 450).map(r => r.brand)).toEqual(['Pathfinder', 'Funko', 'Alpha'])
    expect(sortBrandRows(p, 'brand', 'asc', 450).map(r => r.brand)).toEqual(['Alpha', 'Funko', 'Pathfinder'])
    expect(sortBrandRows(p, 'value', 'desc', 450).map(r => r.brand)).toEqual(['Funko', 'Pathfinder', 'Alpha'])
    expect(filterBrandRows(p, ' path ').map(r => r.brand)).toEqual(['Pathfinder'])
    expect(filterBrandRows(p, '')).toHaveLength(3)
  })

  it('preview: keeps only the companies of the previewed user and drops value without cost permission', () => {
    const p = { rows, showValue: true }
    const masked = maskBrandPayloadForPreview(p, { companies: ['pupik'], showItemCost: false })
    expect(masked.rows.every(r => r.co === 'pupik')).toBe(true)
    expect(masked.showValue).toBe(false)
    expect(masked.rows.every(r => r.value === null && r.noCost === null)).toBe(true)
    const kept = maskBrandPayloadForPreview(p, { companies: ['pupik', 'mt'], showItemCost: true })
    expect(kept.rows).toHaveLength(4)
    expect(kept.showValue).toBe(true)
  })
})
