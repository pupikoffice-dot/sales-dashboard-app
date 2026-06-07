import type { LogicalCompany, SalesRow } from '../types/dashboard'
import { MONTH_NAMES } from './format'

export interface OversiteCompanyDef {
  id: LogicalCompany
  ordersTag: string
  returnsTag: string
  label: string
  accentColor: string
}

export const OVERSITE_COMPANIES: OversiteCompanyDef[] = [
  { id: 'pupik', ordersTag: 'orders-pupik', returnsTag: 'returns-pupik', label: '🏢 Pupik', accentColor: 'var(--acc)' },
  { id: 'mt', ordersTag: 'orders-mt', returnsTag: 'returns-mt', label: '🐒 Monkeytime', accentColor: 'var(--acc2)' },
]

export interface RowTotals {
  cash: number
  qty: number
}

export function sumRows(rows: SalesRow[]): RowTotals {
  return rows.reduce(
    (acc, r) => ({
      cash: acc.cash + (Number(r.cash) || 0),
      qty: acc.qty + (Number(r.qty) || 0),
    }),
    { cash: 0, qty: 0 },
  )
}

export interface OversiteDateContext {
  todayStr: string
  todayDisp: string
  curYear: number
  curMonth: number
  monthLbl: string
  lyMonthLbl: string
  monthStart: string
}

export function getOversiteDateContext(now = new Date()): OversiteDateContext {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const curYear = today.getFullYear()
  const curMonth = today.getMonth() + 1
  const todayStr = today.toISOString().slice(0, 10)
  const monthLbl = `${MONTH_NAMES[curMonth - 1]} ${curYear}`
  const lyMonthLbl = `${MONTH_NAMES[curMonth - 1]} ${curYear - 1}`
  const monthStart = `${curYear}-${String(curMonth).padStart(2, '0')}-01`
  const [y, m, d] = todayStr.split('-')
  return {
    todayStr,
    todayDisp: `${d}/${m}/${y}`,
    curYear,
    curMonth,
    monthLbl,
    lyMonthLbl,
    monthStart,
  }
}

export interface OrdersTodayMetrics {
  clients: number
  cash: number
  qty: number
}

export function computeOrdersToday(rows: SalesRow[], ordersTag: string, todayStr: string): OrdersTodayMetrics {
  const matched = rows.filter(r => r.company === ordersTag && r.date === todayStr)
  const { cash, qty } = sumRows(matched)
  const clients = new Set(matched.map(r => r.clientID).filter(Boolean)).size
  return { clients, cash, qty }
}

export interface OrdersMtdMetrics extends OrdersTodayMetrics {}

export function computeOrdersMtd(
  rows: SalesRow[],
  ordersTag: string,
  monthStart: string,
  todayStr: string,
): OrdersMtdMetrics {
  const matched = rows.filter(r => r.company === ordersTag && r.date && r.date >= monthStart && r.date <= todayStr)
  const { cash, qty } = sumRows(matched)
  const clients = new Set(matched.map(r => r.clientID).filter(Boolean)).size
  return { clients, cash, qty }
}

export interface SalesMtdMetrics {
  cash: number
  qty: number
  lyCash: number
  lyQty: number
  lyChangeCashPct: number | null
}

export function computeSalesMtd(
  rows: SalesRow[],
  company: string,
  curYear: number,
  curMonth: number,
): SalesMtdMetrics {
  const salesMTD = rows.filter(
    r => r.company === company && Number(r.year) === curYear && Number(r.month) === curMonth,
  )
  const salesLY = rows.filter(
    r => r.company === company && Number(r.year) === curYear - 1 && Number(r.month) === curMonth,
  )
  const { cash, qty } = sumRows(salesMTD)
  const { cash: lyCash, qty: lyQty } = sumRows(salesLY)
  const lyChangeCashPct = lyCash > 0 ? ((cash - lyCash) / lyCash) * 100 : null
  return { cash, qty, lyCash, lyQty, lyChangeCashPct }
}

export interface Top10Item {
  sku: string
  name: string
  cash: number
  qty: number
}

export function computeTop10BySku(rows: SalesRow[], limit = 10): Top10Item[] {
  const itemMap: Record<string, Top10Item> = {}
  rows.forEach(r => {
    if (!r.itemSKU) return
    const sku = String(r.itemSKU)
    if (!itemMap[sku]) itemMap[sku] = { sku, name: String(r.itemName || sku), cash: 0, qty: 0 }
    itemMap[sku].cash += Number(r.cash) || 0
    itemMap[sku].qty += Number(r.qty) || 0
  })
  return Object.values(itemMap)
    .sort((a, b) => b.cash - a.cash)
    .slice(0, limit)
}

export function computeOrdersMtdTop10(
  rows: SalesRow[],
  ordersTag: string,
  monthStart: string,
  todayStr: string,
): Top10Item[] {
  const matched = rows.filter(r => r.company === ordersTag && r.date && r.date >= monthStart && r.date <= todayStr)
  return computeTop10BySku(matched)
}

export function computeSalesMtdTop10(
  rows: SalesRow[],
  company: string,
  curYear: number,
  curMonth: number,
): Top10Item[] {
  const matched = rows.filter(
    r => r.company === company && Number(r.year) === curYear && Number(r.month) === curMonth,
  )
  return computeTop10BySku(matched)
}

export interface ReturnsMtdMetrics {
  cash: number
  qty: number
}

export function computeReturnsMtd(
  rows: SalesRow[],
  returnsTag: string,
  curYear: number,
  curMonth: number,
): ReturnsMtdMetrics {
  const matched = rows.filter(
    r => r.company === returnsTag && Number(r.year) === curYear && Number(r.month) === curMonth,
  )
  return sumRows(matched)
}

export function computeReturnsMtdTop10(
  rows: SalesRow[],
  returnsTag: string,
  curYear: number,
  curMonth: number,
): Top10Item[] {
  const matched = rows.filter(
    r => r.company === returnsTag && Number(r.year) === curYear && Number(r.month) === curMonth,
  )
  return computeTop10BySku(matched)
}
