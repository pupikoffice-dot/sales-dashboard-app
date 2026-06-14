import { useMemo, type ReactNode } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'

import { useSalesReportUi } from '../../context/SalesReportUiContext'

import { fmt, MONTH_NAMES } from '../../lib/format'

import { matchesSearch } from '../../lib/salesSearch'

import { getDualMonthCols } from '../../lib/salesDateFilter'

import { getMonthTotal, type MonthTotalsIndex } from '../../lib/salesMonthAggregate'

import { DualMonthCell } from './DualMonthCell'

import { SortableTh } from './SortableTh'

import { TableWithExport } from './TableWithExport'

export interface DualMonthGroup {
  key: string
  col1: string
  col2: string
  col2Title?: string
  currentMonthIndex: MonthTotalsIndex
  compareMonthIndex: MonthTotalsIndex
}

interface DualMonthGroupedTableProps {
  filters: DashboardFiltersState
  col1Label: string
  col2Label: string
  groups: DualMonthGroup[]
  renderTrailing?: (group: DualMonthGroup) => ReactNode
  trailingHeader?: ReactNode
  trailingFooter?: ReactNode
  showAllRows?: boolean
  exportId?: string
  exportName?: string
}

export function DualMonthGroupedTable({
  filters,
  col1Label,
  col2Label,
  groups,
  renderTrailing,
  trailingHeader,
  trailingFooter,
  showAllRows = false,
  exportId,
  exportName,
}: DualMonthGroupedTableProps) {
  const { searchQuery } = useSalesReportUi()
  const cols = getDualMonthCols(filters.selectedMonths)

  const visibleGroups = useMemo(
    () => groups.filter(g => showAllRows || matchesSearch(searchQuery, g.col1, g.col2)),
    [groups, showAllRows, searchQuery],
  )

  if (!visibleGroups.length) return null

  const gmc1: Record<number, number> = {}
  const gmq1: Record<number, number> = {}
  const gmc2: Record<number, number> = {}
  const gmq2: Record<number, number> = {}
  let gc = 0
  let gq = 0

  const body = visibleGroups.map(group => {
    let rc = 0
    let rq = 0

    const monthCells = cols.map(dc => {
      const cur = getMonthTotal(group.currentMonthIndex, dc.cur, dc.m)
      const prev = getMonthTotal(group.compareMonthIndex, dc.prev, dc.m)
      rc += cur.cash
      rq += cur.qty
      gmc1[dc.m] = (gmc1[dc.m] || 0) + cur.cash
      gmq1[dc.m] = (gmq1[dc.m] || 0) + cur.qty
      gmc2[dc.m] = (gmc2[dc.m] || 0) + prev.cash
      gmq2[dc.m] = (gmq2[dc.m] || 0) + prev.qty

      return (
        <DualMonthCell
          key={`${group.key}-${dc.m}`}
          curCash={cur.cash}
          curQty={cur.qty}
          prevCash={prev.cash}
          prevQty={prev.qty}
        />
      )
    })

    gc += rc
    gq += rq

    return (
      <tr key={group.key}>
        <td>{group.col1}</td>
        <td title={group.col2Title ?? group.col2}>{group.col2}</td>
        {monthCells}
        <td data-sv={rc} style={{ fontWeight: 700 }}>
          {fmt(rc)}
        </td>
        <td data-sv={rq} className="cm">
          {fmt(rq)}
        </td>
        {renderTrailing?.(group)}
      </tr>
    )
  })

  const footMonthCells = cols.map(dc => {
    const c1 = gmc1[dc.m] || 0
    const q1 = gmq1[dc.m] || 0
    const c2 = gmc2[dc.m] || 0
    const q2 = gmq2[dc.m] || 0
    return (
      <DualMonthCell key={`foot-${dc.m}`} curCash={c1} curQty={q1} prevCash={c2} prevQty={q2} />
    )
  })

  return (
    <TableWithExport exportId={exportId} exportName={exportName}>
      <div className="tw tw-months">
        <table className="tw-dual-months">
          <thead>
            <tr>
              <SortableTh>{col1Label}</SortableTh>
              <SortableTh>{col2Label}</SortableTh>
              {cols.map(dc => (
                <SortableTh key={`${dc.cur}-${dc.m}`}>
                  {MONTH_NAMES[dc.m - 1]}
                  <br />
                  <small className="dual-year-label">
                    {dc.cur}/{String(dc.prev).slice(2)}
                  </small>
                </SortableTh>
              ))}
              <SortableTh pieCash>Total Cash</SortableTh>
              <SortableTh pieQty>Total Qty</SortableTh>
              {trailingHeader ?? (renderTrailing ? <th className="accent2">Stock</th> : null)}
            </tr>
          </thead>
          <tbody>{body}</tbody>
          <tfoot>
            <tr>
              <td>—</td>
              <td>Total</td>
              {footMonthCells}
              <td data-sv={gc}>{fmt(gc)}</td>
              <td data-sv={gq} className="cm">
                {fmt(gq)}
              </td>
              {trailingFooter}
            </tr>
          </tfoot>
        </table>
      </div>
    </TableWithExport>
  )
}
