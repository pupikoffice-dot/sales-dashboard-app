import type { LogicalCompany, SalesRow } from '../types/dashboard'

export interface HabitConfig {
  habitX: number
  habitY: number
}

export interface BiMissedItem {
  sku: string
  name: string
  monthsHit: number
  monthsWindow: number
  cash: number
  qty: number
  stock: number
}

export interface BiMissedClient {
  clientId: string
  clientName: string
  monthsHit: number
  monthsWindow: number
  cash: number
  qty: number
}

export interface BiItemSoldByOthers {
  sku: string
  name: string
  othersCash: number
  othersQty: number
}

export type BiHabitResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; reason: 'insufficient_history'; items: [] }

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Last Y calendar months including current, oldest → newest. */
export function lastYMonthKeys(curYear: number, curMonth: number, y: number): string[] {
  const out: string[] = []
  let yy = curYear
  let mm = curMonth
  for (let i = 0; i < y; i++) {
    out.push(ymKey(yy, mm))
    mm -= 1
    if (mm < 1) {
      mm = 12
      yy -= 1
    }
  }
  return out.reverse()
}

/** Previous Y calendar months excluding current, oldest → newest. */
export function previousYMonthKeys(curYear: number, curMonth: number, y: number): string[] {
  let yy = curYear
  let mm = curMonth - 1
  if (mm < 1) {
    mm = 12
    yy -= 1
  }
  return lastYMonthKeys(yy, mm, y)
}

function narrowAgents(rows: SalesRow[], agents: string[] | null): SalesRow[] {
  if (!agents || agents.length === 0) return rows
  const set = new Set(agents.map(String))
  return rows.filter(r => set.has(String(r.agent ?? '')))
}

function isCompanySalesRow(r: SalesRow, company: LogicalCompany): boolean {
  return r.company === company
}

function rowYm(r: SalesRow): string | null {
  const y = Number(r.year)
  const m = Number(r.month)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
  return ymKey(y, m)
}

export interface BuildMissedItemsArgs {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  habit: HabitConfig
  curYear: number
  curMonth: number
  /** sku → qty; missing key = skip (treat as OOS). */
  stockBySku: Record<string, number>
  limit?: number
}

export function buildMissedItems(args: BuildMissedItemsArgs): BiHabitResult<BiMissedItem> {
  const limit = args.limit ?? 10
  const windowKeys = lastYMonthKeys(args.curYear, args.curMonth, args.habit.habitY)
  const windowSet = new Set(windowKeys)

  let scoped = narrowAgents(
    args.rows.filter(r => isCompanySalesRow(r, args.company)),
    args.agents,
  )
  scoped = scoped.filter(r => {
    const k = rowYm(r)
    return k != null && windowSet.has(k)
  })

  const monthsPresent = new Set<string>()
  for (const r of scoped) {
    const k = rowYm(r)
    if (k) monthsPresent.add(k)
  }
  const yEff = monthsPresent.size
  if (yEff < args.habit.habitX) {
    return { ok: false, reason: 'insufficient_history', items: [] }
  }

  type Agg = { name: string; cash: number; qty: number; months: Set<string> }
  const bySku = new Map<string, Agg>()
  for (const r of scoped) {
    const sku = String(r.itemSKU ?? '').trim()
    if (!sku) continue
    const k = rowYm(r)!
    let e = bySku.get(sku)
    if (!e) {
      e = { name: String(r.itemName ?? sku), cash: 0, qty: 0, months: new Set() }
      bySku.set(sku, e)
    }
    const cash = Number(r.cash) || 0
    const qty = Number(r.qty) || 0
    e.cash += cash
    e.qty += qty
    if (cash !== 0 || qty !== 0) e.months.add(k)
    if (r.itemName) e.name = String(r.itemName)
  }

  const usual = [...bySku.entries()]
    .filter(([, e]) => e.months.size >= args.habit.habitX)
    .map(([sku, e]) => ({
      sku,
      name: e.name,
      monthsHit: e.months.size,
      monthsWindow: args.habit.habitY,
      cash: e.cash,
      qty: e.qty,
      stock: 0,
    }))
    .sort((a, b) => b.cash - a.cash || b.qty - a.qty || a.sku.localeCompare(b.sku))

  const out: BiMissedItem[] = []
  for (const it of usual) {
    if (!(it.sku in args.stockBySku)) continue
    const stock = Number(args.stockBySku[it.sku]) || 0
    if (stock <= 0) continue
    out.push({ ...it, stock })
    if (out.length >= limit) break
  }
  return { ok: true, items: out }
}

export interface BuildMissedClientsArgs {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  habit: HabitConfig
  curYear: number
  curMonth: number
  /**
   * Company open-orders row tag (e.g. `openorders` for Pupik).
   * Any open-order row for the agent scope counts as "has open orders this month".
   */
  openOrdersTag: string | null
  limit?: number
}

/**
 * Missed clients = usual buyers in the previous Y months (X-of-Y habit)
 * who have neither invoices nor open orders in the current month.
 */
export function buildMissedClients(args: BuildMissedClientsArgs): BiHabitResult<BiMissedClient> {
  const limit = args.limit ?? 10
  const windowKeys = previousYMonthKeys(args.curYear, args.curMonth, args.habit.habitY)
  const windowSet = new Set(windowKeys)

  const agentScoped = narrowAgents(args.rows, args.agents)

  /** Clients already active this month → cannot be "missed". */
  const activeThisMonth = new Set<string>()
  for (const r of agentScoped) {
    const id = String(r.clientID ?? '').trim()
    if (!id) continue
    const cash = Number(r.cash) || 0
    const qty = Number(r.qty) || 0
    if (isCompanySalesRow(r, args.company) && Number(r.year) === args.curYear && Number(r.month) === args.curMonth) {
      if (cash !== 0 || qty !== 0) activeThisMonth.add(id)
      continue
    }
    if (args.openOrdersTag && r.company === args.openOrdersTag) {
      activeThisMonth.add(id)
    }
  }

  const habitRows = agentScoped.filter(r => {
    if (!isCompanySalesRow(r, args.company)) return false
    const k = rowYm(r)
    return k != null && windowSet.has(k)
  })

  const monthsPresent = new Set<string>()
  for (const r of habitRows) {
    const k = rowYm(r)
    if (k) monthsPresent.add(k)
  }
  if (monthsPresent.size < args.habit.habitX) {
    return { ok: false, reason: 'insufficient_history', items: [] }
  }

  type Agg = { name: string; cash: number; qty: number; months: Set<string> }
  const byClient = new Map<string, Agg>()
  for (const r of habitRows) {
    const id = String(r.clientID ?? '').trim()
    if (!id || activeThisMonth.has(id)) continue
    const k = rowYm(r)!
    let e = byClient.get(id)
    if (!e) {
      e = { name: String(r.clientName ?? id), cash: 0, qty: 0, months: new Set() }
      byClient.set(id, e)
    }
    const cash = Number(r.cash) || 0
    const qty = Number(r.qty) || 0
    e.cash += cash
    e.qty += qty
    if (cash !== 0 || qty !== 0) e.months.add(k)
    if (r.clientName) e.name = String(r.clientName)
  }

  const items = [...byClient.entries()]
    .filter(([, e]) => e.months.size >= args.habit.habitX)
    .map(([clientId, e]) => ({
      clientId,
      clientName: e.name,
      monthsHit: e.months.size,
      monthsWindow: args.habit.habitY,
      cash: e.cash,
      qty: e.qty,
    }))
    .sort((a, b) => b.cash - a.cash || b.qty - a.qty || a.clientId.localeCompare(b.clientId))
    .slice(0, limit)

  return { ok: true, items }
}

export interface BuildItemsSoldByOthersArgs {
  rows: SalesRow[]
  company: LogicalCompany
  agentId: string
  suiteAgents: string[]
  curYear: number
  curMonth: number
  limit?: number
}

export function buildItemsSoldByOthers(args: BuildItemsSoldByOthersArgs): BiItemSoldByOthers[] {
  const limit = args.limit ?? 10
  const suite = new Set(args.suiteAgents.map(String))
  const self = String(args.agentId)
  const mtd = args.rows.filter(
    r =>
      isCompanySalesRow(r, args.company) &&
      Number(r.year) === args.curYear &&
      Number(r.month) === args.curMonth,
  )

  const selfSkus = new Set<string>()
  const others = new Map<string, { name: string; cash: number; qty: number }>()

  for (const r of mtd) {
    const agent = String(r.agent ?? '')
    const sku = String(r.itemSKU ?? '').trim()
    if (!sku || !suite.has(agent)) continue
    if (agent === self) {
      selfSkus.add(sku)
      continue
    }
    let e = others.get(sku)
    if (!e) {
      e = { name: String(r.itemName ?? sku), cash: 0, qty: 0 }
      others.set(sku, e)
    }
    e.cash += Number(r.cash) || 0
    e.qty += Number(r.qty) || 0
    if (r.itemName) e.name = String(r.itemName)
  }

  return [...others.entries()]
    .filter(([sku]) => !selfSkus.has(sku))
    .map(([sku, e]) => ({
      sku,
      name: e.name,
      othersCash: e.cash,
      othersQty: e.qty,
    }))
    .sort((a, b) => b.othersCash - a.othersCash || b.othersQty - a.othersQty || a.sku.localeCompare(b.sku))
    .slice(0, limit)
}
