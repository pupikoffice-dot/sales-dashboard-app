import { describe, expect, it } from 'vitest'
import { buildExceptionSheets, type MarginExceptions } from './marginExceptionsReport'

const data: MarginExceptions = {
  year: 2026,
  asOf: '2026-11-18',
  companies: [
    {
      company: 'pupik',
      noCost: [{ sku: 'A-1', name: 'No cost item', qty: 5, net: 100 }],
      lowMargin: [{ sku: 'B-2', name: 'Cheap item', qty: 10, net: 1000, unitCost: 95 }],
    },
    { company: 'gold', noCost: [], lowMargin: [{ sku: 'C-3', name: null, qty: 2, net: 50, unitCost: 30 }] },
  ],
}

describe('buildExceptionSheets', () => {
  const [summary, noCost, low] = buildExceptionSheets(data)

  it('summary counts per company', () => {
    expect(summary.rows[3]).toEqual(['Company', 'Items with no cost', 'Net sales of those items', 'Items with margin under 10%', 'Net sales of those items'])
    expect(summary.rows[4]).toEqual(['Pupik', 1, 100, 1, 1000])
    expect(summary.rows[5]).toEqual(['Goldbug', 0, 0, 1, 50])
  })

  it('no-cost sheet has a header and the items', () => {
    expect(noCost.rows).toHaveLength(2)
    expect(noCost.rows[1]).toEqual(['Pupik', 'A-1', 'No cost item', 5, 100, null])
  })

  it('margin sheet computes total cost, margin and margin %', () => {
    expect(low.rows[1]).toEqual(['Pupik', 'B-2', 'Cheap item', 10, 1000, 95, 950, 50, 0.05])
    expect(low.rows[2]).toEqual(['Goldbug', 'C-3', '', 2, 50, 30, 60, -10, -0.2])
  })

  it('has no Short codes sheet when nothing was cut', () => {
    expect(buildExceptionSheets(data).map(s => s.name)).not.toContain('Short codes')
  })

  it('lists cut codes on their own sheet, outside the No cost list', () => {
    const withShort: MarginExceptions = {
      ...data,
      companies: [{ ...data.companies[0], shortCodes: [{ sku: 'RZR-1307342', name: 'Razor', qty: 3, net: 90 }] }, data.companies[1]],
    }
    const sheets = buildExceptionSheets(withShort)
    const shortSheet = sheets.find(s => s.name === 'Short codes')
    expect(shortSheet?.rows[1]).toEqual(['Pupik', 'RZR-1307342', 'Razor', 3, 90])
    expect(sheets[1].rows.map(r => r[1])).not.toContain('RZR-1307342')
  })
})
