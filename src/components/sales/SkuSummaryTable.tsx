import { useMemo } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt, fmt0, fmt2 } from '../../lib/format'
import { canShowClientProfit } from '../../lib/permissions'
import { matchesSearch } from '../../lib/salesSearch'
import { getWmsQty, sumRows } from '../../lib/salesMetrics'
import { buildMonthTotalsIndex } from '../../lib/salesMonthAggregate'
import { groupSalesRowsBySku, groupSalesRowsBySkuWithNames } from '../../lib/itemNames'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'
import { DualMonthGroupedTable } from './DualMonthGroupedTable'
import { SortableTh } from './SortableTh'
import { TableWithExport } from './TableWithExport'

interface SkuSummaryTableProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  company: LogicalCompany
  /** Pre-filtered company history for compare (per-client rows or full company for items summary). */
  historyRows: SalesRow[]
  wmsStock: WmsStockMap
  itemPrice?: SkuValueMap
  showAllRows?: boolean
  exportId?: string
  exportName?: string
}

function skuPrice(itemPrice: SkuValueMap | undefined, company: LogicalCompany, sku: string) {
  const p = itemPrice?.[company]?.[sku]
  return p != null ? p : null
}

export function SkuSummaryTable({
  rows,
  filters,
  company,
  historyRows,
  wmsStock,
  itemPrice,
  showAllRows = false,
  exportId,
  exportName,
}: SkuSummaryTableProps) {
  const { searchQuery } = useSalesReportUi()
  const { access } = useDashboardAccess()
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const showClientProfit = canShowClientProfit(access, isSuperAdmin)
  const priceData = itemPrice?.[company] ?? {}

  const items = useMemo(
    () => groupSalesRowsBySkuWithNames(rows, historyRows),
    [rows, historyRows],
  )
  const historyBySku = useMemo(() => groupSalesRowsBySku(historyRows), [historyRows])
  const filteredEntries = useMemo(
    () =>
      Object.entries(items)
        .filter(([sku, it]) => showAllRows || matchesSearch(searchQuery, sku, it.name))
        .sort((a, b) => a[1].name.localeCompare(b[1].name)),
    [items, searchQuery, showAllRows],
  )

  const isSimple = filters.dateMode === 'range' || filters.dateMode === 'openorders'

  const groups = useMemo(
    () =>
      filteredEntries.map(([sku, it]) => {
        const compareRows = historyBySku[sku]?.rows ?? []
        return {
          key: sku,
          col1: sku,
          col2: it.name,
          col2Title: it.name,
          currentMonthIndex: buildMonthTotalsIndex(it.rows),
          compareMonthIndex: buildMonthTotalsIndex(compareRows),
        }
      }),
    [filteredEntries, historyBySku],
  )

  if (!filteredEntries.length) return null

  if (isSimple) {
    let tq = 0
    let tc = 0
    const body = filteredEntries.map(([sku, it]) => {
      const { cash, qty } = sumRows(it.rows)
      tq += qty
      tc += cash
      const sq = getWmsQty(sku, company, wmsStock)
      const price = priceData[sku]
      return (
        <tr key={sku}>
          <td>{sku}</td>
          <td title={it.name}>{it.name}</td>
          <td data-sv={qty}>{fmt(qty)}</td>
          <td data-sv={cash}>{fmt(cash)}</td>
          <td data-sv={sq ?? -1} className="accent2">
            {sq != null ? fmt0(sq) : '—'}
          </td>
          {showClientProfit && (
            <td data-sv={price ?? ''}>{price != null ? fmt2(price) : '—'}</td>
          )}
        </tr>
      )
    })

    return (
      <TableWithExport exportId={exportId} exportName={exportName}>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <SortableTh>SKU</SortableTh>
                <SortableTh>Item Name</SortableTh>
                <SortableTh pieQty>Qty</SortableTh>
                <SortableTh pieCash>Cash</SortableTh>
                <SortableTh>Stock</SortableTh>
                {showClientProfit && <SortableTh>Price</SortableTh>}
              </tr>
            </thead>
            <tbody>{body}</tbody>
            <tfoot>
              <tr>
                <td>—</td>
                <td>Total</td>
                <td>{fmt(tq)}</td>
                <td>{fmt(tc)}</td>
                <td>—</td>
                {showClientProfit && <td>—</td>}
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
      col1Label="SKU"
      col2Label="Item Name"
      groups={groups}
      exportId={exportId}
      exportName={exportName}
      trailingHeader={
        <>
          <th className="accent2">Stock</th>
          {showClientProfit && <th>Price</th>}
        </>
      }
      renderTrailing={group => {
        const sq = getWmsQty(group.key, company, wmsStock)
        const price = skuPrice(itemPrice, company, group.key)
        return (
          <>
            <td data-sv={sq ?? -1} className="accent2">
              {sq != null ? fmt0(sq) : '—'}
            </td>
            {showClientProfit && (
              <td data-sv={price ?? ''}>{price != null ? fmt2(price) : '—'}</td>
            )}
          </>
        )
      }}
      trailingFooter={
        <>
          <td>—</td>
          {showClientProfit && <td>—</td>}
        </>
      }
    />
  )
}
