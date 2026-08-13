import { useEffect, useMemo, useState } from 'react'
import { SalesClientsView } from './SalesClientsView'
import { SalesItemsView } from './SalesItemsView'
import { SalesSuppliersView } from './SalesSuppliersView'
import { SalesStockView } from './SalesStockView'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useDashboardFilters } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { filterRows } from '../../lib/permissions'
import { getReportRows } from '../../lib/salesReportRows'
import type { SalesRow } from '../../types/dashboard'

const REPORT_DEFER_MS = 0

function ReportSpinner({ message }: { message: string }) {
  return (
    <div className="welcome">
      <div className="spin-wrap">
        <div className="spin" />
      </div>
      <p>{message}</p>
    </div>
  )
}

/** Rendered sales report after Apply — shared by SalesPage and Oversite (limited users). */
export function SalesReportBody() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  const { t } = useLocale()
  const { allRows, wmsStock, wmsNames, itemCost, itemPrice, isLoading, error } =
    useDashboardData()

  const [reportRows, setReportRows] = useState<SalesRow[]>([])
  const [reportReady, setReportReady] = useState(false)
  const [buildingReport, setBuildingReport] = useState(false)

  // History rows behind the year-over-year comparison column. These MUST carry
  // the same agent scope as the current-year figure (getReportRows ->
  // applyAgentFilter), otherwise a cell compares one agent's sales this year
  // against every agent's sales last year. Real agent logins never saw this
  // (the server only returns their rows), but the "View as" preview loads the
  // super admin's full dataset, which exposed the mismatch.
  const companyRows = useMemo(
    () =>
      f.company && access
        ? filterRows(access, allRows).filter(r => r.company === f.company)
        : [],
    [allRows, f.company, access],
  )

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        company: f.company,
        dateMode: f.dateMode,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        months: [...f.selectedMonths].sort(),
        view: f.view,
        clientMode: f.clientMode,
        catType: f.catType,
        itemMode: f.itemMode,
        supplierMode: f.supplierMode,
        clients: [...f.selectedClientIds].sort(),
        categories: [...f.selectedCategories].sort(),
        items: [...f.selectedItemSkus].sort(),
        suppliers: [...f.selectedSuppliers].sort(),
      }),
    [
      f.company,
      f.dateMode,
      f.dateFrom,
      f.dateTo,
      f.selectedMonths,
      f.view,
      f.clientMode,
      f.catType,
      f.itemMode,
      f.supplierMode,
      f.selectedClientIds,
      f.selectedCategories,
      f.selectedItemSkus,
      f.selectedSuppliers,
    ],
  )

  useEffect(() => {
    if (!f.applied || !f.company) {
      setReportRows([])
      setReportReady(false)
      setBuildingReport(false)
      return
    }

    if (isLoading) {
      setReportReady(false)
      setBuildingReport(false)
      return
    }

    setBuildingReport(true)
    setReportReady(false)

    const id = window.setTimeout(() => {
      try {
        if (f.dateMode === 'stock') {
          setReportRows([])
        } else {
          setReportRows(getReportRows(allRows, f, access))
        }
        setReportReady(true)
      } finally {
        setBuildingReport(false)
        f.finishRendering()
      }
    }, REPORT_DEFER_MS)

    return () => window.clearTimeout(id)
  }, [f.applied, f.company, isLoading, allRows, access, filterKey, f.finishRendering])

  if (!f.company || !f.applied) return null

  if (isLoading) {
    return <ReportSpinner message={t('common.loadingData')} />
  }

  if (error) {
    return <div className="err">{t('sales.loadFailed', { error: (error as Error).message })}</div>
  }

  if (buildingReport || !reportReady) {
    return <ReportSpinner message={t('common.renderingReport')} />
  }

  if (f.dateMode === 'stock') {
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
        itemPrice={itemPrice}
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
        itemPrice={itemPrice}
      />
    )
  }

  if (f.view === 'suppliers') {
    return (
      <SalesSuppliersView
        rows={reportRows}
        filters={f}
        companyRows={companyRows}
        wmsStock={wmsStock}
        itemPrice={itemPrice}
      />
    )
  }

  return <div className="err">{t('sales.pickView')}</div>
}
