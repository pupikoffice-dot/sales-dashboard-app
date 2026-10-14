/** One row of get_stock_by_brand(): current WMS stock of one brand (supplier) in one company. */
export interface BrandStockRow {
  co: string
  brand: string
  items: number
  inStock: number
  units: number
  /** Stock value at cost; null for users who may not see cost. */
  value: number | null
  /** Stocked items of this brand that have no cost on file (their value is not counted). */
  noCost: number | null
}

export interface BrandStockPayload {
  rows: BrandStockRow[]
  showValue: boolean
}

/** "View as user": cut the admin's own payload down to the previewed user's companies and cost permission. */
export function maskBrandPayloadForPreview(
  p: BrandStockPayload,
  scope: { companies: readonly string[]; showItemCost: boolean },
): BrandStockPayload {
  const co = new Set(scope.companies)
  const showValue = p.showValue && scope.showItemCost
  return {
    showValue,
    rows: p.rows
      .filter(r => co.has(r.co))
      .map(r => (showValue ? r : { ...r, value: null, noCost: null })),
  }
}

export interface PieSlice {
  label: string
  units: number
}

export type PieMetric = 'units' | 'value'

/**
 * Brands for a pie by quantity (units) or by cash (value at cost): the biggest `top` brands, everything else together
 * as one slice. Brands with nothing to show (no stock, or no value) are left out. `units` in a slice is the metric's amount.
 */
export function pieSlices(rows: BrandStockRow[], top = 9, otherLabel = 'Other', metric: PieMetric = 'units'): PieSlice[] {
  const sorted = rows
    .map(r => ({ label: r.brand, units: Number(metric === 'value' ? r.value : r.units) || 0 }))
    .filter(r => r.units > 0)
    .sort((a, b) => b.units - a.units)
  if (sorted.length <= top + 1) return sorted
  const head = sorted.slice(0, top)
  const rest = sorted.slice(top).reduce((s, r) => s + r.units, 0)
  return [...head, { label: otherLabel, units: rest }]
}

export type BrandSortKey = 'brand' | 'items' | 'inStock' | 'units' | 'value' | 'share'

export interface BrandStockTotals {
  items: number
  inStock: number
  units: number
  value: number | null
  noCost: number
}

/** Companies that have stock rows, in the order the sidebar uses. */
export function companiesWithStock(rows: BrandStockRow[], order: readonly string[]): string[] {
  const present = new Set(rows.map(r => r.co))
  const known = order.filter(c => present.has(c))
  const extra = [...present].filter(c => !order.includes(c)).sort()
  return [...known, ...extra]
}

export function brandsForCompany(rows: BrandStockRow[], company: string): BrandStockRow[] {
  return rows.filter(r => r.co === company)
}

export function brandTotals(rows: BrandStockRow[], showValue: boolean): BrandStockTotals {
  let value = 0
  let hasValue = false
  const t: BrandStockTotals = { items: 0, inStock: 0, units: 0, value: null, noCost: 0 }
  for (const r of rows) {
    t.items += r.items
    t.inStock += r.inStock
    t.units += Number(r.units) || 0
    t.noCost += r.noCost ?? 0
    if (showValue && r.value != null) {
      value += Number(r.value)
      hasValue = true
    }
  }
  t.value = hasValue ? value : null
  return t
}

export function sortBrandRows(
  rows: BrandStockRow[],
  key: BrandSortKey,
  dir: 'asc' | 'desc',
  totalUnits: number,
): BrandStockRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const num = (r: BrandStockRow): number => {
    switch (key) {
      case 'items': return r.items
      case 'inStock': return r.inStock
      case 'units':
      case 'share': return Number(r.units) || 0
      case 'value': return r.value == null ? -Infinity : Number(r.value)
      default: return 0
    }
  }
  void totalUnits // share is units / total, so ordering by units is the same ordering
  return [...rows].sort((a, b) => {
    if (key === 'brand') return sign * a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' })
    const d = num(a) - num(b)
    return d !== 0 ? sign * d : a.brand.localeCompare(b.brand)
  })
}

export function filterBrandRows(rows: BrandStockRow[], query: string): BrandStockRow[] {
  const q = query.trim().toLowerCase()
  return q ? rows.filter(r => r.brand.toLowerCase().includes(q)) : rows
}
