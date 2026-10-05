import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { filterItemIndex, parseItemIndex } from './itemIndex'
import { SIDEBAR_HIDE_OPTIONS } from './sidebarHide'

const payload = {
  showCost: true,
  showFob: false,
  rows: [
    { co: 'pupik', sku: '3DM-0001', name: 'סדנת יצירה', alt: '81000', bc: '69545810000', cat: 'פרימיום', p01: '125', cost: 49.15, fob: null, wms: 12 },
    { co: 'mt', sku: 'FFG-0002', name: 'Cosmic Encounter', alt: 'CE01', bc: '9781589944961', cat: 'FUNKO', p01: 147.5, cost: null, fob: null, wms: null },
  ],
}

describe('parseItemIndex', () => {
  it('normalises numbers and flags', () => {
    const idx = parseItemIndex(payload)
    expect(idx.showCost).toBe(true)
    expect(idx.showFob).toBe(false)
    expect(idx.rows[0].p01).toBe(125)
    expect(idx.rows[1].wms).toBeNull()
  })
  it('handles an empty or broken payload', () => {
    expect(parseItemIndex(null).rows).toEqual([])
    expect(parseItemIndex({ rows: 'x' }).rows).toEqual([])
  })
})

describe('filterItemIndex', () => {
  const rows = parseItemIndex(payload).rows
  it('filters by company', () => {
    expect(filterItemIndex(rows, 'mt', '').map(r => r.sku)).toEqual(['FFG-0002'])
    expect(filterItemIndex(rows, 'all', '')).toHaveLength(2)
  })
  it('searches SKU, name, alternate number, barcode and category', () => {
    expect(filterItemIndex(rows, 'all', 'ce01').map(r => r.sku)).toEqual(['FFG-0002'])
    expect(filterItemIndex(rows, 'all', '6954581').map(r => r.sku)).toEqual(['3DM-0001'])
    expect(filterItemIndex(rows, 'all', 'funko').map(r => r.sku)).toEqual(['FFG-0002'])
    expect(filterItemIndex(rows, 'all', 'cosmic').map(r => r.sku)).toEqual(['FFG-0002'])
  })
})

describe('hide keys', () => {
  it('registers the Items tab and the cost / FOB column keys', () => {
    const ids = SIDEBAR_HIDE_OPTIONS.map(o => o.id)
    expect(ids).toEqual(expect.arrayContaining(['date.items', 'items.col.cost', 'items.col.fob']))
  })
})
