import type { LogicalCompany } from '../../../types/dashboard'
import { SmCubeGrid, type SmOrdersReportTarget } from './SmCubeGrid'
import type { SmSuiteKpis } from './smMetrics'

export interface SmAgentWindowProps {
  title: string
  kpis: SmSuiteKpis
  /** `null` → display — for missing per-agent goal or while targets load. */
  goalCash: number | null
  monthLbl: string
  ordersReportCompanies?: SmOrdersReportTarget[]
  onOpenOrdersReport?: (companyId: LogicalCompany) => void
}

export function SmAgentWindow({
  title,
  kpis,
  goalCash,
  monthLbl,
  ordersReportCompanies,
  onOpenOrdersReport,
}: SmAgentWindowProps) {
  return (
    <section className="sm-window">
      <h3 className="sm-window-title">{title}</h3>
      <SmCubeGrid
        kpis={kpis}
        goalCash={goalCash}
        monthLbl={monthLbl}
        ordersReportCompanies={ordersReportCompanies}
        onOpenOrdersReport={onOpenOrdersReport}
      />
    </section>
  )
}
