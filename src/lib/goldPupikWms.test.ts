import { describe, expect, it } from 'vitest'
import {
  augmentWmsMapsForGold,
  buildGoldWmsFromPupik,
  isGoldPupikMappedSku,
  openOrdersTagForCompany,
} from './goldPupikWms'

describe('goldPupikWms', () => {
  it('recognises QPL and SCR prefixes', () => {
    expect(isGoldPupikMappedSku('QPL-991')).toBe(true)
    expect(isGoldPupikMappedSku('scr-12')).toBe(true)
    expect(isGoldPupikMappedSku('PUP-1')).toBe(false)
  })

  it('copies only mapped SKUs from Pupik into Gold virtual stock', () => {
    const { stock, names } = buildGoldWmsFromPupik(
      { 'QPL-1': 5, 'OTHER-1': 99, 'SCR-2': 2 },
      { 'QPL-1': 'Widget', 'SCR-2': 'Gadget' },
    )
    expect(stock).toEqual({ 'QPL-1': 5, 'SCR-2': 2 })
    expect(names['QPL-1']).toBe('Widget')
  })

  it('augments wms maps with gold bucket', () => {
    const { wmsStock } = augmentWmsMapsForGold(
      { pupik: { 'QPL-9': 3 } },
      { pupik: { 'QPL-9': 'Nine' } },
    )
    expect(wmsStock.gold?.['QPL-9']).toBe(3)
  })

  it('maps gold open orders tag', () => {
    expect(openOrdersTagForCompany('gold')).toBe('openorders-gold')
  })
})
