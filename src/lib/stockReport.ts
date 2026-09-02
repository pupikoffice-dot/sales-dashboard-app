import { MONTH_NAMES } from './format'
import { preferItemName } from './itemNames'
import { isWmsTotalRow } from './wmsData'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../types/dashboard'
import type { WmsNamesMap, WmsStockMap } from './wmsData'

export interface StockSkuRow {
  sku: string
  name: string
  lastMoQty: number
  ooQty: number
  wmsQty: number
  available: number
  cost: number | null
  totalCost: number | null
  price: number | null
}

export interface StockReport {
  lastMonthLabel: string
  rows: StockSkuRow[]
  totals: {
    lastMoQty: number
    wmsQty: number
    ooQty: number
    available: number
    totalCost: number
  }
}

function openOrdersCompany(company: LogicalCompany): string {
  if (company === 'mt') return 'openorders-mt'
  if (company === 'grow') return 'openorders-grow'
  return 'openorders'
}

export function buildStockReport(
  allRows: SalesRow[],
  company: LogicalCompany,
  wmsStock: WmsStockMap,
  wmsNames: WmsNamesMap,
  itemCost: SkuValueMap,
  itemPrice: SkuValueMap,
): StockReport {
  const ooCo = openOrdersCompany(company)
  const wmsData = wmsStock[company] || {}
  const names = wmsNames[company] || {}
  const costData = itemCost[company] || {}
  const priceData = itemPrice[company] || {}

  let lastY = 0
  let lastM = 0
  const skus: Record<string, { name: string; lastMoQty: number; ooQty: number }> = {}

  for (const r of allRows) {
    const co = r.company
    if (!co || !r.itemSKU) continue

    if (co === company) {
      const y = Number(r.year)
      const m = Number(r.month)
      if (m && y && (y > lastY || (y === lastY && m > lastM))) {
        lastY = y
        lastM = m
      }
    }
  }

  for (const r of allRows) {
    const co = r.company
    if (!r.itemSKU) continue

    if (co === company) {
      if (!skus[r.itemSKU]) {
        skus[r.itemSKU] = { name: r.itemName || r.itemSKU, lastMoQty: 0, ooQty: 0 }
      }
      skus[r.itemSKU].name = preferItemName(skus[r.itemSKU].name, r.itemName)
      if (Number(r.year) === lastY && Number(r.month) === lastM) {
        skus[r.itemSKU].lastMoQty += r.qty || 0
      }
      continue
    }

    if (co === ooCo) {
      if (!skus[r.itemSKU]) {
        skus[r.itemSKU] = { name: r.itemName || r.itemSKU, lastMoQty: 0, ooQty: 0 }
      }
      skus[r.itemSKU].name = preferItemName(skus[r.itemSKU].name, r.itemName)
      skus[r.itemSKU].ooQty += r.qty || 0
    }
  }

  for (const sku of Object.keys(wmsData)) {
    if (!skus[sku]) {
      skus[sku] = { name: preferItemName(names[sku] || sku, names[sku]), lastMoQty: 0, ooQty: 0 }
    }
  }

  const lastMonthLabel = lastM ? `${MONTH_NAMES[lastM - 1]} ${lastY}` : 'N/A'

  const rows: StockSkuRow[] = []
  let tLMQ = 0
  let tWMS = 0
  let tOO = 0
  let tAvail = 0
  let tTotalCost = 0

  for (const [sku, it] of Object.entries(skus).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    const wq = wmsData[sku] ?? null
    if (!wq || isWmsTotalRow(sku)) continue

    const avail = wq - it.ooQty
    const cost = costData[sku] ?? null
    const price = priceData[sku] ?? null
    const totalCost = cost != null ? cost * wq : null

    tLMQ += it.lastMoQty
    tWMS += wq
    tOO += it.ooQty
    tAvail += avail
    tTotalCost += totalCost ?? 0

    rows.push({
      sku,
      name: preferItemName(it.name, names[sku]),
      lastMoQty: it.lastMoQty,
      ooQty: it.ooQty,
      wmsQty: wq,
      available: avail,
      cost,
      totalCost,
      price,
    })
  }

  return {
    lastMonthLabel,
    rows,
    totals: {
      lastMoQty: tLMQ,
      wmsQty: tWMS,
      ooQty: tOO,
      available: tAvail,
      totalCost: tTotalCost,
    },
  }
}
