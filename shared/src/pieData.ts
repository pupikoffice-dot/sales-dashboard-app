import { MONTH_NAMES } from './format'
import { getSortedMonths } from './salesDateFilter'
import { preferItemName } from './itemNames'
import type { SalesRow } from './types'

export interface PieEntry {
  label: string
  value: number
  qty?: number
  sku?: string
  ooQty?: number
}

export function buildItemPie(rows: SalesRow[]): PieEntry[] {
  const map: Record<string, { name: string; cash: number; qty: number }> = {}
  rows.forEach(r => {
    if (!r.itemSKU) return
    if (!map[r.itemSKU]) map[r.itemSKU] = { name: r.itemName || r.itemSKU, cash: 0, qty: 0 }
    map[r.itemSKU].name = preferItemName(map[r.itemSKU].name, r.itemName)
    map[r.itemSKU].cash += r.cash || 0
    map[r.itemSKU].qty += r.qty || 0
  })
  return Object.entries(map).map(([sku, it]) => ({
    label: it.name,
    value: it.cash,
    qty: it.qty,
    sku,
  }))
}

export function buildClientPie(rows: SalesRow[]): PieEntry[] {
  const map: Record<string, { name: string; cash: number; qty: number }> = {}
  rows.forEach(r => {
    if (!r.clientID) return
    if (!map[r.clientID]) map[r.clientID] = { name: r.clientName || r.clientID, cash: 0, qty: 0 }
    map[r.clientID].cash += r.cash || 0
    map[r.clientID].qty += r.qty || 0
  })
  return Object.values(map).map(cl => ({ label: cl.name, value: cl.cash, qty: cl.qty }))
}

export function buildMonthlyBarFromRows(rows: SalesRow[], selectedMonths: Set<string>) {
  const months = getSortedMonths(selectedMonths)
  const labels = months.map(mk => {
    const [y, m] = mk.split('-')
    return `${MONTH_NAMES[+m - 1]} ${y}`
  })
  const cashVals = months.map(mk => {
    const [y, m] = mk.split('-')
    return rows
      .filter(r => Number(r.year) === +y && Number(r.month) === +m)
      .reduce((a, r) => a + (r.cash || 0), 0)
  })
  const qtyVals = months.map(mk => {
    const [y, m] = mk.split('-')
    return rows
      .filter(r => Number(r.year) === +y && Number(r.month) === +m)
      .reduce((a, r) => a + (r.qty || 0), 0)
  })
  return { labels, cashVals, qtyVals }
}
