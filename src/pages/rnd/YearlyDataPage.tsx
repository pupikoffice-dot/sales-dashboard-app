import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { SortTh, useSortedRows } from '../../components/rnd/sortRows'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import { fmtK } from '../../lib/stockByBrand'
import { companyLabel } from '../../lib/salesMetrics'
import {
  buildBrandMatrix,
  buildYearRows,
  fetchYearlyOverview,
  type BrandMatrixRow,
} from '../../lib/yearlyOverview'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const signed = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)

/** Brand x year table: one column per year, click a heading to sort by it. */
function BrandMatrix({ title, note, rows, years, unit }: { title: string; note: string; rows: BrandMatrixRow[]; years: number[]; unit: string }) {
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
                  <SortTh key={y} label={String(y)} k={`y${y}`} sort={sort} onSort={onSort} />
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

/** R&D → Yearly data: one company, year by year. Needs the R&D section module. */
export function YearlyDataPage() {
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [picked, setPicked] = useState<LogicalCompany | null>(null)
  const company = (picked && companies.includes(picked) ? picked : companies[0]) as LogicalCompany | undefined

  const q = useQuery({
    queryKey: ['yearly-overview', company, asUser],
    queryFn: () => fetchYearlyOverview(company as string, asUser),
    enabled: !!company,
    staleTime: 10 * 60 * 1000,
  })
  const data = q.data
  const rows = useMemo(() => (data ? buildYearRows(data) : []), [data])
  const { sorted, sort, onSort } = useSortedRows(
    rows,
    {
      year: r => r.year,
      net: r => r.net,
      vsPrev: r => r.vsPrev,
      returned: r => r.returned,
      rate: r => r.rate,
      receipts: r => r.receipts,
      importQty: r => r.importQty,
      importValue: r => r.importValue,
    },
    { key: 'year', dir: 'desc' },
  )
  const brandSales = useMemo(
    () => buildBrandMatrix((data?.brandSales ?? []).map(b => ({ year: b.year, brand: b.brand, value: b.net }))),
    [data],
  )
  const brandImportQty = useMemo(
    () => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: b.year, brand: b.brand, value: b.qty }))),
    [data],
  )
  const brandImportValue = useMemo(
    () => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: b.year, brand: b.brand, value: b.value }))),
    [data],
  )

  const charts = useMemo(() => {
    if (!rows.length) return null
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const labels = rows.map(r => String(r.year))
    const base = (legend: boolean, money: boolean): ChartConfiguration['options'] => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: legend, labels: { color: muted } } },
      scales: {
        x: { ticks: { color: muted }, grid: { display: false } },
        y: { ticks: { color: muted, callback: v => (money ? fmtK(Number(v)) : String(v)) }, grid: { color: grid }, beginAtZero: true },
      },
    })
    const sales: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Net sales', data: rows.map(r => r.net), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 },
          { label: 'Returns', data: rows.map(r => r.returned), backgroundColor: cssVar('--chart-c3'), borderRadius: 3 },
        ],
      },
      options: base(true, true),
    }
    const receipts: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Receipts', data: rows.map(r => r.receipts ?? 0), backgroundColor: cssVar('--chart-c1'), borderRadius: 3 }] },
      options: base(false, true),
    }
    const imports: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Pieces imported', data: rows.map(r => r.importQty ?? 0), backgroundColor: cssVar('--chart-c2'), borderRadius: 3 }] },
      options: base(false, false),
    }
    return { sales, receipts, imports }
  }, [rows])

  if (!company) return <p className="status-msg">No companies available.</p>

  const gaps: string[] = []
  if (data) {
    const first = (ys: number[]) => (ys.length ? Math.min(...ys) : null)
    const salesFrom = first(data.years.map(y => y.year))
    const recFrom = first(data.receipts.map(r => r.year))
    const impFrom = first(data.imports.map(i => i.year))
    if (salesFrom != null && recFrom != null && recFrom > salesFrom) gaps.push(`Receivables start in ${recFrom} (sales in ${salesFrom}).`)
    if (salesFrom != null && impFrom != null && impFrom > salesFrom) gaps.push(`Imports start in ${impFrom} (sales in ${salesFrom}).`)
    if (!data.imports.length) gaps.push('No imports recorded yet.')
    if (data.imports.length && data.imports.every(i => i.value == null)) gaps.push('Import value is empty until the purchase reports are reloaded.')
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>R&amp;D — Yearly data</h2>

      {companies.length > 1 ? (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {companies.map(c => (
            <button key={c} type="button" className={`chip${c === company ? ' active' : ''}`} onClick={() => setPicked(c)}>
              {companyLabel(c)}
            </button>
          ))}
        </div>
      ) : (
        <p>
          <b>{companyLabel(company)}</b>
        </p>
      )}

      {q.isLoading ? <p className="status-msg">Loading…</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {q.isSuccess && !data ? <p className="status-msg">No yearly data for this company (it needs the R&amp;D section and no agent limit).</p> : null}

      {data ? (
        <div className="hub-grid">
          {gaps.length ? (
            <p className="sel-months-list hub-span-12" style={{ margin: 0 }}>
              {gaps.join(' ')} Earlier years fill in as the older reports are exported and loaded.
            </p>
          ) : null}

          <section className="hub-card hub-span-12">
            <div className="hub-card-hdr">
              <h3>Year by year</h3>
              <span className="hub-card-aside">net sales = invoiced less returns; return rate = returns ÷ revenue including them</span>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <SortTh label="Year" k="year" left sort={sort} onSort={onSort} />
                    <SortTh label="Net sales" k="net" sort={sort} onSort={onSort} />
                    <SortTh label="vs year before" k="vsPrev" sort={sort} onSort={onSort} />
                    <SortTh label="Returns" k="returned" sort={sort} onSort={onSort} />
                    <SortTh label="Return rate" k="rate" sort={sort} onSort={onSort} />
                    <SortTh label="Receivables (receipts)" k="receipts" sort={sort} onSort={onSort} />
                    <SortTh label="Import pieces" k="importQty" sort={sort} onSort={onSort} />
                    <SortTh label="Import value" k="importValue" sort={sort} onSort={onSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(r => (
                    <tr key={r.year}>
                      <td style={{ textAlign: 'left' }}>{r.year}</td>
                      <td>{fmt0(r.net)}</td>
                      <td style={{ color: r.vsPrev == null ? undefined : r.vsPrev >= 0 ? 'var(--grn)' : 'var(--red)' }}>{signed(r.vsPrev)}</td>
                      <td>{fmt0(r.returned)}</td>
                      <td>{pct(r.rate)}</td>
                      <td>{r.receipts == null ? '—' : fmt0(r.receipts)}</td>
                      <td>{r.importQty == null ? '—' : fmt0(r.importQty)}</td>
                      <td>{r.importValue == null ? '—' : fmt0(r.importValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {charts ? (
            <>
              <section className="hub-card hub-span-8">
                <div className="hub-card-hdr"><h3>Net sales and returns</h3></div>
                <HubChart config={charts.sales} height={240} label="Net sales and returns by year" />
              </section>
              <section className="hub-card hub-span-4">
                <div className="hub-card-hdr"><h3>Receivables</h3></div>
                <HubChart config={charts.receipts} height={240} label="Receipts by year" />
              </section>
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr"><h3>Imports (pieces)</h3></div>
                <HubChart config={charts.imports} height={200} label="Pieces imported by year" />
              </section>
            </>
          ) : null}

          <BrandMatrix
            title="Brand sales by year"
            note="net sales (invoiced less returns); the 15 biggest brands, the rest as Other"
            rows={brandSales.rows}
            years={brandSales.years}
            unit="net sales"
          />
          <BrandMatrix
            title="Brand imports by year — pieces"
            note="B8 import documents; the 15 biggest brands, the rest as Other"
            rows={brandImportQty.rows}
            years={brandImportQty.years}
            unit="pieces"
          />
          {brandImportValue.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title="Brand imports by year — value"
              note="the value on the import documents"
              rows={brandImportValue.rows}
              years={brandImportValue.years}
              unit="value"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
