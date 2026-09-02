import { describe, expect, it } from 'vitest'
import { buildSalesFilterIndex, buildSkuNameLookupFromFilterIndex } from './salesFilterIndex'

describe('buildSkuNameLookupFromFilterIndex', () => {
  it('keeps the longest item label per SKU across categories', () => {
    const index = buildSalesFilterIndex([
      {
        company: 'pupik',
        groupCat: 'סקוט פעלולים',
        itemSKU: 'GRP-675402',
        itemName: 'סקוט ed edition',
      } as never,
      {
        company: 'pupik',
        groupCat: 'סקוט פעלולים',
        itemSKU: 'GRP-675402',
        itemName: 'סקוט Limited edition כחול',
      } as never,
    ])

    const lookup = buildSkuNameLookupFromFilterIndex(index, 'pupik')
    expect(lookup['GRP-675402']).toBe('סקוט Limited edition כחול')
  })
})
