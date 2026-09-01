import { describe, expect, it } from 'vitest'
import type { SalesRow } from '../types/dashboard'
import { topOpenOrdersByCash } from './oversiteMetrics'

function row(partial: Partial<SalesRow> & Pick<SalesRow, 'company'>): SalesRow {
  return { cash: 0, qty: 0, agent: '', clientID: '', ...partial }
}

describe('topOpenOrdersByCash', () => {
  it('returns top orders by document cash, not SKUs', () => {
    const rows: SalesRow[] = [
      row({
        company: 'openorders',
        docNum: '100',
        agent: '24',
        clientName: 'A',
        itemSKU: 'S1',
        cash: 10,
        qty: 1,
      }),
      row({
        company: 'openorders',
        docNum: '100',
        agent: '24',
        clientName: 'A',
        itemSKU: 'S2',
        cash: 40,
        qty: 2,
      }),
      row({
        company: 'openorders',
        docNum: '200',
        agent: '24',
        clientName: 'B',
        itemSKU: 'S3',
        cash: 30,
        qty: 1,
      }),
      row({
        company: 'openorders',
        docNum: '300',
        agent: '24',
        clientName: 'C',
        itemSKU: 'S4',
        cash: 200,
        qty: 1,
      }),
      row({
        company: 'openorders-mt',
        docNum: '999',
        agent: '24',
        clientName: 'X',
        itemSKU: 'SX',
        cash: 999,
        qty: 1,
      }),
    ]

    const top = topOpenOrdersByCash(rows, 'openorders', 2)
    expect(top).toHaveLength(2)
    expect(top[0].docNum).toBe('300')
    expect(top[0].cash).toBe(200)
    expect(top[1].docNum).toBe('100')
    expect(top[1].cash).toBe(50)
    expect(top[1].lines).toHaveLength(2)
  })

  it('returns all orders when limit is omitted', () => {
    const rows: SalesRow[] = [
      row({ company: 'openorders', docNum: '100', cash: 10, qty: 1 }),
      row({ company: 'openorders', docNum: '200', cash: 30, qty: 1 }),
      row({ company: 'openorders', docNum: '300', cash: 200, qty: 1 }),
    ]

    const all = topOpenOrdersByCash(rows, 'openorders')
    expect(all).toHaveLength(3)
    expect(all.map(o => o.docNum)).toEqual(['300', '200', '100'])
  })
})
