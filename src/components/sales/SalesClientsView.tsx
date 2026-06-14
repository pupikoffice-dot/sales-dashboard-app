import { useEffect, useMemo, useState } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { useReportChart } from '../../hooks/useReportChart'
import { buildClientHistoryIndexes } from '../../lib/clientItemsBreakdownHtml'
import { matchesSearch } from '../../lib/salesSearch'
import { sumRows } from '../../lib/salesMetrics'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'
import { CashSummaryTable } from './CashSummaryTable'
import { LargeClientsItemsReport } from './LargeClientsItemsReport'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { SalesSection } from './SalesSection'
import { SalesStatusBar } from './SalesStatusBar'
import { SkuSummaryTable } from './SkuSummaryTable'

const LARGE_REPORT_CLIENT_THRESHOLD = 15
const PROGRESSIVE_BATCH_SIZE = 8

interface SalesClientsViewProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  companyRows: SalesRow[]
  wmsStock: WmsStockMap
  itemPrice?: SkuValueMap
}

function groupByClient(rows: SalesRow[]) {
  const clients: Record<string, { name: string; rows: SalesRow[] }> = {}
  rows.forEach(r => {
    if (!r.clientID) return
    if (!clients[r.clientID]) {
      clients[r.clientID] = { name: r.clientName || r.clientID, rows: [] }
    }
    clients[r.clientID].rows.push(r)
  })
  return clients
}

function clientSectionVisible(
  searchQuery: string,
  name: string,
  id: string,
  clientRows: SalesRow[],
  clientMode: DashboardFiltersState['clientMode'],
) {
  if (!searchQuery.trim()) return true
  if (matchesSearch(searchQuery, name, id)) return true
  if (clientMode === 'cash') return false
  return clientRows.some(r => matchesSearch(searchQuery, r.itemSKU, r.itemName))
}

function SalesClientsContent({
  rows,
  filters,
  companyRows,
  wmsStock,
  itemPrice,
}: SalesClientsViewProps) {
  const { t } = useLocale()
  const { searchQuery } = useSalesReportUi()
  useReportChart(filters, rows, {
    kind: 'client',
    pieTitle: filters.dateMode === 'openorders' ? 'Cash by Client – Open Orders' : 'Cash by Client',
  })
  const clients = useMemo(() => groupByClient(rows), [rows])
  const { rowsByClient } = useMemo(() => buildClientHistoryIndexes(companyRows), [companyRows])
  const company = filters.company! as LogicalCompany
  const modeLabel =
    filters.clientMode === 'cash' ? t('filters.cashSummary') : t('filters.itemsBreakdown')

  const clientEntries = useMemo(
    () =>
      Object.entries(clients)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .filter(([cid, cl]) =>
          clientSectionVisible(searchQuery, cl.name, cid, cl.rows, filters.clientMode),
        ),
    [clients, searchQuery, filters.clientMode],
  )

  const isLargeReport = clientEntries.length > LARGE_REPORT_CLIENT_THRESHOLD
  const useHtmlItemsPath =
    isLargeReport &&
    filters.clientMode === 'items' &&
    filters.dateMode === 'months'

  const [renderCount, setRenderCount] = useState(PROGRESSIVE_BATCH_SIZE)

  useEffect(() => {
    setRenderCount(PROGRESSIVE_BATCH_SIZE)
  }, [rows, filters.company, filters.clientMode, filters.dateMode, searchQuery])

  useEffect(() => {
    if (useHtmlItemsPath || renderCount >= clientEntries.length) return
    const id = requestAnimationFrame(() => {
      setRenderCount(c => Math.min(c + PROGRESSIVE_BATCH_SIZE, clientEntries.length))
    })
    return () => cancelAnimationFrame(id)
  }, [renderCount, clientEntries.length, useHtmlItemsPath])

  const visibleEntries = useHtmlItemsPath
    ? clientEntries
    : clientEntries.slice(0, renderCount)
  const loadingMore = !useHtmlItemsPath && renderCount < clientEntries.length

  return (
    <div id="sales-report">
      {!useHtmlItemsPath && <SalesReportStickySetup deferAboveTableCount={30} />}
      <SalesStatusBar
        filters={filters}
        rows={rows}
        viewLabel={`${t('filters.clients')} · ${modeLabel}`}
        count={clientEntries.length}
      />
      {loadingMore && (
        <div className="report-progress-hint" style={{ padding: '8px 12px', opacity: 0.75 }}>
          Loading sections… ({renderCount}/{clientEntries.length})
        </div>
      )}
      {useHtmlItemsPath ? (
        <LargeClientsItemsReport
          clientEntries={clientEntries}
          companyRows={companyRows}
          filters={filters}
          company={company}
          wmsStock={wmsStock}
          itemPrice={itemPrice}
          defaultCollapsed
        />
      ) : (
        visibleEntries.map(([cid, cl]) => {
          const nameMatch = matchesSearch(searchQuery, cl.name, cid)
          const { cash, qty } = sumRows(cl.rows)
          const historyRows = rowsByClient.get(cid) ?? []
          return (
            <SalesSection
              key={cid}
              exportName={cl.name}
              exportId={cid}
              icon="👤"
              defaultCollapsed={isLargeReport}
              title={
                <>
                  {cl.name}{' '}
                  <span className="section-meta">{cid}</span>
                </>
              }
              cash={cash}
              qty={qty}
              renderBody={() =>
                filters.clientMode === 'cash' ? (
                  <CashSummaryTable
                    rows={cl.rows}
                    filters={filters}
                    exportId={cid}
                    exportName={cl.name}
                  />
                ) : (
                  <SkuSummaryTable
                    rows={cl.rows}
                    filters={filters}
                    company={company}
                    historyRows={historyRows}
                    wmsStock={wmsStock}
                    itemPrice={itemPrice}
                    showAllRows={nameMatch}
                    exportId={cid}
                    exportName={cl.name}
                  />
                )
              }
            />
          )
        })
      )}
    </div>
  )
}

export function SalesClientsView(props: SalesClientsViewProps) {
  return (
    <SalesReportUiProvider hasSections>
      <SalesClientsContent {...props} />
    </SalesReportUiProvider>
  )
}
