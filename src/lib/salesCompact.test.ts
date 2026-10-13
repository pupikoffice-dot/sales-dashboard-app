import { describe, expect, it } from 'vitest'
import { decodeSalesPage, encodeSalesRows, type CompactSalesPage } from './salesCompact'
import type { SalesRow } from '../types/dashboard'

const row = (over: Partial<SalesRow>): SalesRow => ({
  company: 'pupik',
  date: '2026-10-01',
  year: 2026,
  month: 10,
  agent: '12',
  clientID: '1001',
  clientName: 'לקוח א',
  docNum: '5001',
  itemSKU: 'FUN-1',
  itemName: 'Item one',
  qty: 2,
  cash: 150.5,
  tabletCat: 'A',
  groupCat: 'G',
  supplier: 'FUN',
  ...over,
})

describe('compact sales pages', () => {
  it('decodes a page as sent by the v2 RPC, nulls kept as null', () => {
    const page: CompactSalesPage = {
      v: 2,
      n: 2,
      dict: ['orders-mt', '2026-10-02', '7', 'C1', 'Client', 'D9', 'MT-1', 'Name'],
      company: [0, 0],
      date: [1, 1],
      year: [2026, 2026],
      month: [10, 10],
      agent: [2, null],
      clientID: [3, 3],
      clientName: [4, 4],
      docNum: [5, 5],
      itemSKU: [6, 6],
      itemName: [7, 7],
      qty: [1, -3],
      cash: [10, null],
      tabletCat: [null, null],
      groupCat: [null, null],
      supplier: [null, 6],
    }
    const rows = decodeSalesPage(page)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ company: 'orders-mt', date: '2026-10-02', agent: '7', cash: 10, tabletCat: null })
    expect(rows[1]).toMatchObject({ agent: null, qty: -3, cash: null, supplier: 'MT-1' })
  })

  it('round-trips v1 row objects', () => {
    const rows = [row({}), row({ company: 'returns-mt', agent: null as unknown as string, cash: -20 }), row({ itemName: 'Item one' })]
    expect(decodeSalesPage(encodeSalesRows(rows))).toEqual(rows)
  })

  it('handles an empty page', () => {
    expect(decodeSalesPage({ v: 2, n: 0, dict: [] } as unknown as CompactSalesPage)).toEqual([])
  })
})
