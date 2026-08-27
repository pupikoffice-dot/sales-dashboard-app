import { useMemo } from 'react'
import type { SalesRow } from '../types/dashboard'
import { getOrdersMtdRows, getOversiteDateContext, resolveOrdersTag } from '../lib/oversiteMetrics'
import { computeTsometOpenBudgetTotals, type TsometBudgetTotals } from '../lib/tsometBudget'
import { useTsometBudgetData } from './useTsometBudgetData'

export interface TsometOpenBudgetKpi {
  totals: TsometBudgetTotals
  isLoading: boolean
  /** False when module off, still loading, or no budget rows in this agent window. */
  visible: boolean
}

/** Tsomet open-budget total for Sales Manager KPI cubes (Monkeytime + granted only). */
export function useTsometOpenBudgetKpi(
  rows: SalesRow[],
  agents: string[] | null,
  enabled: boolean,
): TsometOpenBudgetKpi {
  const { budget, sales, isLoading } = useTsometBudgetData(enabled)

  const ordersMtdRows = useMemo(() => {
    if (!enabled) return []
    const ctx = getOversiteDateContext()
    const ordersTag = resolveOrdersTag(rows, 'orders-mt')
    return getOrdersMtdRows(rows, ordersTag, ctx.monthStart, ctx.todayStr)
  }, [enabled, rows])

  const totals = useMemo(() => {
    if (!enabled) {
      return { budgetCash: 0, ordersMtdCash: 0, openBudget: 0, salesCash: 0 }
    }
    return computeTsometOpenBudgetTotals({
      budget,
      sales,
      ordersMtdRows,
      agents,
    })
  }, [enabled, budget, sales, ordersMtdRows, agents])

  const visible = enabled && !isLoading && totals.budgetCash > 0

  return { totals, isLoading: enabled && isLoading, visible }
}
