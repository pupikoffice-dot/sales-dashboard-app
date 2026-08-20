import { useMemo, useState } from 'react'
import { useDashboardAccess } from '../../../context/DashboardAccessContext'
import { useLocale } from '../../../context/LocaleContext'
import { useDashboardData } from '../../../hooks/useDashboardData'
import { useSalesAgentTargets } from '../../../hooks/useSalesAgentTargets'
import { formatGeneratedDisplay } from '../../../lib/format'
import { getOversiteDateContext, resolveOrdersTag } from '../../../lib/oversiteMetrics'
import { sortAgentIds, sumGoals } from '../../../lib/uiModules'
import type { LogicalCompany, SalesRow } from '../../../types/dashboard'
import { OrdersTodayModal } from '../OrdersTodayModal'
import { SmAgentWindow } from './SmAgentWindow'
import { buildSmSuiteKpis, listSmOrdersReportCompanies } from './smMetrics'

/**
 * Sales Manager Oversight suite — All window + per-agent windows.
 * CORE RULE: KPIs use access.companies + access agent scope only (never sidebar filters).
 * Mounted by OversitePage when suite grant is active (Task 8).
 */
export function SalesManagerSuite() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { rows, debtRows, isLoading, error, data } = useDashboardData()
  const dateCtx = useMemo(() => getOversiteDateContext(), [])
  const targetsQ = useSalesAgentTargets(dateCtx.curYear, dateCtx.curMonth)

  const companies = access?.companies ?? []
  const targets = targetsQ.data ?? {}
  /** Avoid flashing `0` from empty `{}` while targets are still loading / unsettled. */
  const goalsReady = targetsQ.isSuccess
  const [ordersModal, setOrdersModal] = useState<{
    company: LogicalCompany
    companyLabel: string
    ordersTag: string
    /** Narrow modal rows to these agents; null = all access-scoped rows. */
    agents: string[] | null
  } | null>(null)

  /** Class agent grant; empty/null = all agents present under access companies. */
  const scopedAgents = useMemo(() => {
    if (Array.isArray(access?.agents) && access.agents.length > 0) {
      return sortAgentIds(access.agents.map(String))
    }
    const found = new Set<string>()
    for (const r of rows) {
      const a = r.agent != null ? String(r.agent).trim() : ''
      if (a) found.add(a)
    }
    return sortAgentIds([...found])
  }, [access?.agents, rows])

  const ordersReportCompanies = useMemo(
    () => listSmOrdersReportCompanies(companies),
    [companies],
  )

  const allKpis = useMemo(
    () =>
      buildSmSuiteKpis({
        rows,
        debtRows,
        companies,
        agents: scopedAgents.length > 0 ? scopedAgents : null,
        dateCtx,
        receiptsMonthlyByAgent: data?.receiptsMonthlyByAgent,
      }),
    [rows, debtRows, companies, scopedAgents, dateCtx, data?.receiptsMonthlyByAgent],
  )

  const allGoal = useMemo(
    () => (goalsReady ? sumGoals(scopedAgents, targets) : null),
    [goalsReady, scopedAgents, targets],
  )

  const agentWindows = useMemo(
    () =>
      scopedAgents.map(agentId => {
        const kpis = buildSmSuiteKpis({
          rows,
          debtRows,
          companies,
          agents: [agentId],
          dateCtx,
          receiptsMonthlyByAgent: data?.receiptsMonthlyByAgent,
        })
        // Loading / error → null (—). Missing target after success → null (—). Present → number (incl. 0).
        const goalCash =
          goalsReady && Object.prototype.hasOwnProperty.call(targets, agentId)
            ? targets[agentId]!
            : null
        return { agentId, kpis, goalCash }
      }),
    [
      scopedAgents,
      rows,
      debtRows,
      companies,
      dateCtx,
      data?.receiptsMonthlyByAgent,
      targets,
      goalsReady,
    ],
  )

  const openOrdersReport = (companyId: LogicalCompany, agents: string[] | null) => {
    const co = ordersReportCompanies.find(c => c.id === companyId)
    if (!co) return
    const scopeRows =
      agents && agents.length > 0
        ? rows.filter(r => agents.includes(String(r.agent ?? '')))
        : rows
    const ordersTag = resolveOrdersTag(scopeRows.length ? scopeRows : rows, co.ordersTag)
    setOrdersModal({
      company: co.id,
      companyLabel: co.label,
      ordersTag,
      agents,
    })
  }

  const modalRows: SalesRow[] = useMemo(() => {
    if (!ordersModal) return []
    if (!ordersModal.agents || ordersModal.agents.length === 0) return rows
    const set = new Set(ordersModal.agents)
    return rows.filter(r => set.has(String(r.agent ?? '')))
  }, [ordersModal, rows])

  if (isLoading) return <p className="status-msg">{t('common.loadingSalesData')}</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const fileUpdatedAt = formatGeneratedDisplay(data?.generated)

  return (
    <div className="sm-suite">
      <div className="ov-header">
        <div className="ov-header-row">
          <h2>{t('sm.suite.title')}</h2>
        </div>
        <div className="ov-sub">
          {t('oversite.today')}: <b>{dateCtx.todayDisp}</b>
          {fileUpdatedAt ? (
            <>
              {' '}
              · {t('oversite.fileUpdated')}: <b>{fileUpdatedAt}</b>
            </>
          ) : null}{' '}
          · {t('oversite.month')}: <b>{dateCtx.monthLbl}</b>
          {targetsQ.isError ? (
            <>
              {' '}
              · <span className="sm-goals-err">{t('sm.goals.loadError')}</span>
            </>
          ) : null}
        </div>
      </div>

      {companies.length === 0 ? (
        <p className="ov-empty">{t('oversite.noCompanies')}</p>
      ) : (
        <div className="sm-suite-windows">
          <SmAgentWindow
            title={t('sm.window.allAgents')}
            kpis={allKpis}
            goalCash={allGoal}
            monthLbl={dateCtx.monthLbl}
            ordersReportCompanies={ordersReportCompanies}
            onOpenOrdersReport={companyId =>
              openOrdersReport(companyId, scopedAgents.length > 0 ? scopedAgents : null)
            }
          />
          {agentWindows.map(({ agentId, kpis, goalCash }) => (
            <SmAgentWindow
              key={agentId}
              title={t('sm.window.agent', { agent: agentId })}
              kpis={kpis}
              goalCash={goalCash}
              monthLbl={dateCtx.monthLbl}
              ordersReportCompanies={ordersReportCompanies}
              onOpenOrdersReport={companyId => openOrdersReport(companyId, [agentId])}
            />
          ))}
        </div>
      )}

      {ordersModal ? (
        <OrdersTodayModal
          company={ordersModal.company}
          companyLabel={ordersModal.companyLabel}
          ordersTag={ordersModal.ordersTag}
          companyRows={modalRows}
          todayStr={dateCtx.todayStr}
          todayDisp={dateCtx.todayDisp}
          onClose={() => setOrdersModal(null)}
        />
      ) : null}
    </div>
  )
}
