import { describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

import {
  fetchClientItemSales,
  itemSalesCsv,
  parseItemSales,
  pricePoints,
  queryReady,
  summarizeItemSales,
  type ItemSalesLine,
} from './clientItemSales'

const line = (o: Partial<ItemSalesLine>): ItemSalesLine => ({
  date: '2026-01-01',
  docNum: '1',
  docType: '1',
  clientID: 'c',
  sku: 'A-1',
  name: 'Item, one',
  qty: 1,
  cash: 10,
  price: 10,
  discountPct: null,
  discountCash: null,
  isReturn: false,
  unitCost: null,
  ...o,
})

describe('parseItemSales', () => {
  it('parses numbers sent as strings and tolerates junk', () => {
    const r = parseItemSales({
      total: '2',
      rows: [{ date: '2026-02-03', docNum: 7, sku: 'X', qty: '3', cash: '30.5', price: '10.1667', discountPct: null, isReturn: true }, {}],
    })
    expect(r.total).toBe(2)
    expect(r.rows[0]).toMatchObject({ docNum: '7', qty: 3, cash: 30.5, price: 10.1667, discountPct: null, isReturn: true })
    expect(r.rows[1]).toMatchObject({ qty: 0, price: null, isReturn: false })
    expect(parseItemSales(null)).toEqual({ total: 0, margin: false, rows: [] })
  })
})

describe('summarizeItemSales', () => {
  it('totals sold lines, weights the average price and keeps credits apart', () => {
    const s = summarizeItemSales([
      line({ date: '2026-03-01', docNum: '1', qty: 10, cash: 100, price: 10 }),
      line({ date: '2025-01-05', docNum: '1', qty: 10, cash: 120, price: 12 }),
      line({ date: '2025-06-01', docNum: '2', qty: 5, cash: 40, price: 8 }),
      line({ date: '2025-07-01', docNum: '9', docType: '14', qty: -2, cash: -24, price: 12, isReturn: true }),
    ])
    expect(s.lines).toBe(3)
    expect(s.qty).toBe(25)
    expect(s.amount).toBe(260)
    expect(s.avgPrice).toBeCloseTo(10.4)
    expect(s.minPrice).toBe(8)
    expect(s.maxPrice).toBe(12)
    expect(s.firstDate).toBe('2025-01-05')
    expect(s.lastDate).toBe('2026-03-01')
    expect(s.invoices).toBe(2)
    expect(s.creditQty).toBe(2)
    expect(s.creditAmount).toBe(24)
  })
  it('books non-return credits as negative sales and keeps them out of min/max price', () => {
    const s = summarizeItemSales([
      line({ qty: 10, cash: 100, price: 10 }),
      line({ docNum: '5', docType: '14', qty: -1, cash: -9, price: 9 }),
    ])
    expect(s.qty).toBe(9)
    expect(s.amount).toBe(91)
    expect(s.minPrice).toBe(10)
    expect(s.creditQty).toBe(0)
  })
  it('counts the same document number of different types as different invoices', () => {
    expect(summarizeItemSales([line({ docType: '1' }), line({ docType: '2' })]).invoices).toBe(2)
  })
  it('is empty-safe', () => {
    expect(summarizeItemSales([])).toMatchObject({ lines: 0, qty: 0, avgPrice: null, minPrice: null, firstDate: null, invoices: 0 })
  })
})

describe('pricePoints', () => {
  it('orders by date and skips credits and unpriced lines', () => {
    const p = pricePoints([
      line({ date: '2026-02-01', price: 5 }),
      line({ date: '2025-02-01', price: 4 }),
      line({ price: null }),
      line({ isReturn: true, price: 9 }),
    ])
    expect(p).toEqual([
      { date: '2025-02-01', price: 4 },
      { date: '2026-02-01', price: 5 },
    ])
  })
})

describe('csv and query', () => {
  it('quotes cells with commas and leaves empty discounts blank', () => {
    const [head, row] = itemSalesCsv([line({})]).split('\r\n')
    expect(head.startsWith('Date,Document,Type,SKU,Item')).toBe(true)
    expect(row).toBe('2026-01-01,1,1,A-1,"Item, one",1,10,10,,')
  })
  it('needs two characters', () => {
    expect(queryReady(' a ')).toBe(false)
    expect(queryReady('ab')).toBe(true)
  })
})

describe('fetchClientItemSales', () => {
  it('calls the database function with trimmed query and null dates', async () => {
    rpc.mockResolvedValueOnce({ data: { total: 0, rows: [] }, error: null })
    await fetchClientItemSales('pupik', '123', ' pet ', '', '2026-01-31', 'u1')
    expect(rpc).toHaveBeenCalledWith('get_client_item_sales', {
      p_company: 'pupik',
      p_client_id: '123',
      p_query: 'pet',
      p_from: null,
      p_to: '2026-01-31',
      p_as: 'u1',
    })
  })
  it('throws the database error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    await expect(fetchClientItemSales('pupik', '1', 'ab', null, null)).rejects.toThrow('boom')
  })
})
