import { useState } from 'react'
import { useLocale } from '../context/LocaleContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterRowsByCompany } from '../lib/permissions'
import { computeDebtSummary, debtRowsForCompany } from '../lib/debtMetrics'
import { fmt } from '../lib/format'
import type { LogicalCompany } from '../types/dashboard'
import { DebtModal } from '../components/oversite/DebtModal'
import { OversiteDebtSummary } from '../components/oversite/OversiteDebtSummary'
import { StockAlertsPanel } from '../components/oversite/StockAlertsPanel'
import { computeStockAlerts } from '../lib/stockAlerts'
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
} from '../lib/oversiteMetrics'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection, SalesLyBars } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

export function OversitePage() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { allRows, debtRows, debtLastUpdate, wmsStock, wmsNames, isLoading, error } = useDashboardData()
  const [debtModalCo, setDebtModalCo] = useState<LogicalCompany | null>(null)

  if (isLoading) return <p className="status-msg">{t('common.loadingSalesData')}</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))
  const companyRows = access ? filterRowsByCompany(access, allRows) : []

  return (
    <>
      <div className="ov-header">
        <h2>🏠 {t('oversite.title')}</h2>
        <div className="ov-sub">
          {t('oversite.today')}: <b>{ctx.todayDisp}</b> · {t('oversite.month')}: <b>{ctx.monthLbl}</b>
        </div>
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="ov-empty">{t('oversite.noCompanies')}</p>
      ) : (
        <div className="ov-grid">
          {visibleCompanies.map(co => {
            const ordersToday = computeOrdersToday(companyRows, co.ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(companyRows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const openOrders = computeOpenOrders(companyRows, co.openOrdersTag)
            const openOrdersTop10 = computeOpenOrdersTop10(companyRows, co.openOrdersTag)
            const salesMtd = computeSalesMtd(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const ordersTop10 = computeOrdersMtdTop10(companyRows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const salesTop10 = computeSalesMtdTop10(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const returnsMtd = computeReturnsMtd(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const returnsTop10 = computeReturnsMtdTop10(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const companyDebt = debtRowsForCompany(debtRows, co.id)
            const debtSummary = computeDebtSummary(companyDebt)
            const stockAlerts = computeStockAlerts(companyRows, co.id, wmsStock, wmsNames)

            return (
              <div key={co.id} className="ov-col">
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
                    <OversiteTop10Table items={ordersTop10} emptyLabel={t('oversite.noOrderItems')} />
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
                    <OversiteTop10Table items={openOrdersTop10} emptyLabel={t('oversite.noOpenOrders')} />
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
                  <OversiteTop10Table items={salesTop10} emptyLabel={t('oversite.noSales')} />
                </OversiteSection>

                <OversiteSection title={`↩️ ${t('oversite.returnsMtd')}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.cash'), value: fmt(returnsMtd.cash), tone: 'amber' },
                      { label: t('oversite.qty'), value: fmt(returnsMtd.qty) },
                    ]}
                  />
                  <OversiteCollapsible label={`↩️ ${t('oversite.top10Returns')} ▾`}>
                    <OversiteTop10Table items={returnsTop10} emptyLabel={t('oversite.noReturns')} />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection
                  title={`💳 ${t('oversite.openDebt')}${debtLastUpdate ? ` · ${t('oversite.lastUpdate')}: ${debtLastUpdate}` : ''}`}
                >
                  <OversiteDebtSummary summary={debtSummary} onOpenReport={() => setDebtModalCo(co.id)} />
                </OversiteSection>

                <StockAlertsPanel alerts={stockAlerts} />
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
    </>
  )
}
