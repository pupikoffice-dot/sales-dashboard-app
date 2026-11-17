import { normalizeSalesDate } from './salesDate'
import type { SalesRow } from '../types/dashboard'

/**
 * Header meters for Oversight: "where are we vs last year" for the year and for the quarter.
 * Goal = what the same period brought last year IN FULL. Done = this year so far.
 * Pace marker = what last year had reached by the same calendar day (so on/ahead of pace is visible).
 */

/** Companies that carry the year / quarter meters (the ones with the main Oversight details). */
export const METER_COMPANIES: readonly string[] = ['pupik', 'mt', 'gold']

/** Companies combined in the group-totals header meters. */
export const GROUP_METER_COMPANIES: readonly string[] = ['pupik', 'mt']

export interface PeriodMeter {
  /** Cash sold in the period so far (this year). */
  done: number
  /** Last year's whole period = the goal. */
  goal: number
  /** Last year's cash up to the same calendar day. */
  lyToDate: number
  /** done / goal in %, null when there is no goal (last year had no sales). */
  pct: number | null
  /** goal - done. Positive = still missing; negative = already above the goal. */
  gap: number
  /** lyToDate / goal in %: where the pace marker sits on the bar. */
  pacePct: number | null
}

export interface PeriodMeters {
  year: PeriodMeter
  quarter: PeriodMeter
  quarterNo: 1 | 2 | 3 | 4
  curYear: number
}

function build(done: number, goal: number, lyToDate: number): PeriodMeter {
  return {
    done,
    goal,
    lyToDate,
    pct: goal > 0 ? (done / goal) * 100 : null,
    gap: goal - done,
    pacePct: goal > 0 ? (lyToDate / goal) * 100 : null,
  }
}

/** Year and quarter meters for the given companies, as of `todayStr` (YYYY-MM-DD). */
export function computePeriodMeters(rows: SalesRow[], companies: ReadonlySet<string>, todayStr: string): PeriodMeters {
  const curYear = Number(todayStr.slice(0, 4))
  const todayMonth = Number(todayStr.slice(5, 7))
  const todayDay = Number(todayStr.slice(8, 10))
  const quarterNo = (Math.floor((todayMonth - 1) / 3) + 1) as 1 | 2 | 3 | 4
  const qFirst = (quarterNo - 1) * 3 + 1
  const qLast = qFirst + 2

  let yDone = 0, yGoal = 0, yLyTd = 0
  let qDone = 0, qGoal = 0, qLyTd = 0

  for (const r of rows) {
    if (!companies.has(r.company)) continue
    const year = Number(r.year)
    if (year !== curYear && year !== curYear - 1) continue
    const month = Number(r.month)
    const cash = Number(r.cash) || 0
    const inQuarter = month >= qFirst && month <= qLast
    if (year === curYear) {
      yDone += cash
      if (inQuarter) qDone += cash
      continue
    }
    yGoal += cash
    if (inQuarter) qGoal += cash
    // Last year up to the same calendar day.
    const d = normalizeSalesDate(r.date)
    const day = d ? Number(d.slice(8, 10)) : 0
    const upToToday = month < todayMonth || (month === todayMonth && day <= todayDay)
    if (upToToday) {
      yLyTd += cash
      if (inQuarter) qLyTd += cash
    }
  }

  return { year: build(yDone, yGoal, yLyTd), quarter: build(qDone, qGoal, qLyTd), quarterNo, curYear }
}

export interface MarginMonth {
  year: number
  month: number
  cost: number | null | undefined
  covered: number | null | undefined
}

/**
 * Same meters for gross margin (covered sales - cost, items without a cost left out, see grossMargin.ts).
 * Margins exist per month only, so the pace marker takes last year's whole months before today's month
 * plus the same share of the current month as the days passed.
 */
export function computeMarginMeters(months: readonly MarginMonth[], todayStr: string): PeriodMeters {
  const curYear = Number(todayStr.slice(0, 4))
  const todayMonth = Number(todayStr.slice(5, 7))
  const todayDay = Number(todayStr.slice(8, 10))
  const quarterNo = (Math.floor((todayMonth - 1) / 3) + 1) as 1 | 2 | 3 | 4
  const qFirst = (quarterNo - 1) * 3 + 1
  const qLast = qFirst + 2
  const share = todayDay / new Date(curYear, todayMonth, 0).getDate()

  let yDone = 0, yGoal = 0, yLyTd = 0
  let qDone = 0, qGoal = 0, qLyTd = 0
  for (const r of months) {
    const year = Number(r.year)
    const month = Number(r.month)
    if (year !== curYear && year !== curYear - 1) continue
    const margin = (Number(r.covered) || 0) - (Number(r.cost) || 0)
    const inQuarter = month >= qFirst && month <= qLast
    if (year === curYear) {
      yDone += margin
      if (inQuarter) qDone += margin
      continue
    }
    yGoal += margin
    if (inQuarter) qGoal += margin
    const part = month < todayMonth ? margin : month === todayMonth ? margin * share : 0
    yLyTd += part
    if (inQuarter) qLyTd += part
  }
  return { year: build(yDone, yGoal, yLyTd), quarter: build(qDone, qGoal, qLyTd), quarterNo, curYear }
}
