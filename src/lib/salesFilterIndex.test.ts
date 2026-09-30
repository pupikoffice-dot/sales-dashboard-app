import { describe, expect, it } from 'vitest'
import { sortItemsBySku } from './salesFilterIndex'

describe('sortItemsBySku', () => {
  it('orders A–Z by SKU, ignoring the product name', () => {
    const sorted = sortItemsBySku([
      { id: 'VTH-1', label: 'Apple' },
      { id: 'fnk-2', label: 'Zebra' },
      { id: 'GRB-10', label: 'Mango' },
      { id: 'GRB-2', label: 'Banana' },
    ])
    expect(sorted.map(i => i.id)).toEqual(['fnk-2', 'GRB-2', 'GRB-10', 'VTH-1'])
  })
})
