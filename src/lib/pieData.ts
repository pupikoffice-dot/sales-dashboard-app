export {
  buildClientPie,
  buildItemPie,
  buildMonthlyBarFromRows,
} from '@dashboard/shared/pieData'
export type { PieEntry } from '@dashboard/shared/pieData'

import type { PieEntry } from '@dashboard/shared/pieData'
import type { SalesRow } from '../types/dashboard'

/** Cash/qty grouped by supplier name — for the Suppliers view pie chart. */
export function buildSupplierPie(rows: SalesRow[]): PieEntry[] {
  const map: Record<string, { cash: number; qty: number }> = {}
  rows.forEach(r => {
    const sup = String(r.supplier || '(No supplier)')
    if (!map[sup]) map[sup] = { cash: 0, qty: 0 }
    map[sup].cash += r.cash || 0
    map[sup].qty += r.qty || 0
  })
  return Object.entries(map).map(([label, v]) => ({ label, value: v.cash, qty: v.qty }))
}
