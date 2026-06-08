import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { useReportChart } from '../../hooks/useReportChart'
import { matchesSearch } from '../../lib/salesSearch'
import { sumRows } from '../../lib/salesMetrics'
import type { LogicalCompany, SalesRow } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'
import { CashSummaryTable } from './CashSummaryTable'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { SalesSection } from './SalesSection'
import { SalesStatusBar } from './SalesStatusBar'
import { SkuSummaryTable } from './SkuSummaryTable'

interface SalesClientsViewProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  companyRows: SalesRow[]
  wmsStock: WmsStockMap
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
}: SalesClientsViewProps) {
  const { searchQuery } = useSalesReportUi()
  useReportChart(filters, rows, {
    kind: 'client',
    pieTitle: filters.dateMode === 'openorders' ? 'Cash by Client – Open Orders' : 'Cash by Client',
  })
  const clients = groupByClient(rows)
  const company = filters.company!
  const modeLabel = filters.clientMode === 'cash' ? 'Cash summary' : 'Items breakdown'

  return (
    <div id="sales-report">
      <SalesReportStickySetup />
      <SalesStatusBar
        filters={filters}
        rows={rows}
        viewLabel={`Clients · ${modeLabel}`}
        count={Object.keys(clients).length}
      />
      {Object.entries(clients)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([cid, cl]) => {
          if (!clientSectionVisible(searchQuery, cl.name, cid, cl.rows, filters.clientMode)) {
            return null
          }
          const nameMatch = matchesSearch(searchQuery, cl.name, cid)
          const { cash, qty } = sumRows(cl.rows)
          return (
            <SalesSection
              key={cid}
              exportName={cl.name}
              exportId={cid}
              icon="👤"
              title={
                <>
                  {cl.name}{' '}
                  <span className="section-meta">{cid}</span>
                </>
              }
              cash={cash}
              qty={qty}
            >
              {filters.clientMode === 'cash' ? (
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
                  company={company as LogicalCompany}
                  companyRows={companyRows}
                  wmsStock={wmsStock}
                  showAllRows={nameMatch}
                  exportId={cid}
                  exportName={cl.name}
                />
              )}
            </SalesSection>
          )
        })}
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
