import type { LogicalCompany } from '../types/dashboard'

export interface WmsRow {
  company: string
  itemSKU: string
  qtyInStock: number
  itemName?: string
}

export type WmsStockMap = Record<string, Record<string, number>>
export type WmsNamesMap = Record<string, Record<string, string>>

export function isWmsTotalRow(sku: string): boolean {
  return /^[\u0590-\u05FF\s]+$/.test(sku)
}

export function buildWmsMaps(wmsRows: WmsRow[] | undefined): { wmsStock: WmsStockMap; wmsNames: WmsNamesMap } {
  const wmsStock: WmsStockMap = {}
  const wmsNames: WmsNamesMap = {}
  ;(wmsRows || []).forEach(r => {
    if (!r.itemSKU || isWmsTotalRow(r.itemSKU)) return
    const co = r.company as LogicalCompany
    if (!wmsStock[co]) wmsStock[co] = {}
    wmsStock[co][r.itemSKU] = (wmsStock[co][r.itemSKU] || 0) + (Number(r.qtyInStock) || 0)
    if (r.itemName) {
      if (!wmsNames[co]) wmsNames[co] = {}
      if (!wmsNames[co][r.itemSKU]) wmsNames[co][r.itemSKU] = r.itemName
    }
  })
  return { wmsStock, wmsNames }
}
