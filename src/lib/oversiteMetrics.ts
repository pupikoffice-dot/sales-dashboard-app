import type { LogicalCompany, SalesRow } from '../types/dashboard'
import { MONTH_NAMES } from './format'
import { preferItemName } from './itemNames'
import { isWeekendFriSat, normalizeSalesDate, weekdayShortEn } from './salesDate'

export interface OversiteCompanyDef {
  id: LogicalCompany
  /** Report 722 — orders MTD */
  ordersTag: string
  /** Report 721 — open / undelivered orders */
  openOrdersTag: string
  /** Report 720 — delivery notes */
  delivery720Tag: string
  returnsTag: string
  label: string
  accentColor: string
}

/** Distinct accents so side-by-side company columns are easy to tell apart. */
export const COMPANY_ACCENT: Record<LogicalCompany, string> = {
  pupik: 'var(--co-pupik)',
  mt: 'var(--co-mt)',
  grow: 'var(--co-grow)',
  gold: 'var(--co-gold)',
}

export const OVERSITE_COMPANIES: OversiteCompanyDef[] = [
  {
    id: 'pupik',
    ordersTag: 'orders-pupik',
    openOrdersTag: 'openorders',
    delivery720Tag: 'delivery720-pupik',
    returnsTag: 'returns-pupik',
    label: '🏢 Pupik',
    accentColor: COMPANY_ACCENT.pupik,
  },
  {
    id: 'mt',
    ordersTag: 'orders-mt',
    openOrdersTag: 'openorders-mt',
    delivery720Tag: 'delivery720-mt',
    returnsTag: 'returns-mt',
    label: '🐒 Monkeytime',
    accentColor: COMPANY_ACCENT.mt,
  },
  {
    id: 'gold',
    ordersTag: 'orders-gold',
    openOrdersTag: 'openorders-gold',
    delivery720Tag: 'delivery720-gold',
    returnsTag: 'returns-gold',
    label: '🥇 Goldbug',
    accentColor: COMPANY_ACCENT.gold,
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
  // Prefer the real orders-* tag whenever any rows exist. The old ">= 100"
  // threshold wrongly fell back to openorders for agent-scoped logins with
  // fewer than 100 order lines, wiping day charts / Orders Today.
  if (count > 0) return ordersTag
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

export function getOrdersTodayRows(rows: SalesRow[], ordersTag: string, todayStr: string): SalesRow[] {
  return rows
    .filter(r => r.company === ordersTag && normalizeSalesDate(r.date) === todayStr)
    .sort((a, b) => {
      const clientCmp = (a.clientName || a.clientID || '').localeCompare(b.clientName || b.clientID || '')
      if (clientCmp !== 0) return clientCmp
      return (a.itemSKU || '').localeCompare(b.itemSKU || '')
    })
}

export interface OrderTodayGroup {
  key: string
  docNum: string
  clientName: string
  agent: string
  cash: number
  qty: number
  /** Normalized YYYY-MM-DD from line rows when available. */
  orderDate?: string
  lines: SalesRow[]
}

function orderGroupDate(lines: SalesRow[]): string | undefined {
  for (const line of lines) {
    const d = normalizeSalesDate(line.date)
    if (d) return d
  }
  return undefined
}

/** ISO YYYY-MM-DD → DD/MM/YYYY for display. */
export function formatOrderDateDisp(iso: string | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

function orderDocKey(row: SalesRow): string {
  const docNum = String(row.docNum ?? '').trim()
  if (docNum) return docNum
  return `${row.clientID || ''}|${row.clientName || ''}|no-doc`
}

/** Group already-filtered sales rows into order documents (cascade-ready). */
export function groupSalesRowsByDoc(matched: SalesRow[]): OrderTodayGroup[] {
  const byDoc = new Map<string, SalesRow[]>()

  for (const row of matched) {
    const key = orderDocKey(row)
    const bucket = byDoc.get(key)
    if (bucket) bucket.push(row)
    else byDoc.set(key, [row])
  }

  const groups: OrderTodayGroup[] = []
  for (const [key, lines] of byDoc) {
    const { cash, qty } = sumRows(lines)
    const first = lines[0]
    const docNum = String(first.docNum ?? '').trim()
    groups.push({
      key,
      docNum: docNum || '—',
      clientName: first.clientName || first.clientID || '—',
      agent: String(first.agent ?? '').trim(),
      cash,
      qty,
      orderDate: orderGroupDate(lines),
      lines: [...lines].sort((a, b) => (a.itemSKU || '').localeCompare(b.itemSKU || '')),
    })
  }

  return groups.sort((a, b) => {
    const docCmp = a.docNum.localeCompare(b.docNum, undefined, { numeric: true })
    if (docCmp !== 0) return docCmp
    return a.clientName.localeCompare(b.clientName)
  })
}

export function groupOrdersTodayByDoc(
  rows: SalesRow[],
  ordersTag: string,
  todayStr: string,
): OrderTodayGroup[] {
  return groupSalesRowsByDoc(getOrdersTodayRows(rows, ordersTag, todayStr))
}

/** Open-order line rows for a tag (report 721). */
export function getOpenOrdersRows(rows: SalesRow[], openOrdersTag: string): SalesRow[] {
  return rows.filter(r => r.company === openOrdersTag)
}

/**
 * Top N open orders by cash (document totals), each with expandable line items.
 * Not SKU/item ranking — one row per order (doc #).
 */
export function topOpenOrdersByCash(
  rows: SalesRow[],
  openOrdersTag: string,
  limit?: number,
): OrderTodayGroup[] {
  const groups = groupSalesRowsByDoc(getOpenOrdersRows(rows, openOrdersTag))
  const sorted = [...groups].sort((a, b) => b.cash - a.cash || a.docNum.localeCompare(b.docNum))
  return limit == null ? sorted : sorted.slice(0, limit)
}

export interface AgentBreakdownRow {
  agent: string
  clients: number
  qty: number
  cash: number
}

/** Per-agent totals (clients/qty/cash) for a set of already-filtered rows. */
export function computeAgentBreakdown(rows: SalesRow[]): AgentBreakdownRow[] {
  const byAgent = new Map<string, { clients: Set<string>; qty: number; cash: number }>()
  for (const r of rows) {
    const agent = String(r.agent ?? '').trim()
    let e = byAgent.get(agent)
    if (!e) {
      e = { clients: new Set(), qty: 0, cash: 0 }
      byAgent.set(agent, e)
    }
    if (r.clientID) e.clients.add(String(r.clientID))
    e.qty += Number(r.qty) || 0
    e.cash += Number(r.cash) || 0
  }
  return [...byAgent.entries()]
    .map(([agent, e]) => ({ agent, clients: e.clients.size, qty: e.qty, cash: e.cash }))
    .sort((a, b) => b.cash - a.cash)
}

export interface OrdersLast7DayColumn {
  date: string
  /** Display label dd/mm */
  label: string
  total: number
  byAgent: Record<string, number>
  isToday: boolean
}

export interface OrdersLast7DaysResult {
  days: OrdersLast7DayColumn[]
  /** Agents ordered by total cash over the window (desc), stable for color index. */
  agents: string[]
}

function shiftLocalDateStr(todayStr: string, dayOffset: number): string {
  const [y, m, d] = todayStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + dayOffset)
  return localDateStr(dt)
}

function dateLabelDdMmDow(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  const dow = weekdayShortEn(dateStr)
  return dow ? `${d}/${m} ${dow}` : `${d}/${m}`
}

/**
 * Last 7 Sun–Thu workdays ending on/before todayStr (Israel: skip Fri+Sat).
 * Cash by day × agent for Doc 36 / 722 orders. Zero-cash workdays still shown.
 */
export function computeOrdersLast7DaysByAgent(
  rows: SalesRow[],
  ordersTag: string,
  todayStr: string,
): OrdersLast7DaysResult {
  const dayStrs: string[] = []
  let offset = 0
  while (dayStrs.length < 7 && offset < 40) {
    const ds = shiftLocalDateStr(todayStr, -offset)
    offset++
    if (isWeekendFriSat(ds)) continue
    dayStrs.push(ds)
  }
  dayStrs.reverse() // oldest → newest
  const daySet = new Set(dayStrs)

  const byDayAgent = new Map<string, Map<string, number>>()
  for (const ds of dayStrs) byDayAgent.set(ds, new Map())

  const agentTotals = new Map<string, number>()

  for (const r of rows) {
    if (r.company !== ordersTag) continue
    const date = normalizeSalesDate(r.date)
    if (!date || !daySet.has(date)) continue
    const agent = String(r.agent ?? '').trim() || '—'
    const cash = Number(r.cash) || 0
    if (cash === 0) continue
    const dayMap = byDayAgent.get(date)!
    dayMap.set(agent, (dayMap.get(agent) || 0) + cash)
    agentTotals.set(agent, (agentTotals.get(agent) || 0) + cash)
  }

  const agents = [...agentTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([a]) => a)

  const days: OrdersLast7DayColumn[] = dayStrs.map(date => {
    const dayMap = byDayAgent.get(date)!
    const byAgent: Record<string, number> = {}
    let total = 0
    for (const agent of agents) {
      const v = dayMap.get(agent) || 0
      if (v !== 0) byAgent[agent] = v
      total += v
    }
    return {
      date,
      label: dateLabelDdMmDow(date),
      total,
      byAgent,
      isToday: date === todayStr,
    }
  })

  return { days, agents }
}

export function getOrdersMtdRows(
  rows: SalesRow[],
  ordersTag: string,
  monthStart: string,
  todayStr: string,
): SalesRow[] {
  return rows.filter(r => {
    if (r.company !== ordersTag) return false
    const date = normalizeSalesDate(r.date)
    return !!date && date >= monthStart && date <= todayStr
  })
}

export function computeOrdersToday(rows: SalesRow[], ordersTag: string, todayStr: string): OrdersTodayMetrics {
  const matched = getOrdersTodayRows(rows, ordersTag, todayStr)
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
  const matched = getOrdersMtdRows(rows, ordersTag, monthStart, todayStr)
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
  limit?: number | null,
  cashSort: 'high-first' | 'low-first' = 'high-first',
): Top10Item[] {
  const itemMap: Record<string, Top10Item> = {}
  rows.forEach(r => {
    if (!r.itemSKU) return
    const sku = String(r.itemSKU)
    if (!itemMap[sku]) itemMap[sku] = { sku, name: String(r.itemName || sku), cash: 0, qty: 0 }
    itemMap[sku].name = preferItemName(itemMap[sku].name, r.itemName)
    itemMap[sku].cash += Number(r.cash) || 0
    itemMap[sku].qty += Number(r.qty) || 0
  })
  const cmp =
    cashSort === 'low-first'
      ? (a: Top10Item, b: Top10Item) => a.cash - b.cash
      : (a: Top10Item, b: Top10Item) => b.cash - a.cash
  const sorted = Object.values(itemMap).sort(cmp)
  const cap = limit === null ? null : (limit ?? 10)
  return cap == null ? sorted : sorted.slice(0, cap)
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

export interface Delivery720Metrics extends OrdersTodayMetrics {}

/** Report 720 — delivery note rows for the company (no date filter). */
export function computeDelivery720(rows: SalesRow[], delivery720Tag: string): Delivery720Metrics {
  const matched = rows.filter(r => r.company === delivery720Tag)
  const { cash, qty } = sumRows(matched)
  const clients = new Set(matched.map(r => r.clientID).filter(Boolean)).size
  return { clients, cash, qty }
}

export function computeDelivery720Top10(rows: SalesRow[], delivery720Tag: string): Top10Item[] {
  const matched = rows.filter(r => r.company === delivery720Tag)
  return computeTop10BySku(matched)
}

export function computeDelivery720Mtd(
  rows: SalesRow[],
  delivery720Tag: string,
  monthStart: string,
  todayStr: string,
): Delivery720Metrics {
  const matched = rows.filter(
    r => r.company === delivery720Tag && r.date && r.date >= monthStart && r.date <= todayStr,
  )
  const { cash, qty } = sumRows(matched)
  const clients = new Set(matched.map(r => r.clientID).filter(Boolean)).size
  return { clients, cash, qty }
}

export function computeDelivery720MtdTop10(
  rows: SalesRow[],
  delivery720Tag: string,
  monthStart: string,
  todayStr: string,
): Top10Item[] {
  const matched = rows.filter(
    r => r.company === delivery720Tag && r.date && r.date >= monthStart && r.date <= todayStr,
  )
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
