import { describe, expect, it } from 'vitest'
import {
  brandsForCompany,
  brandTotals,
  companiesWithStock,
  filterBrandRows,
  fmtK,
  itemsForBrand,
  maskBrandPayloadForPreview,
  maskStockItemsForPreview,
  parseStockItems,
  pieSlices,
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

  it('pie: biggest brands plus one Other slice, empty brands left out', () => {
    const many = Array.from({ length: 12 }, (_, i) => row({ brand: `B${i}`, units: 100 - i * 5 }))
    many.push(row({ brand: 'Empty', units: 0 }))
    const s = pieSlices(many, 9)
    expect(s).toHaveLength(10)
    expect(s[0]).toEqual({ label: 'B0', units: 100 })
    expect(s[9]).toEqual({ label: 'Other', units: 100 - 9 * 5 + (100 - 10 * 5) + (100 - 11 * 5) })
    expect(s.some(x => x.label === 'Empty')).toBe(false)
    expect(pieSlices(many.slice(0, 5), 9)).toHaveLength(5)
  })

  it('pie by cash: uses value at cost and skips brands without a value', () => {
    const r = [
      row({ brand: 'A', units: 10, value: 500 }),
      row({ brand: 'B', units: 900, value: 100 }),
      row({ brand: 'C', units: 50, value: null }),
    ]
    expect(pieSlices(r, 9, 'Other', 'value')).toEqual([{ label: 'A', units: 500 }, { label: 'B', units: 100 }])
    expect(pieSlices(r, 9, 'Other', 'units').map(x => x.label)).toEqual(['B', 'C', 'A'])
  })

  it('formats thousands as K', () => {
    expect(fmtK(0)).toBe('0')
    expect(fmtK(950)).toBe('950')
    expect(fmtK(1000)).toBe('1K')
    expect(fmtK(1234)).toBe('1.2K')
    expect(fmtK(56700)).toBe('56.7K')
    expect(fmtK(1410132)).toBe('1,410K')
    expect(fmtK(-2500)).toBe('-2.5K')
  })

  it('items of a brand: biggest value first, no-cost items after, zero stock last', () => {
    const items = parseStockItems({
      showValue: true,
      rows: [
        { co: 'pupik', brand: 'Funko', sku: 'F-1', name: 'a', qty: 10, cost: '5' }, // 50
        { co: 'pupik', brand: 'Funko', sku: 'F-2', name: 'b', qty: 2, cost: 100 }, // 200
        { co: 'pupik', brand: 'Funko', sku: 'F-3', name: 'c', qty: 40, cost: null }, // no cost
        { co: 'pupik', brand: 'Funko', sku: 'F-4', name: 'd', qty: 0, cost: 9 }, // 0
        { co: 'pupik', brand: 'Other', sku: 'O-1', name: 'e', qty: 1, cost: 1 },
        { co: 'mt', brand: 'Funko', sku: 'M-1', name: 'f', qty: 99, cost: 99 },
      ],
    }).rows
    expect(itemsForBrand(items, 'pupik', 'Funko', true).map(r => r.sku)).toEqual(['F-2', 'F-1', 'F-4', 'F-3'])
    expect(itemsForBrand(items, 'pupik', 'Funko', false).map(r => r.sku)).toEqual(['F-3', 'F-1', 'F-2', 'F-4'])
    expect(itemsForBrand(items, 'pupik', 'Funko', true)[0].value).toBe(200)
  })

  it('preview: item list keeps allowed companies and hides cost without permission', () => {
    const p = parseStockItems({
      showValue: true,
      rows: [
        { co: 'pupik', brand: 'A', sku: 'A-1', name: 'x', qty: 1, cost: 4 },
        { co: 'mt', brand: 'A', sku: 'A-2', name: 'y', qty: 1, cost: 4 },
      ],
    })
    const m = maskStockItemsForPreview(p, { companies: ['pupik'], showItemCost: false })
    expect(m.rows).toHaveLength(1)
    expect(m.showValue).toBe(false)
    expect(m.rows[0].cost).toBeNull()
  })
})
