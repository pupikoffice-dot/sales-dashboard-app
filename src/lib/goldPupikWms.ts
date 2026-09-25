import type { LogicalCompany } from '../types/dashboard'
import { preferItemName } from './itemNames'
import type { WmsNamesMap, WmsStockMap } from './wmsData'

/**
 * Goldbug has no WMS export (000gold). Stock for selected Pupik inventory is
 * mapped by SKU supplier prefix — extend this list as ops adds brands.
 */
export const GOLD_PUPIK_WMS_PREFIXES = ['QPL', 'SCR'] as const

export type GoldPupikWmsPrefix = (typeof GOLD_PUPIK_WMS_PREFIXES)[number]

const PREFIX_SET = new Set<string>(GOLD_PUPIK_WMS_PREFIXES.map(p => p.toUpperCase()))

/** Supplier token before the first hyphen in a SKU (e.g. QPL-12345 → QPL). */
export function skuSupplierPrefix(sku: string): string {
  const head = String(sku ?? '').trim().split('-')[0] ?? ''
  return head.toUpperCase()
}

export function isGoldPupikMappedSku(sku: string): boolean {
  return PREFIX_SET.has(skuSupplierPrefix(sku))
}

/**
 * Copy matching Pupik WMS rows into Goldbug's virtual warehouse bucket.
 * Does not mutate inputs.
 */
export function buildGoldWmsFromPupik(
  pupikStock: Record<string, number> | undefined,
  pupikNames: Record<string, string> | undefined,
): { stock: Record<string, number>; names: Record<string, string> } {
  const stock: Record<string, number> = {}
  const names: Record<string, string> = {}
  if (!pupikStock) return { stock, names }

  for (const [sku, qty] of Object.entries(pupikStock)) {
    if (!isGoldPupikMappedSku(sku)) continue
    stock[sku] = qty
    const n = pupikNames?.[sku]
    if (n) names[sku] = n
  }
  return { stock, names }
}

/** Apply Goldbug ← Pupik WMS mapping on top of raw inventory maps. */
export function augmentWmsMapsForGold(
  wmsStock: WmsStockMap,
  wmsNames: WmsNamesMap,
): { wmsStock: WmsStockMap; wmsNames: WmsNamesMap } {
  const { stock, names } = buildGoldWmsFromPupik(wmsStock.pupik, wmsNames.pupik)
  if (Object.keys(stock).length === 0) {
    return { wmsStock, wmsNames }
  }

  const nextStock: WmsStockMap = { ...wmsStock, gold: { ...stock } }
  const nextNames: WmsNamesMap = { ...wmsNames }
  const goldNames: Record<string, string> = { ...(wmsNames.gold ?? {}) }
  for (const [sku, name] of Object.entries(names)) {
    goldNames[sku] = preferItemName(goldNames[sku] ?? '', name)
  }
  nextNames.gold = goldNames
  return { wmsStock: nextStock, wmsNames: nextNames }
}

export function openOrdersTagForCompany(company: LogicalCompany): string {
  if (company === 'mt') return 'openorders-mt'
  if (company === 'grow') return 'openorders-grow'
  if (company === 'gold') return 'openorders-gold'
  return 'openorders'
}

export function returnsTagForCompany(company: LogicalCompany): string {
  return `returns-${company}`
}
