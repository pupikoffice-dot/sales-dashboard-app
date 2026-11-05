import { describe, expect, it } from 'vitest'
import {
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
    { co: 'pupik', sku: 'A1', name: 'Alpha', cat: 'Toys', flaggedAt: '2026-11-05T10:00:00Z', lastStockAt: null, wms: '0', lcat: 'Toys' },
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
    expect(d.toDecide[0]).toMatchObject({ sku: 'A1', wms: 0, lastStockAt: null, lastCategory: 'Toys' })
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
