import { useMemo } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'

import { useSalesReportUi } from '../../context/SalesReportUiContext'

import { fmt, fmt0 } from '../../lib/format'

import { matchesSearch } from '../../lib/salesSearch'

import { getWmsQty, sumRows } from '../../lib/salesMetrics'

import type { LogicalCompany, SalesRow } from '../../types/dashboard'

import type { WmsStockMap } from '../../lib/wmsData'

import { DualMonthGroupedTable } from './DualMonthGroupedTable'

import { SortableTh } from './SortableTh'

import { TableWithExport } from './TableWithExport'



interface SkuSummaryTableProps {

  rows: SalesRow[]

  filters: DashboardFiltersState

  company: LogicalCompany

  companyRows: SalesRow[]

  wmsStock: WmsStockMap

  showAllRows?: boolean

  exportId?: string

  exportName?: string

}



function groupBySku(rows: SalesRow[]) {

  const items: Record<string, { name: string; rows: SalesRow[] }> = {}

  rows.forEach(r => {

    if (!r.itemSKU) return

    const sku = r.itemSKU

    if (!items[sku]) items[sku] = { name: r.itemName || sku, rows: [] }

    items[sku].rows.push(r)

  })

  return items

}



export function SkuSummaryTable({

  rows,

  filters,

  company,

  companyRows,

  wmsStock,

  showAllRows = false,

  exportId,

  exportName,

}: SkuSummaryTableProps) {

  const { searchQuery } = useSalesReportUi()

  const items = useMemo(() => groupBySku(rows), [rows])

  const filteredEntries = useMemo(

    () =>

      Object.entries(items)

        .filter(([sku, it]) => showAllRows || matchesSearch(searchQuery, sku, it.name))

        .sort((a, b) => a[1].name.localeCompare(b[1].name)),

    [items, searchQuery, showAllRows],

  )



  const isSimple = filters.dateMode === 'range' || filters.dateMode === 'openorders'

  const clientId = rows[0]?.clientID



  if (!filteredEntries.length) return null



  if (isSimple) {

    let tq = 0

    let tc = 0

    const body = filteredEntries.map(([sku, it]) => {

      const { cash, qty } = sumRows(it.rows)

      tq += qty

      tc += cash

      const sq = getWmsQty(sku, company, wmsStock)

      return (

        <tr key={sku}>

          <td>{sku}</td>

          <td title={it.name}>{it.name}</td>

          <td data-sv={qty}>{fmt(qty)}</td>

          <td data-sv={cash}>{fmt(cash)}</td>

          <td data-sv={sq ?? -1} className="accent2">

            {sq != null ? fmt0(sq) : '—'}

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

                <SortableTh>SKU</SortableTh>

                <SortableTh>Item Name</SortableTh>

                <SortableTh pieQty>Qty</SortableTh>

                <SortableTh pieCash>Cash</SortableTh>

                <SortableTh>Stock</SortableTh>

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

              </tr>

            </tfoot>

          </table>

        </div>

      </TableWithExport>

    )

  }



  const groups = filteredEntries.map(([sku, it]) => ({

    key: sku,

    col1: sku,

    col2: it.name,

    col2Title: it.name,

    currentRows: it.rows,

    compareRows: companyRows.filter(r => {

      if (r.itemSKU !== sku) return false

      if (clientId) return r.clientID === clientId

      return true

    }),

  }))



  return (

    <DualMonthGroupedTable

      filters={filters}

      col1Label="SKU"

      col2Label="Item Name"

      groups={groups}

      exportId={exportId}

      exportName={exportName}

      renderTrailing={group => {

        const sq = getWmsQty(group.key, company, wmsStock)

        return (

          <td data-sv={sq ?? -1} className="accent2">

            {sq != null ? fmt0(sq) : '—'}

          </td>

        )

      }}

      trailingFooter={<td>—</td>}

    />

  )

}


