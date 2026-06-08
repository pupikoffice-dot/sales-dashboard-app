import { useMemo } from 'react'
import { SalesClientsView } from '../components/sales/SalesClientsView'
import { SalesItemsView } from '../components/sales/SalesItemsView'
import { SalesStockView } from '../components/sales/SalesStockView'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { getReportRows } from '../lib/salesReportRows'

export function SalesPage() {
  const f = useDashboardFilters()
  const { rows: allRows, wmsStock, wmsNames, itemCost, itemPrice, isLoading, error } =
    useDashboardData()

  const companyRows = useMemo(
    () => (f.company ? allRows.filter(r => r.company === f.company) : []),
    [allRows, f.company],
  )

  const reportRows = useMemo(
    () => (f.applied ? getReportRows(allRows, f) : []),
    [
      allRows,
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

  const title = f.dateMode === 'openorders' ? 'Open Orders' : 'Sales Performance'
  const icon = f.dateMode === 'openorders' ? '📋' : '📊'

  if (!f.company) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>
          Select a <b>company</b> in the sidebar, set view options, then click{' '}
          <b>Apply &amp; Render</b>.
        </p>
      </div>
    )
  }

  if (!f.applied) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>
          Filters are set — click <b>Apply &amp; Render</b> in the sidebar to load the report.
        </p>
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
          <p>Building stock report…</p>
        </div>
      )
    }
    if (error) {
      return <div className="err">Failed to load data: {(error as Error).message}</div>
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
        <p>Loading data…</p>
      </div>
    )
  }

  if (error) {
    return <div className="err">Failed to load data: {(error as Error).message}</div>
  }

  if (!reportRows.length) {
    return (
      <div className="err">
        No data for the selected filters and period.
      </div>
    )
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

  return <div className="err">Select a view in the sidebar.</div>
}
