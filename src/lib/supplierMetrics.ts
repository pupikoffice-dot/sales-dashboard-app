import type { SalesRow } from '../types/dashboard'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Supplier buckets that are internal (the companies themselves — where
 * numeric/'*' SKUs land) or a catch-all local vendor — hidden from the
 * supplier-analysis tables (Suppliers view options + Oversight matrix).
 */
export const HIDDEN_SUPPLIERS = new Set([
  'Pupik',
  'Monkeytime',
  'Grow',
  'Gold',
  'Local Sup',
  '(No supplier)',
])

export function isHiddenSupplier(name: string | undefined | null): boolean {
  return HIDDEN_SUPPLIERS.has(String(name ?? '').trim())
}

export interface SupplierMonthRow {
  supplier: string
  monthly: number[]
  total: number
  avg: number
}

export interface SupplierMonthlyMatrix {
  months: { ym: string; label: string; isCurrent: boolean }[]
  suppliers: SupplierMonthRow[]
  /** Per-month totals across all suppliers (same length as months). */
  monthTotals: number[]
  grandTotal: number
  grandAvg: number
}

/**
 * Per-supplier monthly sales over the rolling 12 months ending at the current
 * month, plus each supplier's monthly average — so the Oversight matrix shows
 * "monthly sales per supplier vs yearly average". Built from rep891 sales rows
 * (company tag === co.id); supplier comes from the row's resolved supplier name.
 */
export function computeSupplierMonthlyMatrix(
  companyRows: SalesRow[],
  company: string,
  ctx: { curYear: number; curMonth: number },
): SupplierMonthlyMatrix | null {
  const anchor = new Date(ctx.curYear, ctx.curMonth - 1, 1)
  const months: SupplierMonthlyMatrix['months'] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    months.push({
      ym: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      isCurrent: i === 0,
    })
  }
  const idx = new Map(months.map((m, i) => [m.ym, i]))

  const bySup = new Map<string, number[]>()
  for (const r of companyRows) {
    if (r.company !== company) continue // rep891 sales rows are tagged with the bare company id
    const ym = `${Number(r.year)}-${Number(r.month)}`
    const mi = idx.get(ym)
    if (mi === undefined) continue
    const sup = String(r.supplier || '(No supplier)')
    if (isHiddenSupplier(sup)) continue // internal/company + Local Sup hidden from supplier tables
    let arr = bySup.get(sup)
    if (!arr) {
      arr = months.map(() => 0)
      bySup.set(sup, arr)
    }
    arr[mi] += Number(r.cash) || 0
  }

  const suppliers = [...bySup.entries()]
    .map(([supplier, monthly]) => {
      const total = monthly.reduce((a, b) => a + b, 0)
      return { supplier, monthly, total, avg: total / months.length }
    })
    .filter(s => Math.round(s.total) !== 0)
    .sort((a, b) => b.total - a.total)

  if (!suppliers.length) return null

  const monthTotals = months.map((_, i) => suppliers.reduce((s, sup) => s + sup.monthly[i], 0))
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0)
  return { months, suppliers, monthTotals, grandTotal, grandAvg: grandTotal / months.length }
}
