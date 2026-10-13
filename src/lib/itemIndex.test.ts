import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { filterItemIndex, maskItemIndexForPreview, parseItemIndex } from './itemIndex'
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

  it('preview masking: only the companies and cost columns the previewed user has', () => {
    const idx = parseItemIndex({ ...payload, showFob: true, rows: payload.rows.map(r => ({ ...r, fob: 9, cost: 5 })) })
    const noCost = maskItemIndexForPreview(idx, { companies: ['pupik'], showItemCost: false })
    expect(noCost.rows.every(r => r.co === 'pupik')).toBe(true)
    expect(noCost.showCost).toBe(false)
    expect(noCost.showFob).toBe(false)
    expect(noCost.rows.every(r => r.cost === null && r.fob === null)).toBe(true)
    const costNoFob = maskItemIndexForPreview(idx, { companies: ['pupik', 'mt'], showItemCost: true, hiddenSidebar: ['items.col.fob'] })
    expect(costNoFob.rows.length).toBe(idx.rows.length)
    expect(costNoFob.showCost).toBe(true)
    expect(costNoFob.showFob).toBe(false)
    expect(costNoFob.rows.every(r => r.fob === null)).toBe(true)
    expect(maskItemIndexForPreview(idx, { companies: ['pupik'], showItemCost: true, hiddenSidebar: ['date.items'] }).rows).toEqual([])
  })
})
