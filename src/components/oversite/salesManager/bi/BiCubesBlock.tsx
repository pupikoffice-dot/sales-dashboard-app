import type { HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiItemsSoldByOthersCube } from './BiItemsSoldByOthersCube'
import { BiMissedClientsCube } from './BiMissedClientsCube'
import { BiMissedItemsCube } from './BiMissedItemsCube'

export type BiCubesMode = 'all' | 'agent'

export interface BiCubesBlockProps {
  visibleIds: string[]
  mode: BiCubesMode
  /** Required when mode === 'agent' for items_sold_by_others. */
  agentId?: string | null
  company: LogicalCompany
  rows: SalesRow[]
  /** Per-SKU stock for this company (missing key = OOS / skip). */
  stockBySku: Record<string, number>
  habit: HabitConfig
  suiteAgents: string[]
  curYear: number
  curMonth: number
}

/**
 * BI cubes after KPI grid. Alone All / Vs = missed items + clients only.
 * Alone agent = all granted modules including items sold by others.
 */
export function BiCubesBlock({
  visibleIds,
  mode,
  agentId,
  company,
  rows,
  stockBySku,
  habit,
  suiteAgents,
  curYear,
  curMonth,
}: BiCubesBlockProps) {
  const idSet = new Set(visibleIds)
  const showMissedItems = idSet.has('missed_items')
  const showMissedClients = idSet.has('missed_clients')
  const showSoldByOthers =
    mode === 'agent' && !!agentId && idSet.has('items_sold_by_others')

  if (!showMissedItems && !showMissedClients && !showSoldByOthers) return null

  const agentsForHabit: string[] | null =
    mode === 'agent' && agentId ? [agentId] : suiteAgents.length > 0 ? suiteAgents : null

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
          rows={rows}
          company={company}
          agentId={agentId}
          suiteAgents={suiteAgents}
          curYear={curYear}
          curMonth={curMonth}
        />
      ) : null}
    </div>
  )
}
