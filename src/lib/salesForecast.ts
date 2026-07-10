import type { SalesRow } from '../types/dashboard'
import type { OversiteDateContext } from './oversiteMetrics'

/**
 * Month-end sales projection from the historical intra-month pattern.
 *
 * Algorithm (backtested on 18 months of daily rep891 data):
 *   1. For each complete past month, build the cumulative share of the month
 *      total at each day 1..31 (carry-forward on no-sale days).
 *   2. Average across months -> curve[d] = typical share of the month done
 *      by day d.
 *   3. baseline = mean of the last 3 complete month totals.
 *   4. projected = mtd + (1 - curve[d]) * baseline
 *      == curve-weighted blend of run-rate projection and baseline:
 *      early in the month it leans on the baseline, late in the month on
 *      actual MTD. Median backtest error: ~28% at day 7, ~19% at day 14,
 *      ~13% at day 21 (pupik; mt/grow noisier).
 *
 * Computed client-side from already-loaded (agent-scoped) rows, so a
 * restricted user gets a projection of their own book only.
 */

const MIN_MONTHS = 4
const MIN_MONTH_TOTAL = 10000
const MAX_LOOKBACK_MONTHS = 24
const BASELINE_MONTHS = 3

export interface SalesForecast {
  projected: number
  mtd: number
  /** Typical share of the month completed by today (0..1). */
  share: number
  monthsUsed: number
  baseline: number
}

export function computeSalesForecast(
  companyRows: SalesRow[],
  company: string,
  ctx: OversiteDateContext,
): SalesForecast | null {
  const { curYear, curMonth, todayStr } = ctx
  const curKey = curYear * 12 + (curMonth - 1)
  const minKey = curKey - MAX_LOOKBACK_MONTHS

  // day-of-month cash per historical month + current-month MTD
  const byMonth = new Map<number, number[]>() // key -> cash[32] by day
  let mtd = 0
  for (const r of companyRows) {
    if (r.company !== company) continue
    const y = Number(r.year)
    const m = Number(r.month)
    if (!y || !m) continue
    const key = y * 12 + (m - 1)
    const cash = Number(r.cash) || 0
    if (key === curKey) {
      mtd += cash
      continue
    }
    if (key >= curKey || key < minKey) continue
    const day = r.date ? Number(String(r.date).slice(8, 10)) : NaN
    if (!Number.isFinite(day) || day < 1 || day > 31) continue
    let days = byMonth.get(key)
    if (!days) {
      days = new Array(32).fill(0)
      byMonth.set(key, days)
    }
    days[day] += cash
  }

  // cumulative share curves for qualifying complete months
  const keys = [...byMonth.keys()].sort((a, b) => a - b)
  const curves: number[][] = []
  const totalsByKey: Array<{ key: number; total: number }> = []
  for (const key of keys) {
    const days = byMonth.get(key)!
    const total = days.reduce((s, v) => s + v, 0)
    if (total < MIN_MONTH_TOTAL) continue
    const curve = new Array(32).fill(0)
    let run = 0
    for (let d = 1; d <= 31; d++) {
      run += days[d]
      curve[d] = run / total
    }
    curves.push(curve)
    totalsByKey.push({ key, total })
  }
  if (curves.length < MIN_MONTHS) return null

  const today = Number(todayStr.slice(8, 10))
  const d = Math.min(Math.max(today, 1), 31)
  const share = curves.reduce((s, c) => s + c[d], 0) / curves.length

  const recent = totalsByKey.slice(-BASELINE_MONTHS)
  const baseline = recent.reduce((s, t) => s + t.total, 0) / recent.length

  const projected = mtd + (1 - share) * baseline
  return { projected, mtd, share, monthsUsed: curves.length, baseline }
}
