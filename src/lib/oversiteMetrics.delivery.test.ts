import { describe, expect, it } from 'vitest'
import type { SalesRow } from '../types/dashboard'
import { computeDelivery720MtdDocs } from './oversiteMetrics'

function row(partial: Partial<SalesRow>): SalesRow {
  return {
    company: 'delivery720-mt',
    cash: 0,
    qty: 0,
    agent: '57',
    clientID: '',
    ...partial,
  }
}

describe('computeDelivery720MtdDocs', () => {
  it('groups MTD 720 lines into documents, newest first, with their lines', () => {
    const rows: SalesRow[] = [
      row({ docNum: 'D1', date: '2026-09-10', clientID: '720:D1', itemSKU: 'A', qty: 1, cash: 10 }),
      row({ docNum: 'D1', date: '2026-09-10', clientID: '720:D1', itemSKU: 'B', qty: 2, cash: 30 }),
      row({ docNum: 'D2', date: '2026-09-20', clientID: '720:D2', itemSKU: 'C', qty: 1, cash: 5 }),
      row({ docNum: 'D0', date: '2026-08-30', itemSKU: 'X', cash: 99 }),
      row({ company: 'delivery720-pupik', docNum: 'P1', date: '2026-09-12', cash: 7 }),
    ]

    const docs = computeDelivery720MtdDocs(rows, 'delivery720-mt', '2026-09-01', '2026-09-25')

    expect(docs.map(d => d.docNum)).toEqual(['D2', 'D1'])
    expect(docs[1].lines).toHaveLength(2)
    expect(docs[1].cash).toBe(40)
    expect(docs[1].qty).toBe(3)
    expect(docs[1].orderDate).toBe('2026-09-10')
  })

  it('blanks the synthetic 720 client key but keeps real client names', () => {
    const docs = computeDelivery720MtdDocs(
      [
        row({ docNum: 'D1', date: '2026-09-10', clientID: '720:D1' }),
        row({ docNum: 'D2', date: '2026-09-11', clientID: 'C9', clientName: 'Toy Shop' }),
      ],
      'delivery720-mt',
      '2026-09-01',
      '2026-09-25',
    )
    expect(docs.find(d => d.docNum === 'D1')?.clientName).toBe('')
    expect(docs.find(d => d.docNum === 'D2')?.clientName).toBe('Toy Shop')
  })
})
