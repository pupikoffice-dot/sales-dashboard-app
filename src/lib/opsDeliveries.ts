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
      return { ...w, cartons: Number(r?.cartons) || 0, pallets: Number(r?.pallets) || 0 }
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

/** Bar width 0–100 for `value` against the block max (negative net months render empty). */
export function barPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(100, (value / max) * 100)
}
