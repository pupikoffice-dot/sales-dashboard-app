import type { ReactNode } from 'react'
import type { HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiCubesBlock, type BiCubesMode } from '../bi/BiCubesBlock'
import { SuiteUiCubesBlock } from './SuiteUiCubesBlock'

/** BI cubes then Best sold / Best clients in the orders-under-chart region. */
export function SuiteExtrasBlock({
  biVisibleIds,
  suiteUiVisibleIds,
  mode,
  agentId,
  company,
  rows,
  stockBySku,
  habit,
  suiteAgents,
  curYear,
  curMonth,
}: {
  biVisibleIds: string[]
  suiteUiVisibleIds: string[]
  mode: BiCubesMode
  agentId?: string | null
  company: LogicalCompany
  rows: SalesRow[]
  stockBySku: Record<string, number>
  habit: HabitConfig
  suiteAgents: string[]
  curYear: number
  curMonth: number
}): ReactNode {
  return (
    <>
      <BiCubesBlock
        visibleIds={biVisibleIds}
        mode={mode}
        agentId={agentId}
        company={company}
        rows={rows}
        stockBySku={stockBySku}
        habit={habit}
        suiteAgents={suiteAgents}
        curYear={curYear}
        curMonth={curMonth}
      />
      <SuiteUiCubesBlock
        visibleIds={suiteUiVisibleIds}
        mode={mode}
        agentId={agentId}
        company={company}
        rows={rows}
        suiteAgents={suiteAgents}
        curYear={curYear}
        curMonth={curMonth}
      />
    </>
  )
}
