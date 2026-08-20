import { SmCubeGrid } from './SmCubeGrid'
import type { SmSuiteKpis } from './smMetrics'

export interface SmAgentWindowProps {
  title: string
  kpis: SmSuiteKpis
  /** `null` → display — for missing per-agent goal. */
  goalCash: number | null
  monthLbl: string
}

export function SmAgentWindow({ title, kpis, goalCash, monthLbl }: SmAgentWindowProps) {
  return (
    <section className="sm-window">
      <h3 className="sm-window-title">{title}</h3>
      <SmCubeGrid kpis={kpis} goalCash={goalCash} monthLbl={monthLbl} />
    </section>
  )
}
