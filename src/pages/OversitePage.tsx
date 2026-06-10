import { useState } from 'react'
import { SalesReportBody } from '../components/sales/SalesReportBody'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterRowsByCompany } from '../lib/permissions'
import { computeDebtSummary, debtRowsForCompany } from '../lib/debtMetrics'
import { fmt } from '../lib/format'
import type { LogicalCompany } from '../types/dashboard'
import { DebtModal } from '../components/oversite/DebtModal'
import { OversiteDebtSummary } from '../components/oversite/OversiteDebtSummary'
import { OrdersTodayModal } from '../components/oversite/OrdersTodayModal'
import { OversiteOrdersReportButton } from '../components/oversite/OversiteOrdersReportButton'
import { StockAlertsPanel } from '../components/oversite/StockAlertsPanel'
import {
  OVERSITE_COMPANIES,
  computeOpenOrders,
  computeOpenOrdersTop10,
  computeOrdersMtd,
  computeOrdersMtdTop10,
  computeOrdersToday,
  computeReturnsMtd,
  computeReturnsMtdTop10,
  computeSalesMtd,
  computeSalesMtdTop10,
  getOversiteDateContext,
  resolveOpenOrdersTag,
  resolveOrdersTag,
} from '../lib/oversiteMetrics'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection, SalesLyBars } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

export function OversitePage() {
  const { t } = useLocale()
  const { isSuperAdmin } = useAuth()
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()
  const { allRows, debtRows, debtLastUpdate, wmsStock, wmsNames, isLoading, error, data: dashboardData } =
    useDashboardData()
  const [debtModalCo, setDebtModalCo] = useState<LogicalCompany | null>(null)
  const [ordersModal, setOrdersModal] = useState<{
    company: LogicalCompany
    companyLabel: string
    ordersTag: string
  } | null>(null)

  if (!isSuperAdmin && f.applied) {
    return <SalesReportBody />
  }

  if (isLoading) return <p className="status-msg">{t('common.loadingSalesData')}</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))
  const companyRows = access ? filterRowsByCompany(access, allRows) : []
  const fileUpdatedAt = dashboardData?.generated?.split(' ')[1]?.slice(0, 5) ?? ''

  return (
    <>
      <div className="ov-header">
        <h2>🏠 {t('oversite.title')}</h2>
        <div className="ov-sub">
          {t('oversite.today')}: <b>{ctx.todayDisp}</b>
          {fileUpdatedAt ? (
            <>
              {' '}
              · {t('oversite.fileUpdated')}: <b>{fileUpdatedAt}</b>
            </>
          ) : null}{' '}
          · {t('oversite.month')}: <b>{ctx.monthLbl}</b>
        </div>
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="ov-empty">{t('oversite.noCompanies')}</p>
      ) : (
        <div className={`ov-grid${visibleCompanies.length === 1 ? ' ov-grid--single-co' : ''}`}>
          {visibleCompanies.map(co => {
            const ordersTag = resolveOrdersTag(companyRows, co.ordersTag)
            const openOrdersTag = resolveOpenOrdersTag(companyRows, co.openOrdersTag)
            const ordersToday = computeOrdersToday(companyRows, ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const openOrders = computeOpenOrders(companyRows, openOrdersTag)
            const openOrdersTop10 = computeOpenOrdersTop10(companyRows, openOrdersTag)
            const salesMtd = computeSalesMtd(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const ordersTop10 = computeOrdersMtdTop10(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const salesTop10 = computeSalesMtdTop10(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const returnsMtd = computeReturnsMtd(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const returnsTop10 = computeReturnsMtdTop10(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const companyDebt = debtRowsForCompany(debtRows, co.id)
            const debtSummary = computeDebtSummary(companyDebt)
            return (
              <div
                key={co.id}
                className={`ov-col${visibleCompanies.length === 1 ? ' ov-col--sections-grid' : ''}`}
              >
                <div className="ov-col-hdr" style={{ borderLeftColor: co.accentColor }}>
                  {co.label}
                </div>

                <OversiteSection title={`📋 ${t('oversite.ordersToday')}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(ordersToday.clients) },
                      { label: t('oversite.qty'), value: fmt(ordersToday.qty) },
                      { label: t('oversite.cash'), value: fmt(ordersToday.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteOrdersReportButton
                    onClick={() =>
                      setOrdersModal({ company: co.id, companyLabel: co.label, ordersTag })
                    }
                  />
                </OversiteSection>

                <OversiteSection title={`📋 ${t('oversite.ordersMtd', { month: ctx.monthLbl })}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(ordersMtd.clients) },
                      { label: t('oversite.qty'), value: fmt(ordersMtd.qty) },
                      { label: t('oversite.cash'), value: fmt(ordersMtd.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label={`📦 ${t('oversite.top10Orders')} ▾`}>
                    <OversiteTop10Table
                      items={ordersTop10}
                      emptyLabel={t('oversite.noOrderItems')}
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`📋 ${t('oversite.openOrders')}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(openOrders.clients) },
                      { label: t('oversite.qty'), value: fmt(openOrders.qty) },
                      { label: t('oversite.cash'), value: fmt(openOrders.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label={`📦 ${t('oversite.top10OpenOrders')} ▾`}>
                    <OversiteTop10Table
                      items={openOrdersTop10}
                      emptyLabel={t('oversite.noOpenOrders')}
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`💰 ${t('oversite.salesMtd', { month: ctx.monthLbl })}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.cash'), value: fmt(salesMtd.cash), tone: 'grn' },
                      { label: t('oversite.qty'), value: fmt(salesMtd.qty) },
                    ]}
                  />
                  <SalesLyBars
                    monthLbl={ctx.monthLbl}
                    lyMonthLbl={ctx.lyMonthLbl}
                    cash={salesMtd.cash}
                    lyCash={salesMtd.lyCash}
                    lyChangeCashPct={salesMtd.lyChangeCashPct}
                  />
                </OversiteSection>

                <OversiteSection title={`🏆 ${t('oversite.top10Items')}`}>
                  <OversiteTop10Table items={salesTop10} emptyLabel={t('oversite.noSales')} showSku />
                </OversiteSection>

                <OversiteSection title={`↩️ ${t('oversite.returnsMtd')}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.cash'), value: fmt(returnsMtd.cash), tone: 'amber' },
                      { label: t('oversite.qty'), value: fmt(returnsMtd.qty) },
                    ]}
                  />
                  <OversiteCollapsible label={`↩️ ${t('oversite.top10Returns')} ▾`}>
                    <OversiteTop10Table items={returnsTop10} emptyLabel={t('oversite.noReturns')} showSku />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection
                  title={`💳 ${t('oversite.openDebt')}${debtLastUpdate ? ` · ${t('oversite.lastUpdate')}: ${debtLastUpdate}` : ''}`}
                >
                  <OversiteDebtSummary summary={debtSummary} onOpenReport={() => setDebtModalCo(co.id)} />
                </OversiteSection>

                <StockAlertsPanel
                  company={co.id}
                  companyRows={companyRows}
                  wmsStock={wmsStock}
                  wmsNames={wmsNames}
                />
              </div>
            )
          })}
        </div>
      )}

      {debtModalCo && (
        <DebtModal
          company={debtModalCo}
          debtData={debtRowsForCompany(debtRows, debtModalCo)}
          debtLastUpdate={debtLastUpdate}
          onClose={() => setDebtModalCo(null)}
        />
      )}

      {ordersModal && (
        <OrdersTodayModal
          company={ordersModal.company}
          companyLabel={ordersModal.companyLabel}
          ordersTag={ordersModal.ordersTag}
          companyRows={companyRows}
          todayStr={ctx.todayStr}
          todayDisp={ctx.todayDisp}
          onClose={() => setOrdersModal(null)}
        />
      )}
    </>
  )
}
