import { describe, expect, it } from 'vitest'
import type { SalesRow } from '../types/dashboard'
import { buildBestClients, buildBestSoldItems } from './suiteUiMetrics'

function row(partial: Partial<SalesRow> & Pick<SalesRow, 'company'>): SalesRow {
  return { cash: 0, qty: 0, agent: '', clientID: '', itemSKU: '', ...partial }
}

describe('buildBestSoldItems', () => {
  it('ranks MTD SKUs by cash for agent scope', () => {
    const rows = [
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'A',
        itemName: 'Alpha',
        cash: 100,
        qty: 2,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'B',
        itemName: 'Beta',
        cash: 50,
        qty: 1,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 7,
        agent: '24',
        itemSKU: 'A',
        cash: 999,
        qty: 9,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        itemSKU: 'C',
        cash: 500,
        qty: 1,
      }),
    ]
    const items = buildBestSoldItems({
      rows,
      company: 'pupik',
      agents: ['24'],
      curYear: 2026,
      curMonth: 8,
    })
    expect(items.map(i => i.sku)).toEqual(['A', 'B'])
    expect(items[0].cash).toBe(100)
    expect(items[0].qty).toBe(2)
  })
})

describe('buildBestClients', () => {
  it('ranks MTD clients by cash', () => {
    const rows = [
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        clientID: 'c2',
        clientName: 'Two',
        cash: 30,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        clientID: 'c1',
        clientName: 'One',
        cash: 80,
      }),
    ]
    const clients = buildBestClients({
      rows,
      company: 'pupik',
      agents: ['24'],
      curYear: 2026,
      curMonth: 8,
    })
    expect(clients.map(c => c.clientId)).toEqual(['c1', 'c2'])
    expect(clients[0].cash).toBe(80)
  })
})

describe('mtdPrefiltered golden', () => {
  it('prefiltered MTD slice matches full-row filter results', () => {
    const rows = [
      row({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'A',
        itemName: 'Alpha',
        clientID: 'c1',
        clientName: 'One',
        cash: 100,
        qty: 2,
      }),
      row({
        company: 'pupik',
        year: 2026,
        month: 7,
        agent: '24',
        itemSKU: 'A',
        cash: 999,
        qty: 9,
        clientID: 'c9',
      }),
      row({
        company: 'mt',
        year: 2026,
        month: 8,
        agent: '24',
        itemSKU: 'Z',
        cash: 50,
        qty: 1,
        clientID: 'cz',
      }),
    ]
    const mtd = rows.filter(
      r => r.company === 'pupik' && Number(r.year) === 2026 && Number(r.month) === 8,
    )
    expect(
      buildBestSoldItems({
        rows: mtd,
        company: 'pupik',
        agents: ['24'],
        curYear: 2026,
        curMonth: 8,
        mtdPrefiltered: true,
      }),
    ).toEqual(
      buildBestSoldItems({
        rows,
        company: 'pupik',
        agents: ['24'],
        curYear: 2026,
        curMonth: 8,
      }),
    )
    expect(
      buildBestClients({
        rows: mtd,
        company: 'pupik',
        agents: ['24'],
        curYear: 2026,
        curMonth: 8,
        mtdPrefiltered: true,
      }),
    ).toEqual(
      buildBestClients({
        rows,
        company: 'pupik',
        agents: ['24'],
        curYear: 2026,
        curMonth: 8,
      }),
    )
  })
})
