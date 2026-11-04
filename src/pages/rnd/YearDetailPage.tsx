import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HubChart } from '../../components/oversite/hub/HubChart'
import { BrandMatrix, COMPANY_ORDER, buildBarCharts, changeColor, pct, signed } from '../../components/rnd/yearlyShared'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt0, MONTH_NAMES } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import { buildMonthRows, buildYearTotal, fetchYearlyDetail, pickableYears, type MonthRow } from '../../lib/yearlyDetail'
import { buildBrandMatrix, fetchYearlyOverview } from '../../lib/yearlyOverview'
import type { LogicalCompany } from '../../types/dashboard'

const monthLabel = (m: number) => MONTH_NAMES[m - 1] ?? String(m)
const orDash = (v: number | null) => (v == null ? '—' : fmt0(v))

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'grn' | 'amber' }) {
  return (
    <section className="hub-card hub-tile-kpi hub-span-3">
      <span className="hub-kpi-lbl">{label}</span>
      <div className="hub-kpi-main">
        <span className={`hub-kpi-val${tone ? ` ${tone}` : ''}`}>{value}</span>
      </div>
      {sub ? <span className="hub-kpi-sub">{sub}</span> : null}
    </section>
  )
}

/** R&D → Yearly data: one company and one year: the year's total, then month by month. Needs the R&D section module. */
export function YearDetailPage() {
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [pickedCompany, setPickedCompany] = useState<LogicalCompany | null>(null)
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const company = (pickedCompany && companies.includes(pickedCompany) ? pickedCompany : companies[0]) as LogicalCompany | undefined

  // The years that have anything come from the multi-year overview (same cache as that page).
  const overviewQ = useQuery({
    queryKey: ['yearly-overview', company, asUser],
    queryFn: () => fetchYearlyOverview(company as string, asUser),
    enabled: !!company,
    staleTime: 10 * 60 * 1000,
  })
  const years = useMemo(() => (overviewQ.data ? pickableYears(overviewQ.data) : []), [overviewQ.data])
  const year = pickedYear != null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null)

  const q = useQuery({
    queryKey: ['yearly-detail', company, year, asUser],
    queryFn: () => fetchYearlyDetail(company as string, year as number, asUser),
    enabled: !!company && year != null,
    staleTime: 10 * 60 * 1000,
  })
  const data = q.data
  const months = useMemo(() => (data ? buildMonthRows(data) : []), [data])
  const total = useMemo(() => (data ? buildYearTotal(data) : null), [data])

  // Brand tables: one column for the whole year, and one column per month.
  const brandSalesYear = useMemo(() => buildBrandMatrix((data?.brandSales ?? []).map(b => ({ year: 0, brand: b.brand, value: b.net }))), [data])
  const brandSalesMonths = useMemo(() => buildBrandMatrix((data?.brandSales ?? []).map(b => ({ year: b.month, brand: b.brand, value: b.net }))), [data])
  const brandQtyYear = useMemo(() => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: 0, brand: b.brand, value: b.qty }))), [data])
  const brandQtyMonths = useMemo(() => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: b.month, brand: b.brand, value: b.qty }))), [data])
  const brandValueYear = useMemo(() => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: 0, brand: b.brand, value: b.value }))), [data])
  const brandValueMonths = useMemo(() => buildBrandMatrix((data?.brandImports ?? []).map(b => ({ year: b.month, brand: b.brand, value: b.value }))), [data])

  const charts = useMemo(() => (months.length ? buildBarCharts(months.map(m => monthLabel(m.month)), months) : null), [months])

  if (!company) return <p className="status-msg">No companies available.</p>

  const hasAnything = !!data && (data.sales.length > 0 || data.receipts.length > 0 || data.imports.length > 0)
  const hasImportValue = !!total && total.importValue != null
  const yearLabel = (_: number) => String(year)

  const row = (r: MonthRow, label: string, strong = false) => (
    <tr key={r.month}>
      <td style={{ textAlign: 'left' }}>{strong ? <b>{label}</b> : label}</td>
      <td>{strong ? <b>{fmt0(r.net)}</b> : fmt0(r.net)}</td>
      <td style={{ color: changeColor(r.vsPrev) }}>{signed(r.vsPrev)}</td>
      <td>{fmt0(r.returned)}</td>
      <td>{pct(r.rate)}</td>
      <td>{orDash(r.receipts)}</td>
      <td>{orDash(r.importQty)}</td>
      <td>{orDash(r.importValue)}</td>
    </tr>
  )

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>R&amp;D — Yearly data</h2>

      {companies.length > 1 ? (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {companies.map(c => (
            <button key={c} type="button" className={`chip${c === company ? ' active' : ''}`} onClick={() => setPickedCompany(c)}>
              {companyLabel(c)}
            </button>
          ))}
        </div>
      ) : (
        <p>
          <b>{companyLabel(company)}</b>
        </p>
      )}

      {years.length ? (
        <div className="chip-row" style={{ marginBottom: 12 }} role="group" aria-label="Year">
          {years.map(y => (
            <button key={y} type="button" className={`chip${y === year ? ' active' : ''}`} onClick={() => setPickedYear(y)}>
              {y}
            </button>
          ))}
        </div>
      ) : null}

      {overviewQ.isLoading || q.isLoading ? <p className="status-msg">Loading…</p> : null}
      {overviewQ.error ? <p className="status-msg error">{(overviewQ.error as Error).message}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {overviewQ.isSuccess && !overviewQ.data ? (
        <p className="status-msg">No yearly data for this company (it needs the R&amp;D section and no agent limit).</p>
      ) : null}
      {overviewQ.isSuccess && overviewQ.data && !years.length ? <p className="status-msg">Nothing recorded yet for this company.</p> : null}
      {q.isSuccess && !data && year != null ? <p className="status-msg">No data for {year}.</p> : null}

      {data && total ? (
        <div className="hub-grid">
          {!hasAnything ? <p className="status-msg hub-span-12">Nothing recorded for {year}.</p> : null}

          <h3 className="hub-span-12" style={{ margin: '4px 0 0' }}>{year} — total</h3>
          <Kpi label="Net sales" value={fmt0(total.net)} sub="invoiced less returns" />
          <Kpi label="Returns" value={fmt0(total.returned)} sub={`return rate ${pct(total.rate)}`} />
          <Kpi label="Receivables (receipts)" value={orDash(total.receipts)} sub={total.receipts == null ? 'none recorded' : 'collected in the year'} />
          <Kpi
            label="Import pieces"
            value={orDash(total.importQty)}
            sub={total.importQty == null ? 'none recorded' : `${fmt0(total.importDocs ?? 0)} documents${hasImportValue ? ` · value ${fmt0(total.importValue as number)}` : ''}`}
          />

          <BrandMatrix
            title={`Brand sales ${year}`}
            note="net sales (invoiced less returns); the 15 biggest brands, the rest as Other"
            rows={brandSalesYear.rows}
            years={[0]}
            unit="net sales"
            colLabel={yearLabel}
          />
          <BrandMatrix
            title={`Brand imports ${year} — pieces`}
            note="B8 import documents; the 15 biggest brands, the rest as Other"
            rows={brandQtyYear.rows}
            years={[0]}
            unit="pieces"
            colLabel={yearLabel}
          />
          {brandValueYear.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title={`Brand imports ${year} — value`}
              note="the value on the import documents"
              rows={brandValueYear.rows}
              years={[0]}
              unit="value"
              colLabel={yearLabel}
            />
          ) : null}

          <h3 className="hub-span-12" style={{ margin: '16px 0 0' }}>{year} — month by month</h3>

          {charts ? (
            <>
              <section className="hub-card hub-span-8">
                <div className="hub-card-hdr"><h3>Net sales and returns</h3></div>
                <HubChart config={charts.sales} height={240} label={`Net sales and returns by month, ${year}`} />
              </section>
              <section className="hub-card hub-span-4">
                <div className="hub-card-hdr"><h3>Receivables</h3></div>
                <HubChart config={charts.receipts} height={240} label={`Receipts by month, ${year}`} />
              </section>
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr"><h3>Imports (pieces)</h3></div>
                <HubChart config={charts.imports} height={200} label={`Pieces imported by month, ${year}`} />
              </section>
            </>
          ) : null}

          <section className="hub-card hub-span-12">
            <div className="hub-card-hdr">
              <h3>Month by month</h3>
              <span className="hub-card-aside">net sales = invoiced less returns; return rate = returns ÷ revenue including them</span>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Month</th>
                    <th>Net sales</th>
                    <th>vs month before</th>
                    <th>Returns</th>
                    <th>Return rate</th>
                    <th>Receivables (receipts)</th>
                    <th>Import pieces</th>
                    <th>Import value</th>
                  </tr>
                </thead>
                <tbody>{months.map(m => row(m, monthLabel(m.month)))}</tbody>
                <tfoot>{row(total, `Total ${year}`, true)}</tfoot>
              </table>
            </div>
          </section>

          <BrandMatrix
            title="Brand sales by month"
            note="net sales (invoiced less returns); the 15 biggest brands of the year, the rest as Other"
            rows={brandSalesMonths.rows}
            years={brandSalesMonths.years}
            unit="net sales"
            colLabel={monthLabel}
          />
          <BrandMatrix
            title="Brand imports by month — pieces"
            note="B8 import documents; the 15 biggest brands of the year, the rest as Other"
            rows={brandQtyMonths.rows}
            years={brandQtyMonths.years}
            unit="pieces"
            colLabel={monthLabel}
          />
          {brandValueMonths.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title="Brand imports by month — value"
              note="the value on the import documents"
              rows={brandValueMonths.rows}
              years={brandValueMonths.years}
              unit="value"
              colLabel={monthLabel}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
