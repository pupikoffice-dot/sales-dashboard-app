/** Pieces shared by the two R&D pages "Multi-year data" and "Yearly data". */
import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { cssVar } from '../oversite/hub/HubChart'
import { SortTh, useSortedRows } from './sortRows'
import { fmt0 } from '../../lib/format'
import { fmtK } from '../../lib/stockByBrand'
import type { BrandMatrixRow } from '../../lib/yearlyOverview'
import type { LogicalCompany } from '../../types/dashboard'

export const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

export const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
export const signed = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)
export const changeColor = (v: number | null) => (v == null ? undefined : v >= 0 ? 'var(--grn)' : 'var(--red)')

/** Bar chart options used on both pages. */
export function barOptions(legend: boolean, money: boolean): ChartConfiguration['options'] {
  const muted = cssVar('--muted')
  const grid = cssVar('--bdr-s', '#2d3449')
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: legend, labels: { color: muted } } },
    scales: {
      x: { ticks: { color: muted }, grid: { display: false } },
      y: { ticks: { color: muted, callback: v => (money ? fmtK(Number(v)) : String(v)) }, grid: { color: grid }, beginAtZero: true },
    },
  }
}

/** The sales / receipts / imports bar charts, one bar group per label (a year or a month). */
export function buildBarCharts(
  labels: string[],
  rows: Array<{ net: number; returned: number; receipts: number | null; importQty: number | null }>,
) {
  const sales: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Net sales', data: rows.map(r => r.net), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 },
        { label: 'Returns', data: rows.map(r => r.returned), backgroundColor: cssVar('--chart-c3'), borderRadius: 3 },
      ],
    },
    options: barOptions(true, true),
  }
  const receipts: ChartConfiguration = {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Receipts', data: rows.map(r => r.receipts ?? 0), backgroundColor: cssVar('--chart-c1'), borderRadius: 3 }] },
    options: barOptions(false, true),
  }
  const imports: ChartConfiguration = {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Pieces imported', data: rows.map(r => r.importQty ?? 0), backgroundColor: cssVar('--chart-c2'), borderRadius: 3 }] },
    options: barOptions(false, false),
  }
  return { sales, receipts, imports }
}

/** Brand x column table (columns are years or months); click a heading to sort by it. */
export function BrandMatrix({
  title,
  note,
  rows,
  years,
  unit,
  colLabel = String,
}: {
  title: string
  note: string
  rows: BrandMatrixRow[]
  /** the column keys (a year, or a month number) */
  years: number[]
  unit: string
  colLabel?: (key: number) => string
}) {
  const accessors = useMemo(() => {
    const a: Record<string, (r: BrandMatrixRow) => number | string> = { brand: r => r.brand, total: r => r.total }
    for (const y of years) a[`y${y}`] = r => r.byYear[y] ?? 0
    return a
  }, [years])
  const { sorted, sort, onSort } = useSortedRows(rows, accessors, { key: 'total', dir: 'desc' }, ['brand'])
  return (
    <section className="hub-card hub-span-12">
      <div className="hub-card-hdr">
        <h3>{title}</h3>
        <span className="hub-card-aside">{note}</span>
      </div>
      {rows.length ? (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <SortTh label="Brand" k="brand" left sort={sort} onSort={onSort} />
                {years.map(y => (
                  <SortTh key={y} label={colLabel(y)} k={`y${y}`} sort={sort} onSort={onSort} />
                ))}
                <SortTh label={`Total ${unit}`} k="total" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.brand}>
                  <td style={{ textAlign: 'left' }}>{r.brand}</td>
                  {years.map(y => (
                    <td key={y}>{r.byYear[y] ? fmt0(r.byYear[y]) : '—'}</td>
                  ))}
                  <td>
                    <b>{fmt0(r.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="status-msg">Nothing recorded yet.</p>
      )}
    </section>
  )
}
