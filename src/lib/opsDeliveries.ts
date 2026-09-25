import type { LogicalCompany } from '../types/dashboard'

/** One row from get_ops_deliveries_monthly (rep893: ZZ1 cartons, ZZ2 pallets). */
export interface OpsDeliveryMonthRow {
  company: string
  ym: string
  cartons: number
  pallets: number
}

export interface DeliveryMonth {
  ym: string
  year: number
  /** 0-based */
  month: number
  cartons: number
  pallets: number
  /** False when the source report has no lines for this month (e.g. before data starts). */
  hasData: boolean
}

export interface DeliveryCompanyBlock {
  company: LogicalCompany
  /** Newest month first. */
  months: DeliveryMonth[]
  maxCartons: number
  maxPallets: number
  totalCartons: number
  totalPallets: number
}

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

function ymOf(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/** `count` months ending with the month of `today`, newest first. */
export function lastNMonths(count: number, today: Date): { ym: string; year: number; month: number }[] {
  const out: { ym: string; year: number; month: number }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    out.push({ ym: ymOf(d.getFullYear(), d.getMonth()), year: d.getFullYear(), month: d.getMonth() })
  }
  return out
}

/**
 * One block per company (never combined) with a card for each of the last `months`
 * months; months without deliveries are 0. Companies with no rows are omitted.
 */
export function buildMonthlyDeliveryBlocks(
  rows: OpsDeliveryMonthRow[],
  companies: LogicalCompany[],
  months = 12,
  today: Date = new Date(),
): DeliveryCompanyBlock[] {
  const window = lastNMonths(months, today)
  const blocks: DeliveryCompanyBlock[] = []
  for (const company of COMPANY_ORDER) {
    if (!companies.includes(company)) continue
    const coRows = rows.filter(r => r.company === company)
    if (coRows.length === 0) continue
    const byYm = new Map(coRows.map(r => [r.ym, r]))
    const monthCards: DeliveryMonth[] = window.map(w => {
      const r = byYm.get(w.ym)
      return { ...w, cartons: Number(r?.cartons) || 0, pallets: Number(r?.pallets) || 0, hasData: !!r }
    })
    blocks.push({
      company,
      months: monthCards,
      maxCartons: Math.max(0, ...monthCards.map(m => m.cartons)),
      maxPallets: Math.max(0, ...monthCards.map(m => m.pallets)),
      totalCartons: monthCards.reduce((s, m) => s + m.cartons, 0),
      totalPallets: monthCards.reduce((s, m) => s + m.pallets, 0),
    })
  }
  return blocks
}

export interface SeriesStats {
  /** Inclusive index range (chronological) used for the average and trend. */
  fromIdx: number
  toIdx: number
  avg: number
  /** Least-squares line over the range: value ≈ intercept + slope * index. */
  slope: number
  intercept: number
}

/**
 * Average and linear trend for a chronological series (current month last).
 * Skips months before the first month with data, and the current (partial) month
 * unless it is the only month with data. Null when there is no data at all.
 */
export function deliverySeriesStats(months: DeliveryMonth[], values: number[]): SeriesStats | null {
  const fromIdx = months.findIndex(m => m.hasData)
  if (fromIdx < 0) return null
  const lastComplete = months.length - 2
  const toIdx = lastComplete >= fromIdx ? lastComplete : months.length - 1
  const n = toIdx - fromIdx + 1
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = fromIdx; i <= toIdx; i++) {
    const y = values[i] ?? 0
    sumX += i
    sumY += y
    sumXY += i * y
    sumXX += i * i
  }
  const avg = sumY / n
  const denom = n * sumXX - sumX * sumX
  const slope = n > 1 && denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const intercept = (sumY - slope * sumX) / n
  return { fromIdx, toIdx, avg, slope, intercept }
}

export type DeliveryEntityKind = 'agent' | 'client'

/** Agent or client with deliveries in the last 12 months (get_ops_delivery_entities). */
export interface DeliveryEntity {
  company: string
  kind: DeliveryEntityKind
  entityId: string
  name: string
  cartons: number
  pallets: number
}

/** Saved per-user chart box (ops_delivery_boxes). */
export interface DeliveryBox {
  id: string
  company: LogicalCompany
  kind: DeliveryEntityKind
  entityId: string
  label: string
}

/**
 * Picker matches for one company + kind: name or number contains `query`
 * (case-insensitive), skipping already-added ids, biggest cartons volume first.
 */
export function filterDeliveryEntities(
  entities: DeliveryEntity[],
  company: string,
  kind: DeliveryEntityKind,
  query: string,
  excludeIds: Set<string>,
  limit = 12,
): DeliveryEntity[] {
  const q = query.trim().toLowerCase()
  return entities
    .filter(
      e =>
        e.company === company &&
        e.kind === kind &&
        !excludeIds.has(e.entityId) &&
        (!q || e.name.toLowerCase().includes(q) || e.entityId.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.cartons - a.cartons || b.pallets - a.pallets || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Bar width 0–100 for `value` against the block max (negative net months render empty). */
export function barPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(100, (value / max) * 100)
}
