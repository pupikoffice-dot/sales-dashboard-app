import type { LogicalCompany, SalesRow } from '../types/dashboard'
import { MONTH_NAMES } from './format'

export interface OversiteCompanyDef {
  id: LogicalCompany
  /** Report 722 — orders MTD */
  ordersTag: string
  /** Report 721 — open / undelivered orders */
  openOrdersTag: string
  returnsTag: string
  label: string
  accentColor: string
}

export const OVERSITE_COMPANIES: OversiteCompanyDef[] = [
  {
    id: 'pupik',
    ordersTag: 'orders-pupik',
    openOrdersTag: 'openorders',
    returnsTag: 'returns-pupik',
    label: '🏢 Pupik',
    accentColor: 'var(--acc)',
  },
  {
    id: 'mt',
    ordersTag: 'orders-mt',
    openOrdersTag: 'openorders-mt',
    returnsTag: 'returns-mt',
    label: '🐒 Monkeytime',
    accentColor: 'var(--acc2)',
  },
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

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getOversiteDateContext(now = new Date()): OversiteDateContext {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const curYear = today.getFullYear()
  const curMonth = today.getMonth() + 1
  const todayStr = localDateStr(today)
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

/** Legacy exports tagged 722 rows as openorders when orders-* sheets were missing. */
export function resolveOrdersTag(rows: SalesRow[], ordersTag: string): string {
  const count = rows.filter(r => r.company === ordersTag).length
  if (count >= 100) return ordersTag
  if (ordersTag === 'orders-pupik') {
    const legacy = rows.filter(r => r.company === 'openorders').length
    if (legacy > 2000) return 'openorders'
  }
  if (ordersTag === 'orders-mt') {
    const legacy = rows.filter(r => r.company === 'openorders-mt').length
    if (legacy > 2000) return 'openorders-mt'
  }
  return ordersTag
}

export function resolveOpenOrdersTag(rows: SalesRow[], openOrdersTag: string): string {
  const count = rows.filter(r => r.company === openOrdersTag).length
  if (count > 0) return openOrdersTag
  return openOrdersTag
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

export function computeTop10BySku(
  rows: SalesRow[],
  limit = 10,
  cashSort: 'high-first' | 'low-first' = 'high-first',
): Top10Item[] {
  const itemMap: Record<string, Top10Item> = {}
  rows.forEach(r => {
    if (!r.itemSKU) return
    const sku = String(r.itemSKU)
    if (!itemMap[sku]) itemMap[sku] = { sku, name: String(r.itemName || sku), cash: 0, qty: 0 }
    itemMap[sku].cash += Number(r.cash) || 0
    itemMap[sku].qty += Number(r.qty) || 0
  })
  const cmp =
    cashSort === 'low-first'
      ? (a: Top10Item, b: Top10Item) => a.cash - b.cash
      : (a: Top10Item, b: Top10Item) => b.cash - a.cash
  return Object.values(itemMap).sort(cmp).slice(0, limit)
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

export interface OpenOrdersMetrics extends OrdersTodayMetrics {}

/** Report 721 — all undelivered open-order rows for the company (no date filter). */
export function computeOpenOrders(rows: SalesRow[], openOrdersTag: string): OpenOrdersMetrics {
  const matched = rows.filter(r => r.company === openOrdersTag)
  const { cash, qty } = sumRows(matched)
  const clients = new Set(matched.map(r => r.clientID).filter(Boolean)).size
  return { clients, cash, qty }
}

export function computeOpenOrdersTop10(rows: SalesRow[], openOrdersTag: string): Top10Item[] {
  const matched = rows.filter(r => r.company === openOrdersTag)
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
  return computeTop10BySku(matched, 10, 'low-first')
}
