import { csvCell } from './csvExport'
import { supabase } from './supabase'

/**
 * R&D client card -> "Search sales": every invoice line one client (or a chain's stores) bought for an item.
 *
 * Scoping (company, Purchase insights module, agent ownership, hidden years, View-as) happens in the database function
 * get_client_item_sales, the same rules as the client card. This module never reads a table directly.
 */

export const MIN_QUERY_LENGTH = 2

export interface ItemSalesLine {
  /** YYYY-MM-DD */
  date: string
  docNum: string
  docType: string
  clientID: string
  sku: string
  name: string
  qty: number
  /** Line total */
  cash: number
  /** Unit price paid = line total / qty; null when qty is 0. */
  price: number | null
  discountPct: number | null
  discountCash: number | null
  /** Credit invoice line (document 14 with negative cash). Shown, but kept out of the price statistics. */
  isReturn: boolean
}

export interface ItemSalesResult {
  /** Lines matching, before the database cap; larger than rows.length when the list was cut. */
  total: number
  rows: ItemSalesLine[]
}

export interface ItemSalesSummary {
  /** Sold lines (credits excluded) */
  lines: number
  qty: number
  amount: number
  /** Weighted average: amount / qty */
  avgPrice: number | null
  minPrice: number | null
  maxPrice: number | null
  firstDate: string | null
  lastDate: string | null
  invoices: number
  creditQty: number
  creditAmount: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const str = (v: unknown): string => (v == null ? '' : String(v))

export function parseItemSales(raw: unknown): ItemSalesResult {
  const o = (raw ?? {}) as { total?: unknown; rows?: unknown }
  const rows = Array.isArray(o.rows) ? o.rows : []
  return {
    total: num(o.total),
    rows: rows.map((r: Record<string, unknown>) => ({
      date: str(r.date),
      docNum: str(r.docNum),
      docType: str(r.docType),
      clientID: str(r.clientID),
      sku: str(r.sku),
      name: str(r.name),
      qty: num(r.qty),
      cash: num(r.cash),
      price: numOrNull(r.price),
      discountPct: numOrNull(r.discountPct),
      discountCash: numOrNull(r.discountCash),
      isReturn: r.isReturn === true,
    })),
  }
}

/** Stable key for one invoice (document type + number are only unique together). */
export const salesInvoiceKey = (l: Pick<ItemSalesLine, 'docType' | 'docNum'>): string => `${l.docType}/${l.docNum}`

/** True when the search text is long enough to send. */
export const queryReady = (q: string): boolean => q.trim().length >= MIN_QUERY_LENGTH

export function summarizeItemSales(rows: readonly ItemSalesLine[]): ItemSalesSummary {
  let qty = 0
  let amount = 0
  let lines = 0
  let creditQty = 0
  let creditAmount = 0
  let min: number | null = null
  let max: number | null = null
  let first: string | null = null
  let last: string | null = null
  const invoices = new Set<string>()
  for (const r of rows) {
    if (r.isReturn) {
      creditQty += Math.abs(r.qty)
      creditAmount += Math.abs(r.cash)
      continue
    }
    lines += 1
    qty += r.qty
    amount += r.cash
    invoices.add(salesInvoiceKey(r))
    if (r.price != null) {
      min = min == null ? r.price : Math.min(min, r.price)
      max = max == null ? r.price : Math.max(max, r.price)
    }
    if (r.date) {
      if (first == null || r.date < first) first = r.date
      if (last == null || r.date > last) last = r.date
    }
  }
  return {
    lines,
    qty,
    amount,
    avgPrice: qty > 0 ? amount / qty : null,
    minPrice: min,
    maxPrice: max,
    firstDate: first,
    lastDate: last,
    invoices: invoices.size,
    creditQty,
    creditAmount,
  }
}

/** Points for the price-over-time chart: sold lines with a price, oldest first. */
export function pricePoints(rows: readonly ItemSalesLine[]): { date: string; price: number }[] {
  return rows
    .filter(r => !r.isReturn && r.price != null && r.price > 0 && r.date)
    .map(r => ({ date: r.date, price: r.price as number }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

const CSV_HEAD = ['Date', 'Document', 'Type', 'SKU', 'Item', 'Qty', 'Unit price', 'Line total', 'Discount %', 'Discount amount']

export function itemSalesCsv(rows: readonly ItemSalesLine[]): string {
  const cell = (v: number | null) => (v == null ? '' : String(v))
  const lines = rows.map(r =>
    [r.date, r.docNum, r.docType, r.sku, r.name, String(r.qty), cell(r.price), String(r.cash), cell(r.discountPct), cell(r.discountCash)]
      .map(csvCell)
      .join(','),
  )
  return [CSV_HEAD.map(csvCell).join(','), ...lines].join('\r\n')
}

export async function fetchClientItemSales(
  company: string,
  clientId: string,
  query: string,
  from: string | null,
  to: string | null,
  asUser?: string | null,
): Promise<ItemSalesResult> {
  const { data, error } = await supabase.rpc('get_client_item_sales', {
    p_company: company,
    p_client_id: clientId,
    p_query: query.trim(),
    p_from: from || null,
    p_to: to || null,
    p_as: asUser ?? null,
  })
  if (error) throw error
  return parseItemSales(data)
}
