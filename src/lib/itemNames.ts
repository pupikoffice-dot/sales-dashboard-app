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

/** Longest item label per SKU across one or more row sets (e.g. current year + full history). */
export function buildSkuNameIndex(...rowSets: SalesRow[][]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const rows of rowSets) {
    for (const r of rows) {
      if (!r.itemSKU) continue
      const sku = r.itemSKU
      names[sku] = preferItemName(names[sku] ?? '', r.itemName)
    }
  }
  return names
}

/**
 * Group report rows by SKU but resolve display names from additional sources too.
 * Fixes YoY reports where 2025 rows carry a short ERP label but 2026 rows have the full name.
 */
export function groupSalesRowsBySkuWithNames(
  rows: SalesRow[],
  ...nameSources: SalesRow[][]
): Record<string, SkuRowGroup> {
  const items = groupSalesRowsBySku(rows)
  const sources = nameSources.filter(source => source.length > 0)
  if (!sources.length) return items
  const names = buildSkuNameIndex(rows, ...sources)
  for (const sku of Object.keys(items)) {
    const name = names[sku]
    if (name && name !== items[sku].name) {
      items[sku] = { ...items[sku], name }
    }
  }
  return items
}
