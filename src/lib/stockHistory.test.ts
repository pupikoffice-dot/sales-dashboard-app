import { describe, expect, it } from 'vitest'
import { filterStockHistory, isoDay, stockHistoryTotals, type StockHistoryRow } from './stockHistory'

const rows: StockHistoryRow[] = [
  { day: '2026-10-01', sku: 'A-1', name: 'Alpha toy', open: 5, close: 4, est: true },
  { day: '2026-10-01', sku: 'B-2', name: 'Beta game', open: 0, close: 10, est: true },
  { day: '2026-10-02', sku: 'A-1', name: 'Alpha toy', open: 4, close: 3, est: false },
  { day: '2026-10-02', sku: 'B-2', name: 'Beta game', open: 10, close: 9, est: false },
]

describe('stock history helpers', () => {
  it('filters by SKU or name', () => {
    expect(filterStockHistory(rows, 'beta').map(r => r.sku)).toEqual(['B-2', 'B-2'])
    expect(filterStockHistory(rows, 'a-1')).toHaveLength(2)
    expect(filterStockHistory(rows, '  ')).toHaveLength(4)
  })
  it('totals: opening of the first day, closing of the last day', () => {
    expect(stockHistoryTotals(rows)).toEqual({ open: 5, close: 12 })
    expect(stockHistoryTotals([])).toEqual({ open: 0, close: 0 })
  })
  it('formats a local day', () => {
    expect(isoDay(new Date(2026, 9, 3))).toBe('2026-10-03')
  })
})
