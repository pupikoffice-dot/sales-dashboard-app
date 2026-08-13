import { useEffect, useMemo, useState } from 'react'
import { SortableTh } from './SortableTh'
import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt0, fmt2 } from '../../lib/format'
import { canShowClientProfit, canShowItemCost } from '../../lib/permissions'
import { companyLabel } from '../../lib/salesMetrics'
import { matchesSearch } from '../../lib/salesSearch'
import { buildStockReport, type StockReport } from '../../lib/stockReport'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { TableWithExport } from './TableWithExport'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsNamesMap, WmsStockMap } from '../../lib/wmsData'

interface SalesStockViewProps {
  allRows: SalesRow[]
  filters: DashboardFiltersState
  wmsStock: WmsStockMap
  wmsNames: WmsNamesMap
  itemCost: SkuValueMap
  itemPrice: SkuValueMap
}

function SalesStockContent({
  allRows,
  filters,
  wmsStock,
  wmsNames,
  itemCost,
  itemPrice,
}: SalesStockViewProps) {
  const { searchQuery, setSearchQuery, setReportChart, openChart, reportChart } = useSalesReportUi()
  const { access } = useDashboardAccess()
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const showItemCost = canShowItemCost(access, isSuperAdmin)
  const showClientProfit = canShowClientProfit(access, isSuperAdmin)
  const company = filters.company as LogicalCompany

  const [report, setReport] = useState<StockReport | null>(null)

  useEffect(() => {
    setReport(null)
    const id = window.setTimeout(() => {
      setReport(buildStockReport(allRows, company, wmsStock, wmsNames, itemCost, itemPrice))
    }, 0)
    return () => window.clearTimeout(id)
  }, [allRows, company, wmsStock, wmsNames, itemCost, itemPrice])

  const visibleRows = useMemo(
    () => (report?.rows ?? []).filter(r => matchesSearch(searchQuery, r.sku, r.name)),
    [report, searchQuery],
  )

  useEffect(() => {
    if (!report || !showItemCost) {
      setReportChart(null)
      return
    }
    const entries = report.rows
      .map(row => ({
        label: row.name,
        sku: row.sku,
        value: row.totalCost ?? 0,
        qty: row.wmsQty,
        ooQty: row.ooQty,
      }))
      .filter(e => e.value > 0)
    const title = `Top Items by Total Cost — ${companyLabel(company)}`
    setReportChart(entries.length ? { kind: 'stock', entries, title } : null)
    return () => setReportChart(null)
  }, [report, company, setReportChart, showItemCost])

  if (!report) {
    return (
      <div className="welcome">
        <div className="spin-wrap">
          <div className="spin" />
        </div>
        <p>Building stock report…</p>
      </div>
    )
  }

  if (!report.rows.length) {
    return <div className="err">No stock data found for this company.</div>
  }

  const totals = visibleRows.reduce(
    (acc, row) => ({
      lastMoQty: acc.lastMoQty + row.lastMoQty,
      wmsQty: acc.wmsQty + row.wmsQty,
      ooQty: acc.ooQty + row.ooQty,
      available: acc.available + row.available,
      totalCost: acc.totalCost + (row.totalCost ?? 0),
    }),
    { lastMoQty: 0, wmsQty: 0, ooQty: 0, available: 0, totalCost: 0 },
  )

  const availStyle = totals.available < 0 ? 'stock-neg' : 'stock-pos'

  return (
    <div>
      <div className="sbar">
        <span>
          Company: <b>{companyLabel(company)}</b>
        </span>
        <span>
          View: <b>Stock</b>
        </span>
        <span>
          Last Month: <b>{report.lastMonthLabel}</b>
        </span>
        <span>
          Total Qty: <b className="accent2">{fmt0(totals.wmsQty)}</b>
        </span>
        {showItemCost && (
          <span>
            Total Cost: <b className="accent">{fmt0(totals.totalCost)}</b>
          </span>
        )}
        <div className="sbar-actions">
          <input
            className="sbar-search"
            type="text"
            placeholder="🔍 Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {reportChart && (
            <button type="button" className="sbar-chart-btn" onClick={() => openChart(reportChart)}>
              📊 Chart
            </button>
          )}
        </div>
      </div>

      {!visibleRows.length ? (
        <div className="err">No rows match your search.</div>
      ) : (
        <TableWithExport>
          <div className="tw tw-sticky">
            <table>
            <thead>
              <tr>
                <SortableTh style={{ textAlign: 'left' }}>SKU</SortableTh>
                <SortableTh style={{ textAlign: 'left' }}>Item Name</SortableTh>
                <SortableTh>Last Mo. Qty</SortableTh>
                <SortableTh className="accent2">WMS Stock</SortableTh>
                <SortableTh>Open Orders Qty</SortableTh>
                <SortableTh>Available</SortableTh>
                {showItemCost && (
                  <>
                    <SortableTh>Cost</SortableTh>
                    <SortableTh>Total Cost</SortableTh>
                  </>
                )}
                {showClientProfit && <SortableTh>Price</SortableTh>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => {
                const availClass = row.available < 0 ? 'stock-neg' : 'stock-pos'
                return (
                  <tr key={row.sku}>
                    <td>{row.sku}</td>
                    <td title={row.name}>{row.name}</td>
                    <td data-sv={row.lastMoQty}>{fmt0(row.lastMoQty)}</td>
                    <td data-sv={row.wmsQty} className="accent2">
                      {fmt0(row.wmsQty)}
                    </td>
                    <td data-sv={row.ooQty}>{fmt0(row.ooQty)}</td>
                    <td data-sv={row.available} className={availClass}>
                      {fmt0(row.available)}
                    </td>
                    {showItemCost && (
                      <>
                        <td data-sv={row.cost ?? ''}>{row.cost != null ? fmt2(row.cost) : '—'}</td>
                        <td data-sv={row.totalCost ?? ''}>
                          {row.totalCost != null ? fmt0(row.totalCost) : '—'}
                        </td>
                      </>
                    )}
                    {showClientProfit && (
                      <td data-sv={row.price ?? ''}>{row.price != null ? fmt2(row.price) : '—'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>—</td>
                <td>Total</td>
                <td>{fmt0(totals.lastMoQty)}</td>
                <td className="accent2">{fmt0(totals.wmsQty)}</td>
                <td>{fmt0(totals.ooQty)}</td>
                <td className={availStyle}>{fmt0(totals.available)}</td>
                {showItemCost && (
                  <>
                    <td>—</td>
                    <td>{fmt0(totals.totalCost)}</td>
                  </>
                )}
                {showClientProfit && <td>—</td>}
              </tr>
            </tfoot>
            </table>
          </div>
        </TableWithExport>
      )}
    </div>
  )
}

export function SalesStockView(props: SalesStockViewProps) {
  return (
    <SalesReportUiProvider>
      <div id="sales-report">
        <SalesReportStickySetup />
        <SalesStockContent {...props} />
      </div>
    </SalesReportUiProvider>
  )
}
