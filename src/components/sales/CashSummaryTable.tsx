import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { TableWithExport } from './TableWithExport'
import { fmt, fmt0, MONTH_NAMES } from '../../lib/format'
import { getSortedMonths } from '../../lib/salesDateFilter'
import { sumRows } from '../../lib/salesMetrics'
import type { SalesRow } from '../../types/dashboard'

interface CashSummaryTableProps {
  rows: SalesRow[]
  filters: DashboardFiltersState
  exportId?: string
  exportName?: string
}

export function CashSummaryTable({ rows, filters, exportId, exportName }: CashSummaryTableProps) {
  if (filters.dateMode === 'range' || filters.dateMode === 'openorders') {
    const { cash, qty } = sumRows(rows)
    return (
      <TableWithExport exportId={exportId} exportName={exportName}>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>💰 Total Cash</th>
                <th style={{ textAlign: 'left' }}>📦 Total Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left' }}>{fmt(cash)}</td>
                <td style={{ textAlign: 'left' }}>{fmt(qty)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </TableWithExport>
    )
  }

  const months = getSortedMonths(filters.selectedMonths)
  let totC = 0
  let totQ = 0

  const cashCells = months.map(mk => {
    const [y, m] = mk.split('-')
    const v = rows
      .filter(r => Number(r.year) === +y && Number(r.month) === +m)
      .reduce((a, r) => a + (r.cash || 0), 0)
    totC += v
    return (
      <td key={`c-${mk}`}>{fmt0(v)}</td>
    )
  })

  const qtyCells = months.map(mk => {
    const [y, m] = mk.split('-')
    const v = rows
      .filter(r => Number(r.year) === +y && Number(r.month) === +m)
      .reduce((a, r) => a + (r.qty || 0), 0)
    totQ += v
    return (
      <td key={`q-${mk}`} className="cm">
        {fmt0(v)}
      </td>
    )
  })

  return (
    <TableWithExport exportId={exportId} exportName={exportName} barChart>
      <div className="tw">
        <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Metric</th>
            {months.map(mk => {
              const [y, m] = mk.split('-')
              return (
                <th key={mk}>
                  {MONTH_NAMES[+m - 1]} {y}
                </th>
              )
            })}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'left' }}>💰 Cash</td>
            {cashCells}
            <td style={{ fontWeight: 700 }}>{fmt(totC)}</td>
          </tr>
          <tr>
            <td style={{ textAlign: 'left' }}>📦 Qty</td>
            {qtyCells}
            <td className="cm" style={{ fontWeight: 700 }}>
              {fmt(totQ)}
            </td>
          </tr>
        </tbody>
        </table>
      </div>
    </TableWithExport>
  )
}
