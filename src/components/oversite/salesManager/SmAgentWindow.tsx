import type { LogicalCompany } from '../../../types/dashboard'
import { SmCubeGrid, type SmOrdersReportTarget } from './SmCubeGrid'
import type { SmSuiteKpis } from './smMetrics'

/** Soft window tint slots — matches stacked-chart agent palette (c0–c5). */
const WINDOW_TINT_COUNT = 6

function windowTintClass(agentId: string | null | undefined): string {
  if (agentId == null || agentId === '') return 'sm-window--all'
  const n = Number(String(agentId).trim())
  const idx = Number.isFinite(n) ? Math.floor(Math.abs(n)) % WINDOW_TINT_COUNT : 0
  return `sm-window--c${idx}`
}

export interface SmAgentWindowProps {
  title: string
  kpis: SmSuiteKpis
  /** `null` → display — for missing per-agent goal or while targets load. */
  goalCash: number | null
  monthLbl: string
  /** When set, tints this window so agent boxes stay visually distinct. */
  agentId?: string | null
  ordersReportCompanies?: SmOrdersReportTarget[]
  onOpenOrdersReport?: (companyId: LogicalCompany) => void
  onOpenDebtReport?: () => void
  onOpenOpenOrdersReport?: () => void
  onOpenReturnsReport?: () => void
}

export function SmAgentWindow({
  title,
  kpis,
  goalCash,
  monthLbl,
  agentId,
  ordersReportCompanies,
  onOpenOrdersReport,
  onOpenDebtReport,
  onOpenOpenOrdersReport,
  onOpenReturnsReport,
}: SmAgentWindowProps) {
  return (
    <section className={`sm-window ${windowTintClass(agentId)}`}>
      <h3 className="sm-window-title">{title}</h3>
      <SmCubeGrid
        kpis={kpis}
        goalCash={goalCash}
        monthLbl={monthLbl}
        ordersReportCompanies={ordersReportCompanies}
        onOpenOrdersReport={onOpenOrdersReport}
        onOpenDebtReport={onOpenDebtReport}
        onOpenOpenOrdersReport={onOpenOpenOrdersReport}
        onOpenReturnsReport={onOpenReturnsReport}
      />
    </section>
  )
}
