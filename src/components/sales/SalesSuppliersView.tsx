import { useEffect, useMemo, useState } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { useReportChart } from '../../hooks/useReportChart'
import { matchesSearch } from '../../lib/salesSearch'
import { sumRows } from '../../lib/salesMetrics'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'
import { CashSummaryTable } from './CashSummaryTable'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { SalesSection } from './SalesSection'
import { SalesStatusBar } from './SalesStatusBar'
import { SkuSummaryTable } from './SkuSummaryTable'

const LARGE_REPORT_SUPPLIER_THRESHOLD = 15
const PROGRESSIVE_BATCH_SIZE = 8

interface SalesSuppliersViewProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  companyRows: SalesRow[]
  wmsStock: WmsStockMap
  itemPrice?: SkuValueMap
}

function supplierOf(r: SalesRow): string {
  return String(r.supplier || '(No supplier)')
}

function groupBySupplier(rows: SalesRow[]) {
  const suppliers: Record<string, SalesRow[]> = {}
  rows.forEach(r => {
    const s = supplierOf(r)
    if (!suppliers[s]) suppliers[s] = []
    suppliers[s].push(r)
  })
  return suppliers
}

function supplierSectionVisible(
  searchQuery: string,
  supplier: string,
  supplierRows: SalesRow[],
  supplierMode: DashboardFiltersState['supplierMode'],
) {
  if (!searchQuery.trim()) return true
  if (matchesSearch(searchQuery, supplier, supplier)) return true
  if (supplierMode === 'cash') return false
  return supplierRows.some(r => matchesSearch(searchQuery, r.itemSKU, r.itemName))
}

function SalesSuppliersContent({
  rows,
  filters,
  companyRows,
  wmsStock,
  itemPrice,
}: SalesSuppliersViewProps) {
  const { t } = useLocale()
  const { searchQuery } = useSalesReportUi()
  useReportChart(filters, rows, {
    kind: 'supplier',
    pieTitle:
      filters.dateMode === 'openorders' ? 'Cash by Supplier – Open Orders' : 'Cash by Supplier',
  })
  const company = filters.company! as LogicalCompany
  const suppliers = useMemo(() => groupBySupplier(rows), [rows])
  const historyBySupplier = useMemo(() => {
    const m = new Map<string, SalesRow[]>()
    for (const r of companyRows) {
      const s = supplierOf(r)
      let arr = m.get(s)
      if (!arr) {
        arr = []
        m.set(s, arr)
      }
      arr.push(r)
    }
    return m
  }, [companyRows])
  const modeLabel =
    filters.supplierMode === 'cash' ? t('filters.cashSummary') : t('filters.itemsBreakdown')

  const supplierEntries = useMemo(
    () =>
      Object.entries(suppliers)
        .sort((a, b) => sumRows(b[1]).cash - sumRows(a[1]).cash)
        .filter(([s, sr]) => supplierSectionVisible(searchQuery, s, sr, filters.supplierMode)),
    [suppliers, searchQuery, filters.supplierMode],
  )

  const isLargeReport = supplierEntries.length > LARGE_REPORT_SUPPLIER_THRESHOLD
  const [renderCount, setRenderCount] = useState(PROGRESSIVE_BATCH_SIZE)

  useEffect(() => {
    setRenderCount(PROGRESSIVE_BATCH_SIZE)
  }, [rows, filters.company, filters.supplierMode, filters.dateMode, searchQuery])

  useEffect(() => {
    if (renderCount >= supplierEntries.length) return
    const id = requestAnimationFrame(() => {
      setRenderCount(c => Math.min(c + PROGRESSIVE_BATCH_SIZE, supplierEntries.length))
    })
    return () => cancelAnimationFrame(id)
  }, [renderCount, supplierEntries.length])

  const visibleEntries = supplierEntries.slice(0, renderCount)
  const loadingMore = renderCount < supplierEntries.length

  return (
    <div id="sales-report">
      <SalesReportStickySetup deferAboveTableCount={30} />
      <SalesStatusBar
        filters={filters}
        rows={rows}
        viewLabel={`${t('filters.suppliers')} · ${modeLabel}`}
        count={supplierEntries.length}
      />
      {loadingMore && (
        <div className="report-progress-hint" style={{ padding: '8px 12px', opacity: 0.75 }}>
          Loading sections… ({renderCount}/{supplierEntries.length})
        </div>
      )}
      {visibleEntries.map(([supplier, sr]) => {
        const nameMatch = matchesSearch(searchQuery, supplier, supplier)
        const { cash, qty } = sumRows(sr)
        return (
          <SalesSection
            key={supplier}
            exportName={supplier}
            exportId={supplier}
            icon="🏭"
            defaultCollapsed={isLargeReport}
            title={supplier}
            cash={cash}
            qty={qty}
            renderBody={() =>
              filters.supplierMode === 'cash' ? (
                <CashSummaryTable
                  rows={sr}
                  filters={filters}
                  exportId={supplier}
                  exportName={supplier}
                />
              ) : (
                <SkuSummaryTable
                  rows={sr}
                  filters={filters}
                  company={company}
                  historyRows={historyBySupplier.get(supplier) ?? []}
                  wmsStock={wmsStock}
                  itemPrice={itemPrice}
                  showAllRows={nameMatch}
                  exportId={supplier}
                  exportName={supplier}
                />
              )
            }
          />
        )
      })}
    </div>
  )
}

export function SalesSuppliersView(props: SalesSuppliersViewProps) {
  return (
    <SalesReportUiProvider hasSections>
      <SalesSuppliersContent {...props} />
    </SalesReportUiProvider>
  )
}
