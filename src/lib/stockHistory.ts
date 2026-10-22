/** Stock history (Operations): opening and closing stock per item and day. See get_stock_history. */
import { supabase } from './supabase'

export interface StockHistoryRow {
  day: string
  sku: string
  name: string
  open: number | null
  close: number
  /** true = rebuilt from purchases and sales (before the first real reading) */
  est: boolean
}

export interface StockHistoryPayload {
  rows: StockHistoryRow[]
  first: string | null
  last: string | null
}

export async function fetchStockHistory(company: string, from: string, to: string): Promise<StockHistoryPayload> {
  const { data, error } = await supabase.rpc('get_stock_history', { p_company: company, p_from: from, p_to: to })
  if (error) throw error
  const d = (data ?? {}) as Partial<StockHistoryPayload>
  return { rows: d.rows ?? [], first: d.first ?? null, last: d.last ?? null }
}

/** Case-insensitive match on SKU or name. */
export function filterStockHistory(rows: readonly StockHistoryRow[], query: string): StockHistoryRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter(r => r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
}

/** Pieces in stock at the start and end of the period, summed over the rows' first and last day. */
export function stockHistoryTotals(rows: readonly StockHistoryRow[]): { open: number; close: number } {
  if (!rows.length) return { open: 0, close: 0 }
  const days = rows.map(r => r.day).sort()
  const first = days[0]
  const last = days[days.length - 1]
  return {
    open: rows.filter(r => r.day === first).reduce((s, r) => s + (r.open ?? 0), 0),
    close: rows.filter(r => r.day === last).reduce((s, r) => s + r.close, 0),
  }
}

export function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
