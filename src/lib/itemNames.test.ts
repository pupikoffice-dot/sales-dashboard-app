import { describe, expect, it } from 'vitest'
import { groupSalesRowsBySku, preferItemName } from './itemNames'

describe('preferItemName', () => {
  it('keeps the longer label', () => {
    expect(preferItemName('Short', 'Much longer item name')).toBe('Much longer item name')
    expect(preferItemName('Much longer item name', 'Short')).toBe('Much longer item name')
  })

  it('fills empty current from candidate', () => {
    expect(preferItemName('', 'New name')).toBe('New name')
    expect(preferItemName('  ', 'New name')).toBe('New name')
  })

  it('ignores empty candidates', () => {
    expect(preferItemName('Existing', '')).toBe('Existing')
    expect(preferItemName('Existing', null)).toBe('Existing')
  })
})

describe('groupSalesRowsBySku', () => {
  it('keeps the longest item name per SKU', () => {
    const grouped = groupSalesRowsBySku([
      { itemSKU: 'GRP-1', itemName: 'ed edition סקוט', cash: 1, qty: 1 } as never,
      { itemSKU: 'GRP-1', itemName: 'Limited edition סקוט', cash: 2, qty: 1 } as never,
    ])
    expect(grouped['GRP-1'].name).toBe('Limited edition סקוט')
  })
})
