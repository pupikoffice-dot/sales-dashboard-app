import { useMemo } from 'react'
import type { HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiItemsSoldByOthersCube } from './BiItemsSoldByOthersCube'
import { BiMissedClientsCube } from './BiMissedClientsCube'
import { BiMissedItemsCube } from './BiMissedItemsCube'
import { BiTsometBudgetCube } from './BiTsometBudgetCube'

export type BiCubesMode = 'all' | 'agent'

export interface BiCubesBlockProps {
  visibleIds: string[]
  mode: BiCubesMode
  /** Required when mode === 'agent' for items_sold_by_others. */
  agentId?: string | null
  company: LogicalCompany
  /** Company sales (+ open orders) — habit cubes. */
  rows: SalesRow[]
  /**
   * Full access-scoped rows (includes orders-* tags) for Tsomet Orders MTD.
   * Falls back to `rows` when omitted.
   */
  allRows?: SalesRow[]
  /** Shared company MTD sales slice (all suite agents). */
  mtdRows?: SalesRow[]
  /** Per-SKU stock for this company (missing key = OOS / skip). */
  stockBySku: Record<string, number>
  habit: HabitConfig
  suiteAgents: string[]
  /** Stable window agent scope from parent (avoids `[agentId]` every render). */
  windowAgents?: string[] | null
  curYear: number
  curMonth: number
}

/**
 * BI cubes after KPI grid. Alone All / Vs = missed items + clients only.
 * Alone agent = all granted modules including items sold by others.
 * Tsomet Budget: Monkeytime company block only.
 */
export function BiCubesBlock({
  visibleIds,
  mode,
  agentId,
  company,
  rows,
  allRows,
  mtdRows,
  stockBySku,
  habit,
  suiteAgents,
  windowAgents: windowAgentsProp,
  curYear,
  curMonth,
}: BiCubesBlockProps) {
  const idSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const showMissedItems = idSet.has('missed_items')
  const showMissedClients = idSet.has('missed_clients')
  const showSoldByOthers =
    mode === 'agent' && !!agentId && idSet.has('items_sold_by_others')
  const showTsometBudget = company === 'mt' && idSet.has('tsomet_budget')

  const agentsForHabit = useMemo((): string[] | null => {
    if (windowAgentsProp !== undefined) return windowAgentsProp
    if (mode === 'agent' && agentId) return [agentId]
    return suiteAgents.length > 0 ? suiteAgents : null
  }, [windowAgentsProp, mode, agentId, suiteAgents])

  if (!showMissedItems && !showMissedClients && !showSoldByOthers && !showTsometBudget) {
    return null
  }

  return (
    <div className="bi-cube-grid" aria-label="BI modules">
      {showMissedItems ? (
        <BiMissedItemsCube
          rows={rows}
          company={company}
          agents={agentsForHabit}
          habit={habit}
          curYear={curYear}
          curMonth={curMonth}
          stockBySku={stockBySku}
        />
      ) : null}
      {showMissedClients ? (
        <BiMissedClientsCube
          rows={rows}
          company={company}
          agents={agentsForHabit}
          habit={habit}
          curYear={curYear}
          curMonth={curMonth}
        />
      ) : null}
      {showSoldByOthers && agentId ? (
        <BiItemsSoldByOthersCube
          rows={mtdRows ?? rows}
          company={company}
          agentId={agentId}
          suiteAgents={suiteAgents}
          curYear={curYear}
          curMonth={curMonth}
          mtdPrefiltered={!!mtdRows}
        />
      ) : null}
      {showTsometBudget ? (
        <BiTsometBudgetCube rows={allRows ?? rows} agents={agentsForHabit} />
      ) : null}
    </div>
  )
}
