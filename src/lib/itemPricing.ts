import type { CostRow, PriceRow, SkuValueMap } from '../types/dashboard'

export function buildItemCostMap(costRows: CostRow[] | undefined): SkuValueMap {
  const map: SkuValueMap = {}
  ;(costRows || []).forEach(r => {
    if (!r.itemSKU) return
    if (!map[r.company]) map[r.company] = {}
    map[r.company][r.itemSKU] = r.cost
  })
  return map
}

export function buildItemPriceMap(priceRows: PriceRow[] | undefined): SkuValueMap {
  const map: SkuValueMap = {}
  ;(priceRows || []).forEach(r => {
    if (!r.itemSKU) return
    if (!map[r.company]) map[r.company] = {}
    map[r.company][r.itemSKU] = r.price
  })
  return map
}
