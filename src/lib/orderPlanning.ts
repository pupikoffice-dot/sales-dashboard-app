/** R&D → Order recommendation and Import stock cover. All numbers come from the database engine (order_engine). */
import { supabase } from './supabase'

export type OrderStatus = 'late' | 'order' | 'out' | 'ok'

/** One item as the engine sees it (rates are per day, quantities in pieces). */
export interface OrderRow {
  sku: string
  item_name: string
  supplier: string
  internal: boolean
  stock: number
  rate12: number
  rate_prior12: number | null
  trend: number
  forecast_rate: number
  sold_months12: number
  sold_qty12: number
  last_sold: string | null
  first_sold: string | null
  ly_ok: boolean
  demand_lead: number
  stock_at_arrival: number
  demand_cover: number
  safety_qty: number
  pipeline_qty: number
  order_qty: number
  run_out: string | null
  order_by: string | null
  months_left: number | null
  oos: boolean
  status: OrderStatus
  lead_months: number | null
  cover_months: number
  safety_months: number
  alert_months: number
  hidden: boolean
  /** B2 open supplier orders, B6 invoices on the way (pieces still to come) */
  b2_qty: number
  b6_qty: number
  b2_due: string | null
  b6_arrival: string | null
  /** last B8 import and the sales speed it shows (pieces per day, counting stops at about 5 pieces left) */
  last_import_date: string | null
  last_import_qty: number | null
  b8_rate: number | null
  b8_days: number | null
  /** the B8 speed differs from the forecast by more than 40% */
  b8_flag: boolean
  /** plain pieces sold: this month so far, last month, last 3 and last 12 full months */
  sales_cur: number
  sales_last: number
  sales_3m: number
  sales_12m: number
  /** document numbers behind b2_qty / b6_qty (comma separated) */
  b2_docs: string | null
  b6_docs: string | null
  /** the whole supplier is hidden */
  sup_hidden: boolean
  /** How rate12 was measured. 'stock' = sales on in-stock working days / those days; 'b8' = from the last B8 import;
   *  'first_sale' = from the first sale in the last 12 months; null = old 12-month average (not enough evidence). */
  rate_basis?: RateBasis | null
  /** working days the rate is based on */
  sellable_days?: number | null
  /** the old 12-month base rate (per day), for comparison */
  rate_old?: number | null
  /** opening stock above which a working day counts as in stock */
  sell_threshold?: number | null
  /** last arrival of any kind: B8 import or 76 local purchase (pieces = the whole document for this item) */
  last_in_date?: string | null
  last_in_qty?: number | null
  last_in_kind?: 'B8' | '76' | null
  last_in_doc?: string | null
}

export type RateBasis = 'stock' | 'b8' | 'first_sale'

/** Short label and hover text for the rate basis column. */
export function rateBasisInfo(r: Pick<OrderRow, 'rate_basis' | 'sellable_days' | 'sell_threshold'>): { label: string; title: string } {
  const days = r.sellable_days ?? 0
  const thr = r.sell_threshold == null ? '' : ` (opening stock above ${Math.round(r.sell_threshold * 10) / 10} pcs)`
  switch (r.rate_basis) {
    case 'stock':
      return { label: `In stock, ${days} d`, title: `Sales on ${days} in-stock working days${thr}, divided by those days. Fridays, Saturdays and out-of-stock days are not counted.` }
    case 'b8':
      return { label: `Since B8, ${days} d`, title: `Too few in-stock days, so: sales since the last B8 import, divided by ${days} working days.` }
    case 'first_sale':
      return { label: `Since 1st sale, ${days} d`, title: `Too few in-stock days, so: sales since the first sale in the last 12 months, divided by ${days} working days.` }
    default:
      return { label: '12-month avg', title: 'Not enough evidence for the in-stock rate, so the old 12-month average is used.' }
  }
}

export interface ImportRow {
  sku: string
  item_name: string
  supplier: string
  internal: boolean
  stock: number
  rate12: number
  forecast_rate: number
  sold_months12: number
  sold_qty12: number
  last_sold: string | null
  months_left: number | null
  run_out: string | null
  oos: boolean
  status: OrderStatus
  hidden: boolean
  b2_qty: number
  b6_qty: number
  b6_arrival: string | null
  b8_rate: number | null
  b8_flag: boolean
  b2_docs: string | null
  b6_docs: string | null
  sup_hidden: boolean
}

export interface SupplierSetting {
  supplier_name: string
  items: number
  lead_months: number | null
  cover_months: number
  safety_months: number
  internal: boolean
  payment_terms: string | null
  payment_days: number | null
  payment_notes: string | null
}

const DAYS_PER_MONTH = 30.4375
export const perMonth = (ratePerDay: number) => ratePerDay * DAYS_PER_MONTH

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? null) as T | null
}

export async function fetchOrderReco(company: string, showHidden: boolean, asUser?: string | null): Promise<OrderRow[] | null> {
  return rpc<OrderRow[]>('get_order_recommendation', { p_company: company, p_show_hidden: showHidden, p_as: asUser ?? null })
}

/** One item's Order recommendation numbers whatever its status. null = no access to the Order recommendation page;
 *  { row: null } = the engine does not list this item (no stock and under 3 selling months in the last 12). */
export async function fetchOrderItem(company: string, sku: string, asUser?: string | null): Promise<{ row: OrderRow | null } | null> {
  return rpc<{ row: OrderRow | null }>('get_order_item', { p_company: company, p_sku: sku, p_as: asUser ?? null })
}

export async function setSupplierHidden(company: string, supplier: string, hidden: boolean): Promise<boolean> {
  return (await rpc<boolean>('set_order_supplier_hidden', { p_company: company, p_supplier: supplier, p_hidden: hidden })) === true
}

export async function fetchImportCover(company: string, showHidden: boolean, asUser?: string | null): Promise<ImportRow[] | null> {
  return rpc<ImportRow[]>('get_import_cover', { p_company: company, p_show_hidden: showHidden, p_as: asUser ?? null })
}

export async function fetchOrderSettings(company: string, asUser?: string | null): Promise<SupplierSetting[] | null> {
  return rpc<SupplierSetting[]>('get_order_settings', { p_company: company, p_as: asUser ?? null })
}

export async function saveOrderSetting(company: string, s: SupplierSetting): Promise<boolean> {
  const ok = await rpc<boolean>('set_order_setting', {
    p_company: company,
    p_supplier: s.supplier_name,
    p_lead_months: s.lead_months,
    p_cover_months: s.cover_months,
    p_safety_months: s.safety_months,
    p_internal: s.internal,
    p_payment_terms: s.payment_terms,
    p_payment_days: s.payment_days,
    p_payment_notes: s.payment_notes,
  })
  return ok === true
}

export async function setItemHidden(company: string, sku: string, hidden: boolean): Promise<boolean> {
  return (await rpc<boolean>('set_order_item_hidden', { p_company: company, p_sku: sku, p_hidden: hidden })) === true
}

/**
 * Column filter text → does the value pass? Text columns: contains (any case). Number columns: `>5`, `>=5`, `<5`, `<=5`, `=5`,
 * `5..20`, or a plain number (equal). Empty filter passes everything.
 */
export function passesFilter(value: string | number | boolean | null | undefined, filter: string, isText: boolean): boolean {
  const f = filter.trim()
  if (!f) return true
  if (isText || typeof value === 'string') return String(value ?? '').toLowerCase().includes(f.toLowerCase())
  if (value === null || value === undefined) return false
  const v = Number(value)
  const range = /^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/.exec(f)
  if (range) return v >= Number(range[1]) && v <= Number(range[2])
  const cmp = /^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/.exec(f)
  if (cmp) {
    const n = Number(cmp[2])
    return cmp[1] === '>' ? v > n : cmp[1] === '<' ? v < n : cmp[1] === '>=' ? v >= n : cmp[1] === '<=' ? v <= n : v === n
  }
  if (/^-?\d+(?:\.\d+)?$/.test(f)) return v === Number(f)
  return String(value).includes(f)
}

export interface SupplierGroup<T> {
  supplier: string
  internal: boolean
  rows: T[]
}

export function groupBySupplier<T extends { supplier: string; internal: boolean }>(rows: readonly T[]): Array<SupplierGroup<T>> {
  const map = new Map<string, SupplierGroup<T>>()
  for (const r of rows) {
    let g = map.get(r.supplier)
    if (!g) {
      g = { supplier: r.supplier, internal: r.internal, rows: [] }
      map.set(r.supplier, g)
    }
    g.rows.push(r)
  }
  return [...map.values()]
}
