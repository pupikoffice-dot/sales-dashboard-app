import { useMemo } from 'react'
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
  /** Stable window agent scope from parent. */
  windowAgents?: string[] | null
  curYear: number
  curMonth: number
  /** When true, `rows` are already company×agents×MTD — skip re-filter in metrics. */
  mtdPrefiltered?: boolean
}

/** Suite-mountable UI tiles after BI cubes. Alone All / agent / Vs all show both when granted. */
export function SuiteUiCubesBlock({
  visibleIds,
  mode,
  agentId,
  company,
  rows,
  suiteAgents,
  windowAgents: windowAgentsProp,
  curYear,
  curMonth,
  mtdPrefiltered = false,
}: SuiteUiCubesBlockProps) {
  const idSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const showSold = idSet.has('best_sold_items')
  const showClients = idSet.has('best_clients')

  const agents = useMemo((): string[] | null => {
    if (windowAgentsProp !== undefined) return windowAgentsProp
    if (mode === 'agent' && agentId) return [agentId]
    return suiteAgents.length > 0 ? suiteAgents : null
  }, [windowAgentsProp, mode, agentId, suiteAgents])

  if (!showSold && !showClients) return null

  return (
    <div className="bi-cube-grid" aria-label="Suite UI modules">
      {showSold ? (
        <SuiteBestSoldItemsCube
          rows={rows}
          company={company}
          agents={agents}
          curYear={curYear}
          curMonth={curMonth}
          mtdPrefiltered={mtdPrefiltered}
        />
      ) : null}
      {showClients ? (
        <SuiteBestClientsCube
          rows={rows}
          company={company}
          agents={agents}
          curYear={curYear}
          curMonth={curMonth}
          mtdPrefiltered={mtdPrefiltered}
        />
      ) : null}
    </div>
  )
}
