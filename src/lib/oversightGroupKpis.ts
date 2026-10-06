import { normalizeSalesDate } from './salesDate'
import type { SalesRow } from '../types/dashboard'

/**
 * Group totals for the Oversight "bento" row: sums of the per-company metrics the page already
 * computed (no new queries), limited to the companies on screen and the sections the user may see.
 */

export interface GroupKpiInput {
  salesMtd: { cash: number; lyCash: number }
  /** Last year's sales for the same month up to the same day (fair month-to-date comparison). */
  salesLyToDate: number
  delivery720Mtd: { cash: number }
  ordersToday: { clients: number; cash: number }
  ordersMtd: { clients: number; cash: number }
  openOrders: { qty: number; cash: number }
  returnsMtd: { cash: number }
  debtSummary: { grandTotal: number } | null
}

export type GroupKpiId = 'salesMtd' | 'ordersToday' | 'ordersMtd' | 'openOrders' | 'debt' | 'returns'

export interface GroupKpi {
  id: GroupKpiId
  value: number
  /** Secondary number (clients, qty); null when none. */
  sub: number | null
  /** Change vs the same month last year in %, sales only; null when last year is 0 or unknown. */
  lyPct: number | null
}

export interface GroupKpiOptions {
  /** Which sections the user may see (Oversight module gates). */
  show: (id: GroupKpiId) => boolean
  /** Count delivery notes (720) in sales, like the per-company sales card does when that module is on. */
  includeDeliveryNotes: boolean
}

export function computeGroupKpis(cols: GroupKpiInput[], opts: GroupKpiOptions): GroupKpi[] {
  if (!cols.length) return []
  const sum = (f: (c: GroupKpiInput) => number) => cols.reduce((a, c) => a + (f(c) || 0), 0)

  const sales = sum(c => c.salesMtd.cash + (opts.includeDeliveryNotes ? c.delivery720Mtd.cash : 0))
  const ly = sum(c => c.salesLyToDate)
  const out: GroupKpi[] = [
    { id: 'salesMtd', value: sales, sub: null, lyPct: ly > 0 ? ((sales - ly) / ly) * 100 : null },
    { id: 'ordersToday', value: sum(c => c.ordersToday.cash), sub: sum(c => c.ordersToday.clients), lyPct: null },
    { id: 'ordersMtd', value: sum(c => c.ordersMtd.cash), sub: sum(c => c.ordersMtd.clients), lyPct: null },
    { id: 'openOrders', value: sum(c => c.openOrders.cash), sub: sum(c => c.openOrders.qty), lyPct: null },
    { id: 'debt', value: sum(c => c.debtSummary?.grandTotal ?? 0), sub: null, lyPct: null },
    { id: 'returns', value: sum(c => c.returnsMtd.cash), sub: null, lyPct: null },
  ]
  return out.filter(k => opts.show(k.id))
}

/** Sales cash of `company` in the same month last year, days 1..`day` only. */
export function salesLyToDate(rows: SalesRow[], company: string, curYear: number, curMonth: number, day: number): number {
  let cash = 0
  for (const r of rows) {
    if (r.company !== company || Number(r.year) !== curYear - 1 || Number(r.month) !== curMonth) continue
    const d = normalizeSalesDate(r.date)
    if (!d || Number(d.slice(8, 10)) > day) continue
    cash += Number(r.cash) || 0
  }
  return cash
}
