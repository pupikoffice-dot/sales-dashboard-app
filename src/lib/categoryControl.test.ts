import { describe, expect, it } from 'vitest'
import {
  DECIDE_PAGE_SIZES,
  EMPTY_DECIDE_FILTERS,
  checkState,
  chunk,
  countSelected,
  facetOptions,
  filterToDecide,
  isoToLocalDay,
  paginate,
  selectKeys,
  type CcToDecide,
  controlCounts,
  filterControlRows,
  formatCcDate,
  groupSelection,
  maskCategoryControlForPreview,
  parseCategoryControl,
  selKey,
  toggleAllVisible,
  toggleKey,
} from './categoryControl'

const payload = {
  canWrite: true,
  canApprove: false,
  toDecide: [
    { co: 'pupik', sku: 'A1', name: 'Alpha', cat: 'Toys', flaggedAt: '2026-11-05T10:00:00Z', lastStockAt: null, wms: '0', lcat: 'Toys', sup: ' S9 ' },
    { co: 'mt', sku: 'B2', name: 'Beta', cat: ' ', flaggedAt: null, lastStockAt: '2026-11-01T00:00:00Z', wms: -2, lcat: null },
  ],
  restore: [{ id: '7', co: 'pupik', sku: 'R1', name: 'Rest', to: 'Toys', reason: 'x', createdAt: null, origin: 'auto', wms: 3 }],
  pending: [{ id: 1, co: 'mt', sku: 'P1', name: 'Pend', action: 'CLEAR', from: 'Toys', to: '', origin: 'decision', decidedBy: 'Dana' }],
  history: [{ id: 2, co: 'mt', sku: 'H1', name: 'Hist', action: 'RESTORE', to: 'Toys', status: 'failed', error: 'boom', attempts: '2', at: null }],
  presale: [{ id: 3, co: 'pupik', sku: 'S1', name: 'Pre', note: '', createdAt: null, by: 'Dana' }],
  exempt: [],
  held: [{ id: 4, co: 'mt', newFlags: '12', newRestores: 1, threshold: 10, catalogItems: 200, status: 'held' }],
}

describe('parseCategoryControl', () => {
  it('normalises numbers, blanks and missing keys', () => {
    const d = parseCategoryControl(payload)
    expect(d.canWrite).toBe(true)
    expect(d.canApprove).toBe(false)
    expect(d.toDecide[0]).toMatchObject({ sku: 'A1', wms: 0, lastStockAt: null, lastCategory: 'Toys', supplier: 'S9' })
    expect(d.toDecide[1].cat).toBeNull()
    expect(d.toDecide[1].wms).toBe(-2)
    expect(d.restore[0]).toMatchObject({ id: 7, to: 'Toys' })
    expect(d.history[0]).toMatchObject({ status: 'failed', attempts: 2, error: 'boom' })
    expect(d.presale[0].note).toBeNull()
    expect(d.held[0]).toMatchObject({ newFlags: 12, status: 'held' })
  })
  it('returns empty, read-only data for junk', () => {
    const d = parseCategoryControl(null)
    expect(d.canWrite).toBe(false)
    expect(d.toDecide).toEqual([])
    expect(parseCategoryControl({ toDecide: 'x' }).toDecide).toEqual([])
  })
})

describe('preview mask', () => {
  it('keeps only the previewed companies and never offers write buttons', () => {
    const d = maskCategoryControlForPreview(parseCategoryControl(payload), ['mt'])
    expect(d.canWrite).toBe(false)
    expect(d.toDecide.map(r => r.sku)).toEqual(['B2'])
    expect(d.restore).toEqual([])
    expect(d.held).toHaveLength(1)
  })
})

describe('filtering and counts', () => {
  const d = parseCategoryControl(payload)
  it('filters by company and search', () => {
    expect(filterControlRows(d.toDecide, 'pupik', '')).toHaveLength(1)
    expect(filterControlRows(d.toDecide, 'all', 'beta')).toHaveLength(1)
    expect(filterControlRows(d.toDecide, 'all', 'toys', r => [r.cat])).toHaveLength(1)
  })
  it('counts per company', () => {
    expect(controlCounts(d)).toEqual({ toDecide: 2, restore: 1, pending: 1, held: 1 })
    expect(controlCounts(d, 'mt')).toEqual({ toDecide: 1, restore: 0, pending: 1, held: 1 })
  })
})

describe('selection', () => {
  const rows = [
    { co: 'pupik', sku: 'A1' },
    { co: 'pupik', sku: 'A2' },
    { co: 'mt', sku: 'B1' },
  ]
  it('toggles one key', () => {
    const a = toggleKey(new Set(), selKey('pupik', 'A1'))
    expect([...a]).toEqual(['pupik|A1'])
    expect(toggleKey(a, 'pupik|A1').size).toBe(0)
  })
  it('select all visible, then clear them, keeping hidden selections', () => {
    const vis = ['pupik|A1', 'pupik|A2']
    const all = toggleAllVisible(new Set(['mt|B1']), vis)
    expect([...all].sort()).toEqual(['mt|B1', 'pupik|A1', 'pupik|A2'])
    expect([...toggleAllVisible(all, vis)]).toEqual(['mt|B1'])
    expect(toggleAllVisible(new Set(), []).size).toBe(0)
  })
  it('groups by company and drops rows that are no longer listed', () => {
    const g = groupSelection(new Set(['pupik|A1', 'pupik|A2', 'mt|B1', 'mt|GONE']), rows)
    expect(g.get('pupik')).toEqual(['A1', 'A2'])
    expect(g.get('mt')).toEqual(['B1'])
    expect(g.size).toBe(2)
  })
})

describe('formatCcDate', () => {
  it('formats and tolerates junk', () => {
    expect(formatCcDate(null)).toBe('')
    expect(formatCcDate('nope')).toBe('')
    expect(formatCcDate('2026-11-05T12:00:00')).toBe('05/11/2026')
  })
})

const mk = (i: number, over: Partial<CcToDecide> = {}): CcToDecide => ({
  co: 'pupik', sku: `SKU${i}`, name: `Item ${i}`, cat: i % 2 ? 'Toys' : 'Games', flaggedAt: null, lastStockAt: null, wms: 0, lastCategory: null, supplier: i % 3 ? 'S1' : 'S2', ...over,
})

describe('filterToDecide', () => {
  const rows = [
    mk(1, { name: 'Red car', lastStockAt: '2026-03-10T12:00:00' }),
    mk(2, { name: 'Blue ball', lastStockAt: '2026-05-01T12:00:00' }),
    mk(3, { name: 'Green', cat: null, lastCategory: 'Old' }),
  ]
  it('returns everything with empty filters', () => expect(filterToDecide(rows, EMPTY_DECIDE_FILTERS)).toHaveLength(3))
  it('searches sku, name, category and last category', () => {
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, query: 'car' }).map(r => r.sku)).toEqual(['SKU1'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, query: 'sku2' }).map(r => r.sku)).toEqual(['SKU2'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, query: 'old' }).map(r => r.sku)).toEqual(['SKU3'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, query: 'games' }).map(r => r.sku)).toEqual(['SKU2'])
  })
  it('filters by exact category and supplier', () => {
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, category: 'Toys' }).map(r => r.sku)).toEqual(['SKU1'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, supplier: 'S2' }).map(r => r.sku)).toEqual(['SKU3'])
  })
  it('filters by last stock date range; unknown dates never match a set bound', () => {
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, stockFrom: '2026-04-01' }).map(r => r.sku)).toEqual(['SKU2'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, stockTo: '2026-03-10' }).map(r => r.sku)).toEqual(['SKU1'])
    expect(filterToDecide(rows, { ...EMPTY_DECIDE_FILTERS, stockFrom: '2026-03-01', stockTo: '2026-05-01' }).map(r => r.sku)).toEqual(['SKU1', 'SKU2'])
  })
  it('parses a local day', () => {
    expect(isoToLocalDay('2026-03-10T12:00:00')).toBe('2026-03-10')
    expect(isoToLocalDay('bad')).toBe('')
    expect(isoToLocalDay(null)).toBe('')
  })
})

describe('facetOptions', () => {
  it('counts, drops blanks, sorts by frequency then name', () => {
    expect(facetOptions(['b', 'a', 'b', null, ' ', 'c', 'a', 'b'])).toEqual([
      { value: 'b', count: 3 },
      { value: 'a', count: 2 },
      { value: 'c', count: 1 },
    ])
  })
})

describe('paginate', () => {
  const rows = Array.from({ length: 250 }, (_, i) => i)
  it('slices pages', () => {
    const p = paginate(rows, 2, 100)
    expect(p.rows[0]).toBe(100)
    expect(p).toMatchObject({ page: 2, pages: 3, total: 250, from: 101, to: 200 })
    expect(paginate(rows, 3, 100)).toMatchObject({ from: 201, to: 250 })
  })
  it('clamps the page and handles empty lists', () => {
    expect(paginate(rows, 99, 100).page).toBe(3)
    expect(paginate(rows, -4, 100).page).toBe(1)
    expect(paginate([], 1, 100)).toMatchObject({ page: 1, pages: 1, total: 0, from: 0, to: 0, rows: [] })
  })
  it('offers sane sizes', () => expect(DECIDE_PAGE_SIZES).toContain(100))
})

describe('selection helpers', () => {
  it('selects a page and all filtered rows additively', () => {
    const start = new Set(['x'])
    expect([...selectKeys(start, ['a', 'b'])].sort()).toEqual(['a', 'b', 'x'])
    expect(start.size).toBe(1)
  })
  it('counts and reports the header checkbox state', () => {
    const sel = new Set(['a', 'b'])
    expect(countSelected(sel, ['a', 'b', 'c'])).toBe(2)
    expect(checkState(sel, ['a', 'b'])).toBe('all')
    expect(checkState(sel, ['a', 'c'])).toBe('some')
    expect(checkState(sel, ['c'])).toBe('none')
    expect(checkState(sel, [])).toBe('none')
  })
  it('select-all-filtered then groupSelection covers more than one page', () => {
    const filtered = Array.from({ length: 300 }, (_, i) => mk(i))
    const keys = filtered.map(r => selKey(r.co, r.sku))
    const g = groupSelection(selectKeys(new Set(), keys), filtered)
    expect(g.get('pupik')).toHaveLength(300)
  })
})

describe('chunk', () => {
  it('splits into slices', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk([1], 0)).toEqual([[1]])
  })
})
