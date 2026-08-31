import { useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useDashboardAccess } from '../../../context/DashboardAccessContext'
import { useLocale } from '../../../context/LocaleContext'
import { usePreview } from '../../../context/PreviewContext'
import { useBiConfig, useBiModulesCatalog } from '../../../hooks/useBiModules'
import { useBiUserGrants } from '../../../hooks/useBiUserGrants'
import { useSuiteUiUserGrants } from '../../../hooks/useSuiteUiUserGrants'
import { useDashboardData } from '../../../hooks/useDashboardData'
import { useSalesAgentTargets } from '../../../hooks/useSalesAgentTargets'
import { resolveVisibleBiModuleIds } from '../../../lib/biModules'
import { resolveVisibleSuiteUiModuleIds } from '../../../lib/suiteUiModules'
import { useUiModuleCatalog } from '../../../hooks/useUiModules'
import { formatGeneratedDisplay } from '../../../lib/format'
import { getOversiteDateContext, resolveOrdersTag, type OrderTodayGroup, type Top10Item } from '../../../lib/oversiteMetrics'
import { sortAgentIds, sumGoals } from '../../../lib/uiModules'
import type { DebtRow, LogicalCompany, SalesRow } from '../../../types/dashboard'
import { DebtModal } from '../DebtModal'
import { OrdersTodayModal } from '../OrdersTodayModal'
import { SuiteExtrasBlock } from './suiteUi/SuiteExtrasBlock'
import { SmAgentWindow } from './SmAgentWindow'
import { SmItemsReportModal } from './SmItemsReportModal'
import { SmOpenOrdersReportModal } from './SmOpenOrdersReportModal'
import { SmReceiptsReportModal } from './SmReceiptsReportModal'
import { SmVsCompanyView } from './SmVsCompanyView'
import {
  buildSmDebtRows,
  buildSmOpenOrdersTop10,
  buildSmReturnsTop10,
  buildSmSuiteKpis,
  buildSmVsAgentSeriesFromKpis,
  listSmOrdersReportCompanies,
  partitionSalesRowsByTag,
  smCompanyLabel,
  type SmSuiteKpis,
  type SmVsCompanySeries,
} from './smMetrics'

export type SmSuiteViewMode = 'alone' | 'vs'
export type SmSuiteVariant = 'manager' | 'agent'

export interface SalesManagerSuiteProps {
  /** manager = full Sales Manager (Alone/Vs, all agents). agent = single-agent view. */
  variant?: SmSuiteVariant
}

/** Stable empty stock map so cube useMemos do not bust when a company has no WMS rows. */
const EMPTY_STOCK: Record<string, number> = {}

/**
 * Sales Manager Oversight suite — company blocks; Alone or Vs mode.
 * Sales Agent variant: one agent window only, no Alone/Vs toggle.
 * CORE RULE: Oversight ⊥ Sidebar — never use sidebar filters.
 * CORE RULE: Companies never combined — one company block after another.
 */
export function SalesManagerSuite({ variant = 'manager' }: SalesManagerSuiteProps) {
  const isAgentSuite = variant === 'agent'
  const { t } = useLocale()
  const { session, isSuperAdmin } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  const { access } = useDashboardAccess()
  const { rows, debtRows, isLoading, error, data, debtLastUpdate, wmsStock } = useDashboardData()
  const dateCtx = useMemo(() => getOversiteDateContext(), [])
  const targetsQ = useSalesAgentTargets(dateCtx.curYear, dateCtx.curMonth)
  const biCatalogQ = useBiModulesCatalog()
  const biConfigQ = useBiConfig()
  const uiCatalogQ = useUiModuleCatalog()
  const grantUserId = isPreviewing && previewUser ? previewUser.id : session?.user.id
  const biGrantsQ = useBiUserGrants(grantUserId)
  const suiteUiGrantsQ = useSuiteUiUserGrants(grantUserId)

  const visibleBiIds = useMemo(
    () =>
      resolveVisibleBiModuleIds({
        isSuperAdmin,
        isPreviewing,
        grants: biGrantsQ.data ?? [],
        catalog: biCatalogQ.data ?? [],
      }),
    [isSuperAdmin, isPreviewing, biGrantsQ.data, biCatalogQ.data],
  )

  const visibleSuiteUiIds = useMemo(
    () =>
      resolveVisibleSuiteUiModuleIds({
        isSuperAdmin,
        isPreviewing,
        grants: suiteUiGrantsQ.data ?? [],
        catalog: uiCatalogQ.data ?? [],
      }),
    [isSuperAdmin, isPreviewing, suiteUiGrantsQ.data, uiCatalogQ.data],
  )

  const habit = useMemo(
    () => ({
      habitX: biConfigQ.data?.habitX ?? 3,
      habitY: biConfigQ.data?.habitY ?? 4,
    }),
    [biConfigQ.data],
  )

  const companies = access?.companies ?? []
  const targets = targetsQ.data ?? {}
  /** Avoid flashing `0` from empty `{}` while targets are still loading / unsettled. */
  const goalsReady = targetsQ.isSuccess
  const [viewMode, setViewMode] = useState<SmSuiteViewMode>('alone')
  const [ordersModal, setOrdersModal] = useState<{
    company: LogicalCompany
    companyLabel: string
    ordersTag: string
    /** Narrow modal rows to these agents; null = all access-scoped rows. */
    agents: string[] | null
  } | null>(null)
  const [debtModal, setDebtModal] = useState<{
    rows: DebtRow[]
    title: string
    company: LogicalCompany
  } | null>(null)
  const [itemsModal, setItemsModal] = useState<{
    title: string
    items: Top10Item[]
    emptyLabel: string
  } | null>(null)
  const [openOrdersModal, setOpenOrdersModal] = useState<{
    title: string
    orders: OrderTodayGroup[]
  } | null>(null)
  const [receiptsModal, setReceiptsModal] = useState<{
    title: string
    company: LogicalCompany
    agents: string[] | null
  } | null>(null)

  /** Class/user agent grant; empty/null = all agents (manager only). Agent suite uses user-level agents only. */
  const scopedAgents = useMemo(() => {
    if (Array.isArray(access?.agents) && access.agents.length > 0) {
      return sortAgentIds(access.agents.map(String))
    }
    if (isAgentSuite) {
      // Sales Agent: never infer agents from row data — each user's agent is set on Admin → Users.
      return []
    }
    const found = new Set<string>()
    for (const r of rows) {
      const a = r.agent != null ? String(r.agent).trim() : ''
      if (a) found.add(a)
    }
    return sortAgentIds([...found])
  }, [access?.agents, rows, isAgentSuite])

  const allGoal = useMemo(
    () => (goalsReady ? sumGoals(scopedAgents, targets) : null),
    [goalsReady, scopedAgents, targets],
  )

  /** Tag index once per access-scoped row set — suite KPIs read slices. */
  const rowPartition = useMemo(() => partitionSalesRowsByTag(rows), [rows])

  type CompanyBlockBase = {
    company: LogicalCompany
    label: string
    reportCos: ReturnType<typeof listSmOrdersReportCompanies>
    allKpis: SmSuiteKpis
    agentWindows: Array<{ agentId: string; kpis: SmSuiteKpis; goalCash: number | null }>
    stockBySku: Record<string, number>
  }

  /** KPIs are independent of Alone/Vs — keep stable when toggling mode. */
  const companyBlocksBase = useMemo((): CompanyBlockBase[] => {
    return companies.map(company => {
      const reportCos = listSmOrdersReportCompanies([company])
      const allKpis = buildSmSuiteKpis({
        rows,
        debtRows,
        company,
        agents: scopedAgents.length > 0 ? scopedAgents : null,
        dateCtx,
        receiptsMonthlyByAgent: data?.receiptsMonthlyByAgent,
        rowPartition,
      })
      const agentWindows = scopedAgents.map(agentId => {
        const kpis = buildSmSuiteKpis({
          rows,
          debtRows,
          company,
          agents: [agentId],
          dateCtx,
          receiptsMonthlyByAgent: data?.receiptsMonthlyByAgent,
          rowPartition,
        })
        const goalCash =
          goalsReady && Object.prototype.hasOwnProperty.call(targets, agentId)
            ? targets[agentId]!
            : null
        return { agentId, kpis, goalCash }
      })
      return {
        company,
        label: smCompanyLabel(company),
        reportCos,
        allKpis,
        agentWindows,
        stockBySku: wmsStock[company] ?? EMPTY_STOCK,
      }
    })
  }, [
    companies,
    rows,
    debtRows,
    scopedAgents,
    dateCtx,
    data?.receiptsMonthlyByAgent,
    targets,
    goalsReady,
    rowPartition,
    wmsStock,
  ])

  const companyBlocks = useMemo(() => {
    return companyBlocksBase.map(block => ({
      ...block,
      vsSeries:
        viewMode === 'vs'
          ? buildSmVsAgentSeriesFromKpis({
              company: block.company,
              agentWindows: block.agentWindows,
              allKpis: block.allKpis,
            })
          : (null as SmVsCompanySeries | null),
    }))
  }, [companyBlocksBase, viewMode])

  const openOrdersReport = (companyId: LogicalCompany, agents: string[] | null) => {
    const co = listSmOrdersReportCompanies([companyId])[0]
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

  const openDebtReport = (
    company: LogicalCompany,
    agents: string[] | null,
    windowTitle: string,
  ) => {
    const scoped = buildSmDebtRows({ debtRows, company, agents })
    setDebtModal({
      rows: scoped,
      title: `${t('sm.cube.openDebt')} — ${windowTitle}`,
      company,
    })
  }

  const openOpenOrdersItems = (
    company: LogicalCompany,
    agents: string[] | null,
    windowTitle: string,
  ) => {
    setOpenOrdersModal({
      title: `${t('sm.cube.openOrders')} — ${windowTitle}`,
      orders: buildSmOpenOrdersTop10({ rows, company, agents }),
    })
  }

  const openReturnsItems = (
    company: LogicalCompany,
    agents: string[] | null,
    windowTitle: string,
  ) => {
    setItemsModal({
      title: `${t('sm.cube.returns')} — ${windowTitle}`,
      items: buildSmReturnsTop10({ rows, company, agents, dateCtx }),
      emptyLabel: t('oversite.noReturns'),
    })
  }

  const openReceiptsReport = (
    company: LogicalCompany,
    agents: string[] | null,
    windowTitle: string,
  ) => {
    setReceiptsModal({
      title: `${t('sm.cube.receipts')} — ${windowTitle}`,
      company,
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
  const allAgentsScope = scopedAgents.length > 0 ? scopedAgents : null

  return (
    <div className="sm-suite">
      <div className="ov-header">
        <div className="ov-header-row">
          <h2>{t(isAgentSuite ? 'sa.suite.title' : 'sm.suite.title')}</h2>
          {!isAgentSuite ? (
            <div className="sm-mode-toggle" role="group" aria-label={t('sm.mode.label')}>
              <button
                type="button"
                className={viewMode === 'alone' ? 'active' : undefined}
                aria-pressed={viewMode === 'alone'}
                onClick={() => setViewMode('alone')}
              >
                {t('sm.mode.alone')}
              </button>
              <button
                type="button"
                className={viewMode === 'vs' ? 'active' : undefined}
                aria-pressed={viewMode === 'vs'}
                onClick={() => setViewMode('vs')}
              >
                {t('sm.mode.vs')}
              </button>
            </div>
          ) : null}
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
      ) : isAgentSuite && scopedAgents.length === 0 ? (
        <p className="ov-empty">{t('sa.noAgent')}</p>
      ) : (
        <div className="sm-suite-companies">
          {companyBlocks.map(
            ({ company, label, reportCos, allKpis, agentWindows, vsSeries, stockBySku }) => {
              const allTitle = t('sm.window.allAgents')
              return (
                <section key={company} className="sm-company-block">
                  <h3 className="sm-company-title">{label}</h3>
                  {isAgentSuite ? (
                    <div className="sm-suite-windows">
                      {agentWindows.map(({ agentId, kpis, goalCash }) => {
                        const winTitle = t('sm.window.agent', { agent: agentId })
                        return (
                          <SmAgentWindow
                            key={`${company}-${agentId}`}
                            title={winTitle}
                            kpis={kpis}
                            goalCash={goalCash}
                            monthLbl={dateCtx.monthLbl}
                            agentId={agentId}
                            ordersReportCompanies={reportCos}
                            hideOrders7Days
                            receiptsCurrentMonthOnly
                            onOpenOrdersReport={companyId => openOrdersReport(companyId, [agentId])}
                            onOpenDebtReport={() =>
                              openDebtReport(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenOpenOrdersReport={() =>
                              openOpenOrdersItems(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenReturnsReport={() =>
                              openReturnsItems(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenReceiptsReport={() =>
                              openReceiptsReport(company, [agentId], `${label} — ${winTitle}`)
                            }
                            biBlock={
                              <SuiteExtrasBlock
                                biVisibleIds={visibleBiIds}
                                suiteUiVisibleIds={visibleSuiteUiIds}
                                mode="agent"
                                agentId={agentId}
                                company={company}
                                rows={rows}
                                stockBySku={stockBySku}
                                habit={habit}
                                suiteAgents={scopedAgents}
                                curYear={dateCtx.curYear}
                                curMonth={dateCtx.curMonth}
                              />
                            }
                          />
                        )
                      })}
                    </div>
                  ) : viewMode === 'vs' && vsSeries ? (
                    <SmVsCompanyView
                      series={vsSeries}
                      monthLbl={dateCtx.monthLbl}
                      ordersReportCompanies={reportCos}
                      onOpenOrdersReport={companyId => openOrdersReport(companyId, allAgentsScope)}
                      onOpenDebtReport={() => openDebtReport(company, allAgentsScope, `${label} — Vs`)}
                      onOpenOpenOrdersReport={() =>
                        openOpenOrdersItems(company, allAgentsScope, `${label} — Vs`)
                      }
                      onOpenReturnsReport={() =>
                        openReturnsItems(company, allAgentsScope, `${label} — Vs`)
                      }
                      onOpenReceiptsReport={() =>
                        openReceiptsReport(company, allAgentsScope, `${label} — Vs`)
                      }
                      biBlock={
                        <SuiteExtrasBlock
                          biVisibleIds={visibleBiIds}
                          suiteUiVisibleIds={visibleSuiteUiIds}
                          mode="all"
                          company={company}
                          rows={rows}
                          stockBySku={stockBySku}
                          habit={habit}
                          suiteAgents={scopedAgents}
                          curYear={dateCtx.curYear}
                          curMonth={dateCtx.curMonth}
                        />
                      }
                    />
                  ) : (
                    <div className="sm-suite-windows">
                      <SmAgentWindow
                        title={allTitle}
                        kpis={allKpis}
                        goalCash={allGoal}
                        monthLbl={dateCtx.monthLbl}
                        agentId={null}
                        ordersReportCompanies={reportCos}
                        onOpenOrdersReport={companyId => openOrdersReport(companyId, allAgentsScope)}
                        onOpenDebtReport={() =>
                          openDebtReport(company, allAgentsScope, `${label} — ${allTitle}`)
                        }
                        onOpenOpenOrdersReport={() =>
                          openOpenOrdersItems(company, allAgentsScope, `${label} — ${allTitle}`)
                        }
                        onOpenReturnsReport={() =>
                          openReturnsItems(company, allAgentsScope, `${label} — ${allTitle}`)
                        }
                        onOpenReceiptsReport={() =>
                          openReceiptsReport(company, allAgentsScope, `${label} — ${allTitle}`)
                        }
                        biBlock={
                          <SuiteExtrasBlock
                            biVisibleIds={visibleBiIds}
                            suiteUiVisibleIds={visibleSuiteUiIds}
                            mode="all"
                            company={company}
                            rows={rows}
                            stockBySku={stockBySku}
                            habit={habit}
                            suiteAgents={scopedAgents}
                            curYear={dateCtx.curYear}
                            curMonth={dateCtx.curMonth}
                          />
                        }
                      />
                      {agentWindows.map(({ agentId, kpis, goalCash }) => {
                        const winTitle = t('sm.window.agent', { agent: agentId })
                        return (
                          <SmAgentWindow
                            key={`${company}-${agentId}`}
                            title={winTitle}
                            kpis={kpis}
                            goalCash={goalCash}
                            monthLbl={dateCtx.monthLbl}
                            agentId={agentId}
                            ordersReportCompanies={reportCos}
                            onOpenOrdersReport={companyId => openOrdersReport(companyId, [agentId])}
                            onOpenDebtReport={() =>
                              openDebtReport(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenOpenOrdersReport={() =>
                              openOpenOrdersItems(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenReturnsReport={() =>
                              openReturnsItems(company, [agentId], `${label} — ${winTitle}`)
                            }
                            onOpenReceiptsReport={() =>
                              openReceiptsReport(company, [agentId], `${label} — ${winTitle}`)
                            }
                            biBlock={
                              <SuiteExtrasBlock
                                biVisibleIds={visibleBiIds}
                                suiteUiVisibleIds={visibleSuiteUiIds}
                                mode="agent"
                                agentId={agentId}
                                company={company}
                                rows={rows}
                                stockBySku={stockBySku}
                                habit={habit}
                                suiteAgents={scopedAgents}
                                curYear={dateCtx.curYear}
                                curMonth={dateCtx.curMonth}
                              />
                            }
                          />
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            },
          )}
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

      {debtModal ? (
        <DebtModal
          company={debtModal.company}
          debtData={debtModal.rows}
          debtLastUpdate={data?.debtFileDates?.[debtModal.company] || debtLastUpdate}
          titleOverride={debtModal.title}
          onClose={() => setDebtModal(null)}
        />
      ) : null}

      {itemsModal ? (
        <SmItemsReportModal
          title={itemsModal.title}
          items={itemsModal.items}
          emptyLabel={itemsModal.emptyLabel}
          onClose={() => setItemsModal(null)}
        />
      ) : null}

      {openOrdersModal ? (
        <SmOpenOrdersReportModal
          title={openOrdersModal.title}
          orders={openOrdersModal.orders}
          onClose={() => setOpenOrdersModal(null)}
        />
      ) : null}

      {receiptsModal ? (
        <SmReceiptsReportModal
          title={receiptsModal.title}
          company={receiptsModal.company}
          agents={receiptsModal.agents}
          onClose={() => setReceiptsModal(null)}
        />
      ) : null}
    </div>
  )
}
