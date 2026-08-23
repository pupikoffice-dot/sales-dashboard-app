import { describe, expect, it } from 'vitest'
import type { SalesRow } from '../types/dashboard'
import {
  buildItemsSoldByOthers,
  buildMissedClients,
  buildMissedItems,
  lastYMonthKeys,
} from './biMetrics'

function row(partial: Partial<SalesRow> & Pick<SalesRow, 'company'>): SalesRow {
  return { cash: 0, qty: 0, agent: '', clientID: '', itemSKU: '', ...partial }
}

describe('lastYMonthKeys', () => {
  it('includes current and walks backward', () => {
    expect(lastYMonthKeys(2026, 8, 4)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08'])
  })
})

describe('buildMissedItems', () => {
  it('skips OOS and fills to top in-stock usual SKUs', () => {
    const rows: SalesRow[] = []
    for (const month of [5, 6, 7, 8]) {
      rows.push(
        row({
          company: 'pupik',
          year: 2026,
          month,
          agent: '24',
          itemSKU: 'A',
          itemName: 'Item A',
          cash: 100,
          qty: 1,
        }),
        row({
          company: 'pupik',
          year: 2026,
          month,
          agent: '24',
          itemSKU: 'B',
          itemName: 'Item B',
          cash: 50,
          qty: 1,
        }),
      )
    }
    const result = buildMissedItems({
      rows,
      company: 'pupik',
      agents: ['24'],
      habit: { habitX: 3, habitY: 4 },
      curYear: 2026,
      curMonth: 8,
      stockBySku: { B: 5 }, // A missing → skip
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(1)
    expect(result.items[0].sku).toBe('B')
  })

  it('returns insufficient_history when too few months', () => {
    const rows = [
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'A',
        cash: 10,
        qty: 1,
      }),
    ]
    const result = buildMissedItems({
      rows,
      company: 'pupik',
      agents: ['24'],
      habit: { habitX: 3, habitY: 4 },
      curYear: 2026,
      curMonth: 8,
      stockBySku: { A: 1 },
    })
    expect(result.ok).toBe(false)
  })
})

describe('buildMissedClients', () => {
  it('ranks usual clients by cash', () => {
    const rows: SalesRow[] = []
    for (const month of [5, 6, 7, 8]) {
      rows.push(
        row({
          company: 'pupik',
          year: 2026,
          month,
          agent: '24',
          clientID: 'c1',
          clientName: 'One',
          cash: 200,
          qty: 1,
        }),
      )
    }
    const result = buildMissedClients({
      rows,
      company: 'pupik',
      agents: ['24'],
      habit: { habitX: 3, habitY: 4 },
      curYear: 2026,
      curMonth: 8,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items[0].clientId).toBe('c1')
  })
})

describe('buildItemsSoldByOthers', () => {
  it('lists SKUs sold by others MTD not by self', () => {
    const rows = [
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        itemSKU: 'X',
        itemName: 'Ex',
        cash: 80,
        qty: 2,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'Y',
        cash: 10,
        qty: 1,
      }),
    ]
    const items = buildItemsSoldByOthers({
      rows,
      company: 'pupik',
      agentId: '24',
      suiteAgents: ['24', '25'],
      curYear: 2026,
      curMonth: 8,
    })
    expect(items).toHaveLength(1)
    expect(items[0].sku).toBe('X')
    expect(items[0].othersCash).toBe(80)
  })
})
