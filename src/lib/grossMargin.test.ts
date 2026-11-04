import { describe, expect, it } from 'vitest'
import {
  attachMargin,
  coveragePercent,
  fmtPct,
  hasMarginData,
  lineMargin,
  linesMargin,
  marginOf,
  overallMargin,
  sumCover,
} from './grossMargin'
import { itemSalesCsv, parseItemSales, summarizeItemSales } from './clientItemSales'

describe('marginOf', () => {
  it('is covered sales minus cost, with % of covered sales and coverage of net sales', () => {
    expect(marginOf({ cost: 600, covered: 900 }, 1000)).toEqual({ margin: 300, pct: 0.3333, coverage: 0.9 })
  })
  it('gives nulls when the user has no cost data or nothing had a cost', () => {
    expect(marginOf(null, 1000)).toEqual({ margin: null, pct: null, coverage: null })
    expect(marginOf({ cost: null, covered: null }, 1000)).toEqual({ margin: null, pct: null, coverage: null })
    expect(marginOf({ cost: 5, covered: null }, 1000).margin).toBeNull()
  })
  it('does not treat a missing cost as zero cost', () => {
    // 1000 of sales, only 400 had a cost (of 300): margin is 100, not 700
    expect(marginOf({ cost: 300, covered: 400 }, 1000).margin).toBe(100)
  })
  it('handles a negative margin and zero covered sales', () => {
    expect(marginOf({ cost: 120, covered: 100 }, 100)).toEqual({ margin: -20, pct: -0.2, coverage: 1 })
    expect(marginOf({ cost: 0, covered: 0 }, 50)).toEqual({ margin: 0, pct: null, coverage: 0 })
  })
  it('has no coverage without positive net sales; accepts numeric strings from the database', () => {
    expect(marginOf({ cost: 1, covered: 2 }, 0).coverage).toBeNull()
    expect(marginOf({ cost: 1, covered: 2 }).coverage).toBeNull()
    expect(marginOf({ cost: '10.5' as unknown as number, covered: '20' as unknown as number }, 20).margin).toBe(9.5)
  })
  it('rounds the margin to cents and the share to 4 decimals', () => {
    const f = marginOf({ cost: 0.1 + 0.2, covered: 1 }, 1)
    expect(f.margin).toBe(0.7)
    expect(marginOf({ cost: 1, covered: 3 }, 3).pct).toBe(0.6667)
  })
})

describe('sumCover / overallMargin / hasMarginData', () => {
  it('adds groups and skips the ones with no cost data', () => {
    expect(sumCover([{ cost: 10, covered: 30 }, { cost: null, covered: null }, undefined, { cost: 5, covered: 10 }])).toEqual({ cost: 15, covered: 40 })
    expect(sumCover([{ cost: null, covered: null }])).toBeNull()
  })
  it('overall margin against all net sales', () => {
    expect(overallMargin([{ cost: 50, covered: 100 }, { cost: 20, covered: 50 }], 200)).toEqual({ margin: 80, pct: 0.5333, coverage: 0.75 })
    expect(overallMargin(null, 200).margin).toBeNull()
  })
  it('detects cost data', () => {
    expect(hasMarginData([])).toBe(false)
    expect(hasMarginData([{ cost: null, covered: null }])).toBe(false)
    expect(hasMarginData([{ cost: 0, covered: 0 }])).toBe(true)
  })
})

describe('line margin', () => {
  it('is cash - qty x unit cost; credits (negative qty and cash) reduce the margin', () => {
    expect(lineMargin(100, 2, 30)).toBe(40)
    expect(lineMargin(-100, -2, 30)).toBe(-40)
    expect(lineMargin(100, 2, null)).toBeNull()
  })
  it('totals only the lines that have a cost', () => {
    const t = linesMargin([
      { cash: 100, qty: 2, unitCost: 30 },
      { cash: 50, qty: 1, unitCost: null },
      { cash: -20, qty: -1, unitCost: 10, isReturn: true },
    ])
    expect(t).toEqual({ cost: 50, covered: 80 })
    expect(linesMargin([{ cash: 20, qty: 1, unitCost: 5, isReturn: true }], { skipReturns: true })).toBeNull()
  })
})

describe('attachMargin', () => {
  it('matches by key, adds entries sharing a key, leaves unmatched rows null', () => {
    const rows = [{ k: 'a', net: 100 }, { k: 'b', net: 50 }]
    const out = attachMargin(rows, [{ k: 'a', cost: 20, covered: 60 }, { k: 'a', cost: 10, covered: 30 }], r => r.k, e => e.k, r => r.net)
    expect(out[0]).toMatchObject({ margin: 60, marginPct: 0.6667, coverage: 0.9 })
    expect(out[1]).toMatchObject({ margin: null, marginPct: null, coverage: null })
    expect(attachMargin(rows, null, r => r.k, () => '', r => r.net)[0].margin).toBeNull()
  })
})

describe('formatting', () => {
  it('formats percent and coverage', () => {
    expect(fmtPct(0.2534)).toBe('25.3%')
    expect(fmtPct(null)).toBe('—')
    expect(coveragePercent(0.934)).toBe(93)
    expect(coveragePercent(0.999)).toBe(99)
    expect(coveragePercent(1)).toBe(100)
    expect(coveragePercent(null)).toBeNull()
  })
})

describe('search sales margin', () => {
  const raw = {
    total: 3,
    margin: true,
    rows: [
      { date: '2026-02-01', docNum: '1', docType: '1', clientID: 'c', sku: 'A', name: 'a', qty: 2, cash: 100, unitCost: 30, isReturn: false },
      { date: '2026-02-02', docNum: '2', docType: '1', clientID: 'c', sku: 'B', name: 'b', qty: 1, cash: 40, unitCost: null, isReturn: false },
      { date: '2026-02-03', docNum: '3', docType: '14', clientID: 'c', sku: 'A', name: 'a', qty: -1, cash: -50, unitCost: 30, isReturn: true },
    ],
  }
  it('parses unit cost and the right-to-see flag', () => {
    const r = parseItemSales(raw)
    expect(r.margin).toBe(true)
    expect(r.rows.map(x => x.unitCost)).toEqual([30, null, 30])
    expect(parseItemSales({ total: 0, rows: [] }).margin).toBe(false)
  })
  it('summary margin covers sold lines with a cost, returns excluded like the other figures', () => {
    const s = summarizeItemSales(parseItemSales(raw).rows)
    expect(s.margin).toEqual({ margin: 40, pct: 0.4, coverage: 0.7143 })
  })
  it('summary margin is null for users without cost access', () => {
    const noCost = { ...raw, margin: false, rows: raw.rows.map(r => ({ ...r, unitCost: null })) }
    expect(summarizeItemSales(parseItemSales(noCost).rows).margin.margin).toBeNull()
  })
  it('csv has margin columns only when asked', () => {
    const rows = parseItemSales(raw).rows
    expect(itemSalesCsv(rows).split('\r\n')[0]).not.toContain('Margin')
    const csv = itemSalesCsv(rows, true).split('\r\n')
    expect(csv[0]).toContain('Margin %')
    expect(csv[1].endsWith('30,40,40')).toBe(true)
    expect(csv[2].endsWith(',,,')).toBe(true)
  })
})
