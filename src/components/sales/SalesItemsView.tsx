import { useMemo } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { SortableTh } from './SortableTh'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { useReportChart } from '../../hooks/useReportChart'
import { useDashboardData } from '../../hooks/useDashboardData'
import { fmt, fmt0 } from '../../lib/format'
import { matchesSearch } from '../../lib/salesSearch'
import { getWmsQty, sumRows } from '../../lib/salesMetrics'
import { buildMonthTotalsIndex } from '../../lib/salesMonthAggregate'
import { groupSalesRowsBySkuWithNames, resolveSkuDisplayName } from '../../lib/itemNames'
import { buildSkuNameLookupFromFilterIndex } from '../../lib/salesFilterIndex'
import { effectiveCompany } from '../../lib/salesFilterLists'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'
import { DualMonthGroupedTable } from './DualMonthGroupedTable'
import { SalesSection } from './SalesSection'
import { SalesStatusBar } from './SalesStatusBar'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { SkuSummaryTable } from './SkuSummaryTable'
import { TableWithExport } from './TableWithExport'

interface SalesItemsViewProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  companyRows: SalesRow[]
  wmsStock: WmsStockMap
  itemPrice?: SkuValueMap
}

function itemSectionVisible(
  searchQuery: string,
  name: string,
  sku: string,
  itemRows: SalesRow[],
) {
  if (!searchQuery.trim()) return true
  if (matchesSearch(searchQuery, name, sku)) return true
  return itemRows.some(
    r => r.clientID && matchesSearch(searchQuery, r.clientID, r.clientName),
  )
}

function ClientsUnderItemTable({
  rows,
  filters,
  company,
  companyRows,
  wmsStock,
  showAllRows = false,
  exportId = '',
  exportName = '',
}: {
  rows: SalesRow[]
  filters: DashboardFiltersState
  company: LogicalCompany
  companyRows: SalesRow[]
  wmsStock: WmsStockMap
  showAllRows?: boolean
  exportId?: string
  exportName?: string
}) {
  const { searchQuery } = useSalesReportUi()
  const sku = rows[0]?.itemSKU || ''
  const sq = sku ? getWmsQty(sku, company, wmsStock) : null
  const sqFmt = sq != null ? fmt0(sq) : '—'

  const filteredClients = useMemo(() => {
    const clients: Record<string, { name: string; rows: SalesRow[] }> = {}
    rows.forEach(r => {
      if (!r.clientID) return
      if (!clients[r.clientID]) {
        clients[r.clientID] = { name: r.clientName || r.clientID, rows: [] }
      }
      clients[r.clientID].rows.push(r)
    })
    return Object.entries(clients)
      .filter(([cid, cl]) => showAllRows || matchesSearch(searchQuery, cid, cl.name))
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [rows, searchQuery, showAllRows])

  const coRawByClient = useMemo(() => {
    const byClient = new Map<string, SalesRow[]>()
    for (const r of companyRows) {
      if (r.itemSKU !== sku || !r.clientID) continue
      let arr = byClient.get(r.clientID)
      if (!arr) {
        arr = []
        byClient.set(r.clientID, arr)
      }
      arr.push(r)
    }
    return byClient
  }, [companyRows, sku])

  const groups = useMemo(
    () =>
      filteredClients.map(([cid, cl]) => ({
        key: cid,
        col1: cid,
        col2: cl.name,
        col2Title: cl.name,
        currentMonthIndex: buildMonthTotalsIndex(cl.rows),
        compareMonthIndex: buildMonthTotalsIndex(coRawByClient.get(cid) ?? []),
      })),
    [filteredClients, coRawByClient],
  )

  if (!filteredClients.length) return null

  const isSimple = filters.dateMode === 'range' || filters.dateMode === 'openorders'

  if (isSimple) {
    let tq = 0
    let tc = 0
    const body = filteredClients.map(([cid, cl]) => {
      const { cash, qty } = sumRows(cl.rows)
      tq += qty
      tc += cash
      return (
        <tr key={cid}>
          <td>{cid}</td>
          <td title={cl.name}>{cl.name}</td>
          <td data-sv={qty}>{fmt(qty)}</td>
          <td data-sv={cash}>{fmt(cash)}</td>
          <td data-sv={sq ?? -1} className="accent2">
            {sqFmt}
          </td>
        </tr>
      )
    })

    return (
      <TableWithExport exportId={exportId} exportName={exportName}>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <SortableTh>Client ID</SortableTh>
                <SortableTh>Client Name</SortableTh>
                <SortableTh pieQty>Qty</SortableTh>
                <SortableTh pieCash>Cash</SortableTh>
                <SortableTh className="accent2">Stock</SortableTh>
              </tr>
            </thead>
            <tbody>{body}</tbody>
            <tfoot>
              <tr>
                <td>—</td>
                <td>Total</td>
                <td>{fmt(tq)}</td>
                <td>{fmt(tc)}</td>
                <td className="accent2">{sqFmt}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </TableWithExport>
    )
  }

  return (
    <DualMonthGroupedTable
      filters={filters}
      col1Label="Client ID"
      col2Label="Client Name"
      groups={groups}
      showAllRows={showAllRows}
      exportId={exportId}
      exportName={exportName}
      renderTrailing={() => <td className="accent2">{sqFmt}</td>}
      trailingFooter={<td className="accent2">{sqFmt}</td>}
    />
  )
}

function SalesItemsContent({ rows, filters, companyRows, wmsStock, itemPrice }: SalesItemsViewProps) {
  const { t } = useLocale()
  const { searchQuery } = useSalesReportUi()
  const { filterIndex } = useDashboardData()
  useReportChart(filters, rows, { kind: 'item', pieTitle: 'Cash by Item' })
  const company = filters.company! as LogicalCompany
  const companyTag = effectiveCompany(company, filters.dateMode)
  const skuNameLookup = useMemo(
    () => buildSkuNameLookupFromFilterIndex(filterIndex, companyTag),
    [filterIndex, companyTag],
  )
  const displayName = (sku: string, fallback: string) =>
    resolveSkuDisplayName(sku, fallback, skuNameLookup)
  const catLabel =
    filters.catType === 'tablet' ? t('filters.tabletCategory') : t('filters.groupCategory')
  const modeLabel =
    filters.itemMode === 'clients' ? t('filters.byClients') : t('filters.itemsSummary')

  if (filters.itemMode === 'items') {
    return (
      <div id="sales-report">
        <SalesReportStickySetup />
        <SalesStatusBar
          filters={filters}
          rows={rows}
          viewLabel={`${t('filters.items')} · ${catLabel} · ${modeLabel}`}
          count={filters.selectedItemSkus.size}
        />
        <SkuSummaryTable
          rows={rows}
          filters={filters}
          company={company}
          historyRows={companyRows}
          wmsStock={wmsStock}
          itemPrice={itemPrice}
        />
      </div>
    )
  }

  const items = groupSalesRowsBySkuWithNames(rows, companyRows)
  return (
    <div id="sales-report">
      <SalesReportStickySetup />
      <SalesStatusBar
        filters={filters}
        rows={rows}
        viewLabel={`${t('filters.items')} · ${catLabel} · ${modeLabel}`}
        count={Object.keys(items).length}
      />
      {Object.entries(items)
        .sort((a, b) =>
          displayName(a[0], a[1].name).localeCompare(displayName(b[0], b[1].name)),
        )
        .map(([sku, it]) => {
          const name = displayName(sku, it.name)
          if (!itemSectionVisible(searchQuery, name, sku, it.rows)) return null
          const nameMatch = matchesSearch(searchQuery, name, sku)
          const { cash, qty } = sumRows(it.rows)
          const sq = wmsStock[company]?.[sku] ?? null
          return (
            <SalesSection
              key={sku}
              exportName={name}
              exportId={sku}
              icon="📦"
              title={
                <>
                  {name} <span className="section-meta">{sku}</span>
                </>
              }
              cash={cash}
              qty={qty}
              stockQty={sq}
              renderBody={() => (
                <ClientsUnderItemTable
                  rows={it.rows}
                  filters={filters}
                  company={company}
                  companyRows={companyRows}
                  wmsStock={wmsStock}
                  showAllRows={nameMatch}
                  exportId={sku}
                  exportName={name}
                />
              )}
            />
          )
        })}
    </div>
  )
}

export function SalesItemsView(props: SalesItemsViewProps) {
  const hasSections = props.filters.itemMode === 'clients'
  return (
    <SalesReportUiProvider hasSections={hasSections}>
      <SalesItemsContent {...props} />
    </SalesReportUiProvider>
  )
}
