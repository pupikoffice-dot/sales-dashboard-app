import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HubChart } from '../../components/oversite/hub/HubChart'
import { BrandMatrix, COMPANY_ORDER, buildBarCharts, changeColor, pct, signed } from '../../components/rnd/yearlyShared'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import { buildMonthRows, buildYearTotal, fetchYearlyDetail, pickableYears, type MonthRow } from '../../lib/yearlyDetail'
import { buildBrandMatrix, fetchYearlyOverview } from '../../lib/yearlyOverview'
import type { LogicalCompany } from '../../types/dashboard'

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
  const { t, monthNames } = useLocale()
  const monthLabel = (m: number) => monthNames[m - 1] ?? String(m)
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

  const charts = useMemo(() => (months.length ? buildBarCharts(months.map(m => monthLabel(m.month)), { net: t('rnd.col.net'), returns: t('rnd.col.returns'), receipts: t('rnd.chart.receipts'), pieces: t('rnd.chart.pieces') }, months) : null),
    [months, t, monthNames])

  if (!company) return <p className="status-msg">{t('rnd.noCompanies')}</p>

  const hasAnything = !!data && (data.sales.length > 0 || data.receipts.length > 0 || data.imports.length > 0)
  const hasImportValue = !!total && total.importValue != null
  const yearLabel = (_: number) => String(year)

  const row = (r: MonthRow, label: string, strong = false) => (
    <tr key={r.month}>
      <td style={{ textAlign: 'start' }}>{strong ? <b>{label}</b> : label}</td>
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
      <h2 style={{ marginTop: 0 }}>{t('rnd.year.title')}</h2>

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
        <div className="chip-row" style={{ marginBottom: 12 }} role="group" aria-label={t('rnd.year.pick')}>
          {years.map(y => (
            <button key={y} type="button" className={`chip${y === year ? ' active' : ''}`} onClick={() => setPickedYear(y)}>
              {y}
            </button>
          ))}
        </div>
      ) : null}

      {overviewQ.isLoading || q.isLoading ? <p className="status-msg">{t('common.loading')}</p> : null}
      {overviewQ.error ? <p className="status-msg error">{(overviewQ.error as Error).message}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {overviewQ.isSuccess && !overviewQ.data ? (
        <p className="status-msg">{t('rnd.year.noData')}</p>
      ) : null}
      {overviewQ.isSuccess && overviewQ.data && !years.length ? <p className="status-msg">{t('rnd.year.nothingCompany')}</p> : null}
      {q.isSuccess && !data && year != null ? <p className="status-msg">{t('rnd.year.noDataYear', { year: year ?? '' })}</p> : null}

      {data && total ? (
        <div className="hub-grid">
          {!hasAnything ? <p className="status-msg hub-span-12">{t('rnd.year.nothingYear', { year: year ?? '' })}</p> : null}

          <h3 className="hub-span-12" style={{ margin: '4px 0 0' }}>{t('rnd.year.total', { year: year ?? '' })}</h3>
          <Kpi label={t('rnd.kpi.net')} value={fmt0(total.net)} sub={t('rnd.kpi.netSub')} />
          <Kpi label={t('rnd.kpi.returns')} value={fmt0(total.returned)} sub={t('rnd.kpi.returnsSub', { rate: pct(total.rate) })} />
          <Kpi label={t('rnd.kpi.receipts')} value={orDash(total.receipts)} sub={total.receipts == null ? t('rnd.kpi.none') : t('rnd.kpi.receiptsSub')} />
          <Kpi
            label={t('rnd.kpi.imports')}
            value={orDash(total.importQty)}
            sub={
              total.importQty == null
                ? t('rnd.kpi.none')
                : t('rnd.kpi.importsSub', { docs: fmt0(total.importDocs ?? 0) }) + (hasImportValue ? t('rnd.kpi.importsValue', { value: fmt0(total.importValue as number) }) : '')
            }
          />

          <BrandMatrix
            title={t('rnd.brand.salesYear', { year: year ?? '' })}
            note={t('rnd.brand.salesYearsNote')}
            rows={brandSalesYear.rows}
            years={[0]}
            unit={t('rnd.unit.net')}
            colLabel={yearLabel}
          />
          <BrandMatrix
            title={t('rnd.brand.impQtyYear', { year: year ?? '' })}
            note={t('rnd.brand.impNote')}
            rows={brandQtyYear.rows}
            years={[0]}
            unit={t('rnd.unit.pieces')}
            colLabel={yearLabel}
          />
          {brandValueYear.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title={t('rnd.brand.impValueYear', { year: year ?? '' })}
              note={t('rnd.brand.impValueNote')}
              rows={brandValueYear.rows}
              years={[0]}
              unit={t('rnd.unit.value')}
              colLabel={yearLabel}
            />
          ) : null}

          <h3 className="hub-span-12" style={{ margin: '16px 0 0' }}>{t('rnd.year.months', { year: year ?? '' })}</h3>

          {charts ? (
            <>
              <section className="hub-card hub-span-8">
                <div className="hub-card-hdr"><h3>{t('rnd.chart.sales')}</h3></div>
                <HubChart config={charts.sales} height={240} label={t('rnd.chart.aria.salesMonths', { year: year ?? '' })} />
              </section>
              <section className="hub-card hub-span-4">
                <div className="hub-card-hdr"><h3>{t('rnd.chart.receivables')}</h3></div>
                <HubChart config={charts.receipts} height={240} label={t('rnd.chart.aria.receiptsMonths', { year: year ?? '' })} />
              </section>
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr"><h3>{t('rnd.chart.imports')}</h3></div>
                <HubChart config={charts.imports} height={200} label={t('rnd.chart.aria.importsMonths', { year: year ?? '' })} />
              </section>
            </>
          ) : null}

          <section className="hub-card hub-span-12">
            <div className="hub-card-hdr">
              <h3>{t('rnd.byMonth')}</h3>
              <span className="hub-card-aside">{t('rnd.note.net')}</span>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'start' }}>{t('rnd.col.month')}</th>
                    <th>{t('rnd.col.net')}</th>
                    <th>{t('rnd.col.vsMonth')}</th>
                    <th>{t('rnd.col.returns')}</th>
                    <th>{t('rnd.col.rate')}</th>
                    <th>{t('rnd.col.receipts')}</th>
                    <th>{t('rnd.col.impQty')}</th>
                    <th>{t('rnd.col.impValue')}</th>
                  </tr>
                </thead>
                <tbody>{months.map(m => row(m, monthLabel(m.month)))}</tbody>
                <tfoot>{row(total, t('rnd.year.totalRow', { year: year ?? '' }), true)}</tfoot>
              </table>
            </div>
          </section>

          <BrandMatrix
            title={t('rnd.brand.salesMonths')}
            note={t('rnd.brand.monthsNote')}
            rows={brandSalesMonths.rows}
            years={brandSalesMonths.years}
            unit={t('rnd.unit.net')}
            colLabel={monthLabel}
          />
          <BrandMatrix
            title={t('rnd.brand.impQtyMonths')}
            note={t('rnd.brand.impMonthsNote')}
            rows={brandQtyMonths.rows}
            years={brandQtyMonths.years}
            unit={t('rnd.unit.pieces')}
            colLabel={monthLabel}
          />
          {brandValueMonths.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title={t('rnd.brand.impValueMonths')}
              note={t('rnd.brand.impValueNote')}
              rows={brandValueMonths.rows}
              years={brandValueMonths.years}
              unit={t('rnd.unit.value')}
              colLabel={monthLabel}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
