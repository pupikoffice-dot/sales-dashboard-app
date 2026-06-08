import { MONTH_NAMES } from './format'
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
  let lastY = 0
  let lastM = 0
  allRows.forEach(r => {
    if (r.company !== company) return
    const y = Number(r.year)
    const m = Number(r.month)
    if (!m || !y) return
    if (y > lastY || (y === lastY && m > lastM)) {
      lastY = y
      lastM = m
    }
  })

  const ooCo = openOrdersCompany(company)
  const wmsData = wmsStock[company] || {}
  const names = wmsNames[company] || {}
  const costData = itemCost[company] || {}
  const priceData = itemPrice[company] || {}

  const skus: Record<string, { name: string; lastMoQty: number; ooQty: number }> = {}

  allRows.forEach(r => {
    if (r.company !== company || !r.itemSKU) return
    if (!skus[r.itemSKU]) {
      skus[r.itemSKU] = { name: r.itemName || r.itemSKU, lastMoQty: 0, ooQty: 0 }
    }
    if (Number(r.year) === lastY && Number(r.month) === lastM) {
      skus[r.itemSKU].lastMoQty += r.qty || 0
    }
  })

  allRows.forEach(r => {
    if (r.company !== ooCo || !r.itemSKU) return
    if (!skus[r.itemSKU]) {
      skus[r.itemSKU] = { name: r.itemName || r.itemSKU, lastMoQty: 0, ooQty: 0 }
    }
    skus[r.itemSKU].ooQty += r.qty || 0
  })

  Object.keys(wmsData).forEach(sku => {
    if (!skus[sku]) {
      skus[sku] = { name: names[sku] || sku, lastMoQty: 0, ooQty: 0 }
    }
  })

  const lastMonthLabel = lastM ? `${MONTH_NAMES[lastM - 1]} ${lastY}` : 'N/A'

  const rows: StockSkuRow[] = []
  let tLMQ = 0
  let tWMS = 0
  let tOO = 0
  let tAvail = 0
  let tTotalCost = 0

  Object.entries(skus)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([sku, it]) => {
      const wq = wmsData[sku] ?? null
      if (!wq || isWmsTotalRow(sku)) return

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
        name: it.name,
        lastMoQty: it.lastMoQty,
        ooQty: it.ooQty,
        wmsQty: wq,
        available: avail,
        cost,
        totalCost,
        price,
      })
    })

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
