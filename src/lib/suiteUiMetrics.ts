import type { LogicalCompany, SalesRow } from '../types/dashboard'
import { preferItemName } from './itemNames'

export interface SuiteBestSoldItem {
  sku: string
  name: string
  cash: number
  qty: number
}

export interface SuiteBestClient {
  clientId: string
  clientName: string
  cash: number
}

function narrowAgents(rows: SalesRow[], agents: string[] | null): SalesRow[] {
  if (!agents || agents.length === 0) return rows
  const set = new Set(agents.map(String))
  return rows.filter(r => set.has(String(r.agent ?? '')))
}

function mtdCompanyRows(
  rows: SalesRow[],
  company: LogicalCompany,
  agents: string[] | null,
  curYear: number,
  curMonth: number,
  mtdPrefiltered?: boolean,
): SalesRow[] {
  if (mtdPrefiltered) return rows
  return narrowAgents(rows, agents).filter(
    r =>
      r.company === company &&
      Number(r.year) === curYear &&
      Number(r.month) === curMonth,
  )
}

/** Top 10 SKUs by MTD cash for company × agents. */
export function buildBestSoldItems(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  curYear: number
  curMonth: number
  limit?: number | null
  /** When true, `rows` are already company×agents×MTD. */
  mtdPrefiltered?: boolean
}): SuiteBestSoldItem[] {
  const cap = args.limit === null ? null : (args.limit ?? 10)
  const scoped = mtdCompanyRows(
    args.rows,
    args.company,
    args.agents,
    args.curYear,
    args.curMonth,
    args.mtdPrefiltered,
  )
  const bySku = new Map<string, SuiteBestSoldItem>()
  for (const r of scoped) {
    const sku = String(r.itemSKU ?? '').trim()
    if (!sku) continue
    let e = bySku.get(sku)
    if (!e) {
      e = { sku, name: String(r.itemName ?? sku), cash: 0, qty: 0 }
      bySku.set(sku, e)
    }
    e.cash += Number(r.cash) || 0
    e.qty += Number(r.qty) || 0
    e.name = preferItemName(e.name, r.itemName)
  }
  return [...bySku.values()]
    .sort((a, b) => b.cash - a.cash || b.qty - a.qty || a.sku.localeCompare(b.sku))
    .slice(0, cap ?? undefined)
}

/** Top 10 clients by MTD cash for company × agents. */
export function buildBestClients(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  curYear: number
  curMonth: number
  limit?: number | null
  /** When true, `rows` are already company×agents×MTD. */
  mtdPrefiltered?: boolean
}): SuiteBestClient[] {
  const cap = args.limit === null ? null : (args.limit ?? 10)
  const scoped = mtdCompanyRows(
    args.rows,
    args.company,
    args.agents,
    args.curYear,
    args.curMonth,
    args.mtdPrefiltered,
  )
  const byClient = new Map<string, SuiteBestClient>()
  for (const r of scoped) {
    const id = String(r.clientID ?? '').trim()
    if (!id) continue
    let e = byClient.get(id)
    if (!e) {
      e = { clientId: id, clientName: String(r.clientName ?? id), cash: 0 }
      byClient.set(id, e)
    }
    e.cash += Number(r.cash) || 0
    if (r.clientName) e.clientName = String(r.clientName)
  }
  return [...byClient.values()]
    .sort((a, b) => b.cash - a.cash || a.clientId.localeCompare(b.clientId))
    .slice(0, cap ?? undefined)
}
