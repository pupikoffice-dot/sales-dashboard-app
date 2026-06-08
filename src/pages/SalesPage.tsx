import { useEffect, useMemo } from 'react'
import { SalesClientsView } from '../components/sales/SalesClientsView'
import { SalesItemsView } from '../components/sales/SalesItemsView'
import { SalesStockView } from '../components/sales/SalesStockView'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { getReportRows } from '../lib/salesReportRows'

export function SalesPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  const { t } = useLocale()
  const { allRows, wmsStock, wmsNames, itemCost, itemPrice, isLoading, error } =
    useDashboardData()

  const companyRows = useMemo(
    () => (f.company ? allRows.filter(r => r.company === f.company) : []),
    [allRows, f.company],
  )

  const reportRows = useMemo(
    () => (f.applied ? getReportRows(allRows, f, access) : []),
    [
      allRows,
      access,
      f.applied,
      f.company,
      f.dateMode,
      f.dateFrom,
      f.dateTo,
      f.selectedMonths,
      f.view,
      f.clientMode,
      f.catType,
      f.itemMode,
      f.selectedClientIds,
      f.selectedCategories,
      f.selectedItemSkus,
    ],
  )

  useEffect(() => {
    if (!f.isRendering) return
    const id = window.setTimeout(() => f.finishRendering(), 0)
    return () => window.clearTimeout(id)
  }, [f.isRendering, f.applied, reportRows, f.finishRendering])

  const title = f.dateMode === 'openorders' ? t('sales.openOrdersTitle') : t('sales.title')
  const icon = f.dateMode === 'openorders' ? '📋' : '📊'

  if (!f.company) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>{t('sales.pickCompany')}</p>
      </div>
    )
  }

  if (!f.applied) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>{t('sales.clickApply')}</p>
      </div>
    )
  }

  if (f.dateMode === 'stock') {
    if (isLoading) {
      return (
        <div className="welcome">
          <div className="spin-wrap">
            <div className="spin" />
          </div>
          <p>{t('sales.buildingStock')}</p>
        </div>
      )
    }
    if (error) {
      return <div className="err">{t('sales.loadFailed', { error: (error as Error).message })}</div>
    }
    return (
      <SalesStockView
        allRows={allRows}
        filters={f}
        wmsStock={wmsStock}
        wmsNames={wmsNames}
        itemCost={itemCost}
        itemPrice={itemPrice}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="welcome">
        <div className="spin-wrap">
          <div className="spin" />
        </div>
        <p>{t('common.loadingData')}</p>
      </div>
    )
  }

  if (error) {
    return <div className="err">{t('sales.loadFailed', { error: (error as Error).message })}</div>
  }

  if (!reportRows.length) {
    return <div className="err">{t('sales.noData')}</div>
  }

  if (f.view === 'clients') {
    return (
      <SalesClientsView
        rows={reportRows}
        filters={f}
        companyRows={companyRows}
        wmsStock={wmsStock}
      />
    )
  }

  if (f.view === 'items') {
    return (
      <SalesItemsView
        rows={reportRows}
        filters={f}
        companyRows={companyRows}
        wmsStock={wmsStock}
      />
    )
  }

  return <div className="err">{t('sales.pickView')}</div>
}
