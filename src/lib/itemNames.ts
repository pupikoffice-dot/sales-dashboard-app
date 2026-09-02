import type { SalesRow } from '../types/dashboard'
import { preferItemName } from '@dashboard/shared/itemNames'

export { preferItemName }

export interface SkuRowGroup {
  name: string
  rows: SalesRow[]
}

/** Group sales rows by SKU, keeping the longest item name seen. */
export function groupSalesRowsBySku(rows: SalesRow[]): Record<string, SkuRowGroup> {
  const items: Record<string, SkuRowGroup> = {}
  for (const r of rows) {
    if (!r.itemSKU) continue
    const sku = r.itemSKU
    if (!items[sku]) items[sku] = { name: r.itemName || sku, rows: [] }
    items[sku].name = preferItemName(items[sku].name, r.itemName)
    items[sku].rows.push(r)
  }
  return items
}
