import { useMemo, type ReactNode } from 'react'
import type { HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiCubesBlock, type BiCubesMode } from '../bi/BiCubesBlock'
import { smOpenOrdersTag } from '../smMetrics'
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
  const openOrdersTag = smOpenOrdersTag(company)

  /** Company sales (+ open orders for missed-clients) — BI habit cubes share this. */
  const biScopedRows = useMemo(() => {
    if (!openOrdersTag) {
      return rows.filter(r => r.company === company)
    }
    return rows.filter(r => r.company === company || r.company === openOrdersTag)
  }, [rows, company, openOrdersTag])

  /** Shared company MTD sales slice for Best sold/clients + items sold by others. */
  const companyMtdRows = useMemo(
    () =>
      rows.filter(
        r =>
          r.company === company &&
          Number(r.year) === curYear &&
          Number(r.month) === curMonth,
      ),
    [rows, company, curYear, curMonth],
  )

  const windowAgents = useMemo((): string[] | null => {
    if (mode === 'agent' && agentId) return [agentId]
    return suiteAgents.length > 0 ? suiteAgents : null
  }, [mode, agentId, suiteAgents])

  const windowMtdRows = useMemo(() => {
    if (!windowAgents || windowAgents.length === 0) return companyMtdRows
    const set = new Set(windowAgents.map(String))
    return companyMtdRows.filter(r => set.has(String(r.agent ?? '')))
  }, [companyMtdRows, windowAgents])

  return (
    <>
      <BiCubesBlock
        visibleIds={biVisibleIds}
        mode={mode}
        agentId={agentId}
        company={company}
        rows={biScopedRows}
        allRows={rows}
        mtdRows={companyMtdRows}
        stockBySku={stockBySku}
        habit={habit}
        suiteAgents={suiteAgents}
        windowAgents={windowAgents}
        curYear={curYear}
        curMonth={curMonth}
      />
      <SuiteUiCubesBlock
        visibleIds={suiteUiVisibleIds}
        mode={mode}
        agentId={agentId}
        company={company}
        rows={windowMtdRows}
        suiteAgents={suiteAgents}
        windowAgents={windowAgents}
        curYear={curYear}
        curMonth={curMonth}
        mtdPrefiltered
      />
    </>
  )
}
