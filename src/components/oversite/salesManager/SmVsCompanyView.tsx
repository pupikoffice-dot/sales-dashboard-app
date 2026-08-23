import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import { OversiteReceipts } from '../OversiteReceipts'
import type { SmVsCompanySeries } from './smMetrics'

const AGENT_COLOR_COUNT = 6

function agentColorIdx(agentId: string): number {
  const n = Number(String(agentId).trim())
  return Number.isFinite(n) ? Math.floor(Math.abs(n)) % AGENT_COLOR_COUNT : 0
}

export interface SmVsCompanyViewProps {
  series: SmVsCompanySeries
  monthLbl: string
  onOpenDebtReport?: () => void
  onOpenReceiptsReport?: () => void
}

/** Vs mode: comparison cubes for one company (Sales MTD+Goal, Open debt, Receipts). */
export function SmVsCompanyView({
  series,
  monthLbl,
  onOpenDebtReport,
  onOpenReceiptsReport,
}: SmVsCompanyViewProps) {
  const { t } = useLocale()
  const agents = series.agents
  const salesMax = Math.max(...agents.map(a => Math.max(a.salesMtdCash, a.goalCash ?? 0)), 1)
  const debtMax = Math.max(...agents.map(a => a.openDebtCash), 1)
  const receipts = series.receipts

  if (agents.length === 0) {
    return <p className="ov-empty">{t('sm.vs.noAgents')}</p>
  }

  return (
    <div className="sm-vs-grid">
      <div className="sm-cube sm-cube--vs-mtd">
        <div className="sm-cube-title">{t('sm.cube.salesMtdGoal', { month: monthLbl })}</div>
        <div className="sm-vs-bars" role="list" aria-label={t('sm.cube.salesMtdGoal', { month: monthLbl })}>
          {agents.map(a => {
            const c = agentColorIdx(a.agentId)
            const cashPct = Math.min(100, (a.salesMtdCash / salesMax) * 100)
            const goalPct =
              a.goalCash != null && a.goalCash > 0
                ? Math.min(100, (a.goalCash / salesMax) * 100)
                : null
            const ofGoal =
              a.goalCash != null && a.goalCash > 0
                ? Math.min(999, (a.salesMtdCash / a.goalCash) * 100)
                : null
            return (
              <div key={a.agentId} className="sm-vs-bar-row" role="listitem">
                <span className={`sm-vs-agent agent-t${c}`}>
                  {t('oversite.debtAgent')} {a.agentId}
                </span>
                <div className="sm-vs-track">
                  {goalPct != null ? (
                    <span className="sm-vs-goal-mark" style={{ insetInlineStart: `${goalPct}%` }} title={fmt(a.goalCash!)} />
                  ) : null}
                  <div
                    className={`sm-vs-fill agent-c${c}`}
                    style={{ width: `${cashPct}%` }}
                    title={fmt(a.salesMtdCash)}
                  />
                </div>
                <span className="sm-vs-val">{fmt(a.salesMtdCash)}</span>
                <span className="sm-vs-meta">
                  {ofGoal != null
                    ? t('sm.vs.goalPct', { pct: ofGoal.toFixed(0) })
                    : a.goalCash == null
                      ? t('sm.vs.goalMissing')
                      : `${t('sm.cube.goal')}: ${fmt(a.goalCash)}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sm-cube sm-cube--vs-debt">
        <div className="sm-cube-title">{t('sm.cube.openDebt')}</div>
        <div className="sm-vs-bars" role="list" aria-label={t('sm.cube.openDebt')}>
          {agents.map(a => {
            const c = agentColorIdx(a.agentId)
            const pct = Math.min(100, (a.openDebtCash / debtMax) * 100)
            return (
              <div key={a.agentId} className="sm-vs-bar-row" role="listitem">
                <span className={`sm-vs-agent agent-t${c}`}>
                  {t('oversite.debtAgent')} {a.agentId}
                </span>
                <div className="sm-vs-track">
                  <div
                    className={`sm-vs-fill agent-c${c}`}
                    style={{ width: `${pct}%` }}
                    title={fmt(a.openDebtCash)}
                  />
                </div>
                <span className="sm-vs-val">{fmt(a.openDebtCash)}</span>
              </div>
            )
          })}
        </div>
        {onOpenDebtReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenDebtReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>

      <div className="sm-cube sm-cube--vs-receipts">
        <div className="sm-cube-title">{t('sm.cube.receipts')}</div>
        {Object.keys(receipts.monthly).length > 0 ? (
          <OversiteReceipts
            monthly={receipts.monthly}
            byAgent={receipts.byAgent}
            agents={receipts.agents}
          />
        ) : (
          <div className="sm-cube-empty">{t('sm.cube.receiptsEmpty')}</div>
        )}
        {onOpenReceiptsReport && Object.keys(receipts.monthly).length > 0 ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenReceiptsReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
