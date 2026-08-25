import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { SuiteBestClientsCube } from './SuiteBestClientsCube'
import { SuiteBestSoldItemsCube } from './SuiteBestSoldItemsCube'

export type SuiteUiCubesMode = 'all' | 'agent'

export interface SuiteUiCubesBlockProps {
  visibleIds: string[]
  mode: SuiteUiCubesMode
  agentId?: string | null
  company: LogicalCompany
  rows: SalesRow[]
  suiteAgents: string[]
  curYear: number
  curMonth: number
}

/** Suite-mountable UI tiles after BI cubes. Alone All / agent / Vs all show both when granted. */
export function SuiteUiCubesBlock({
  visibleIds,
  mode,
  agentId,
  company,
  rows,
  suiteAgents,
  curYear,
  curMonth,
}: SuiteUiCubesBlockProps) {
  const idSet = new Set(visibleIds)
  const showSold = idSet.has('best_sold_items')
  const showClients = idSet.has('best_clients')
  if (!showSold && !showClients) return null

  const agents: string[] | null =
    mode === 'agent' && agentId ? [agentId] : suiteAgents.length > 0 ? suiteAgents : null

  return (
    <div className="bi-cube-grid" aria-label="Suite UI modules">
      {showSold ? (
        <SuiteBestSoldItemsCube
          rows={rows}
          company={company}
          agents={agents}
          curYear={curYear}
          curMonth={curMonth}
        />
      ) : null}
      {showClients ? (
        <SuiteBestClientsCube
          rows={rows}
          company={company}
          agents={agents}
          curYear={curYear}
          curMonth={curMonth}
        />
      ) : null}
    </div>
  )
}
