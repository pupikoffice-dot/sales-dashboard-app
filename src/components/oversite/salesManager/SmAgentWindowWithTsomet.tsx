import type { ReactNode } from 'react'
import type { SalesRow } from '../../../types/dashboard'
import { useTsometOpenBudgetKpi } from '../../../hooks/useTsometOpenBudgetKpi'
import { SmAgentWindow, type SmAgentWindowProps } from './SmAgentWindow'
import type { SmTsometOpenBudgetKpiProps } from './SmCubeGrid'

function toTsometCubeProp(
  showTsomet: boolean,
  kpi: ReturnType<typeof useTsometOpenBudgetKpi>,
): SmTsometOpenBudgetKpiProps | null {
  if (!showTsomet || (!kpi.isLoading && !kpi.visible)) return null
  return {
    openBudget: kpi.totals.openBudget,
    budgetCash: kpi.totals.budgetCash,
    isLoading: kpi.isLoading,
  }
}

export interface SmAgentWindowWithTsometProps extends SmAgentWindowProps {
  showTsomet: boolean
  tsometAgents: string[] | null
  rows: SalesRow[]
}

/** Agent window with optional Tsomet open-budget KPI cube (Monkeytime only). */
export function SmAgentWindowWithTsomet({
  showTsomet,
  tsometAgents,
  rows,
  ...windowProps
}: SmAgentWindowWithTsometProps) {
  const kpi = useTsometOpenBudgetKpi(rows, tsometAgents, showTsomet)
  return (
    <SmAgentWindow {...windowProps} tsometOpenBudget={toTsometCubeProp(showTsomet, kpi)} />
  )
}

export interface SmVsCompanyViewWithTsometProps {
  showTsomet: boolean
  tsometAgents: string[] | null
  rows: SalesRow[]
  children: (tsometOpenBudget: SmTsometOpenBudgetKpiProps | null) => ReactNode
}

/** Vs company view wrapper — injects Tsomet open-budget KPI when enabled. */
export function SmVsCompanyViewWithTsomet({
  showTsomet,
  tsometAgents,
  rows,
  children,
}: SmVsCompanyViewWithTsometProps) {
  const kpi = useTsometOpenBudgetKpi(rows, tsometAgents, showTsomet)
  return <>{children(toTsometCubeProp(showTsomet, kpi))}</>
}
