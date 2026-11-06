import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HubChart } from '../../components/oversite/hub/HubChart'
import { SortTh, useSortedRows } from '../../components/rnd/sortRows'
import { BrandMatrix, COMPANY_ORDER, buildBarCharts, changeColor, pct, signed } from '../../components/rnd/yearlyShared'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { MarginNote } from '../../components/rnd/marginShared'
import { fmt0 } from '../../lib/format'
import { attachMargin, fmtPct, hasMarginData, marginOf, overallMargin } from '../../lib/grossMargin'
import { fetchYearlyMargin } from '../../lib/grossMarginApi'
import { companyLabel } from '../../lib/salesMetrics'
import {
  buildBrandMatrix,
  buildYearRows,
  fetchYearlyOverview,
} from '../../lib/yearlyOverview'
import type { LogicalCompany } from '../../types/dashboard'

/** R&D → Multi-year data: one company, year by year. Needs the R&D section module. */
export function YearlyDataPage() {
  const { t } = useLocale()
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
  // Gross margin: null for users who may not see item costs (the database decides), then no margin column or chart is shown.
  const marginQ = useQuery({
    queryKey: ['yearly-margin', company, asUser],
    queryFn: () => fetchYearlyMargin(company as string, asUser),
    enabled: !!company,
    staleTime: 10 * 60 * 1000,
  })
  const marginData = marginQ.data ?? null
  const hasM = hasMarginData(marginData?.years ?? [])
  const rows = useMemo(
    () => attachMargin(data ? buildYearRows(data) : [], marginData?.years, r => r.year, e => e.year, r => r.net),
    [data, marginData],
  )
  const overall = useMemo(() => overallMargin(marginData?.years, rows.reduce((a, r) => a + r.net, 0)), [marginData, rows])
  const { sorted, sort, onSort } = useSortedRows(
    rows,
    {
      year: r => r.year,
      net: r => r.net,
      margin: r => r.margin,
      marginPct: r => r.marginPct,
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

  const brandMargin = useMemo(
    () => buildBrandMatrix((marginData?.brands ?? []).map(b => ({ year: b.year, brand: b.brand, value: marginOf(b).margin }))),
    [marginData],
  )
  const charts = useMemo(
    () =>
      rows.length
        ? buildBarCharts(
            rows.map(r => String(r.year)),
            { net: t('rnd.col.net'), returns: t('rnd.col.returns'), receipts: t('rnd.chart.receipts'), pieces: t('rnd.chart.pieces') },
            rows,
            hasM ? { label: t('gm.chart.margin'), values: rows.map(r => r.margin) } : undefined,
          )
        : null,
    [rows, t, hasM],
  )

  if (!company) return <p className="status-msg">{t('rnd.noCompanies')}</p>

  const gaps: string[] = []
  if (data) {
    const first = (ys: number[]) => (ys.length ? Math.min(...ys) : null)
    const salesFrom = first(data.years.map(y => y.year))
    const recFrom = first(data.receipts.map(r => r.year))
    const impFrom = first(data.imports.map(i => i.year))
    if (salesFrom != null && recFrom != null && recFrom > salesFrom) gaps.push(t('rnd.gap.rec', { from: recFrom, sales: salesFrom }))
    if (salesFrom != null && impFrom != null && impFrom > salesFrom) gaps.push(t('rnd.gap.imp', { from: impFrom, sales: salesFrom }))
    if (!data.imports.length) gaps.push(t('rnd.gap.noImports'))
    if (data.imports.length && data.imports.every(i => i.value == null)) gaps.push(t('rnd.gap.noImpValue'))
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('rnd.multi.title')}</h2>

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

      {q.isLoading ? <p className="status-msg">{t('common.loading')}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {q.isSuccess && !data ? <p className="status-msg">{t('rnd.multi.noData')}</p> : null}

      {data ? (
        <div className="hub-grid">
          {gaps.length ? (
            <p className="sel-months-list hub-span-12" style={{ margin: 0 }}>
              {gaps.join(' ')} {t('rnd.gap.tail')}
            </p>
          ) : null}

          <section className="hub-card hub-span-12">
            <div className="hub-card-hdr">
              <h3>{t('rnd.byYear')}</h3>
              <span className="hub-card-aside">{t('rnd.note.net')}</span>
            </div>
            <MarginNote visible={hasM} coverage={overall.coverage} />
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <SortTh label={t('rnd.col.year')} k="year" left sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.net')} k="net" sort={sort} onSort={onSort} />
                    {hasM ? <SortTh label={t('gm.col.margin')} k="margin" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
                    {hasM ? <SortTh label={t('gm.col.marginPct')} k="marginPct" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
                    <SortTh label={t('rnd.col.vsYear')} k="vsPrev" sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.returns')} k="returned" sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.rate')} k="rate" sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.receipts')} k="receipts" sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.impQty')} k="importQty" sort={sort} onSort={onSort} />
                    <SortTh label={t('rnd.col.impValue')} k="importValue" sort={sort} onSort={onSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(r => (
                    <tr key={r.year}>
                      <td style={{ textAlign: 'start' }}>{r.year}</td>
                      <td>{fmt0(r.net)}</td>
                      {hasM ? <td title={r.coverage == null ? undefined : t('gm.coverage', { pct: Math.round(r.coverage * 100) })}>{r.margin == null ? '—' : fmt0(r.margin)}</td> : null}
                      {hasM ? <td>{fmtPct(r.marginPct)}</td> : null}
                      <td style={{ color: changeColor(r.vsPrev) }}>{signed(r.vsPrev)}</td>
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
                <div className="hub-card-hdr"><h3>{t('rnd.chart.sales')}</h3></div>
                <HubChart config={charts.sales} height={240} label={t('rnd.chart.aria.salesYears')} />
              </section>
              <section className="hub-card hub-span-4">
                <div className="hub-card-hdr"><h3>{t('rnd.chart.receivables')}</h3></div>
                <HubChart config={charts.receipts} height={240} label={t('rnd.chart.aria.receiptsYears')} />
              </section>
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr"><h3>{t('rnd.chart.imports')}</h3></div>
                <HubChart config={charts.imports} height={200} label={t('rnd.chart.aria.importsYears')} />
              </section>
            </>
          ) : null}

          <BrandMatrix
            title={t('rnd.brand.salesYears')}
            note={t('rnd.brand.salesYearsNote')}
            rows={brandSales.rows}
            years={brandSales.years}
            unit={t('rnd.unit.net')}
          />
          <BrandMatrix
            title={t('rnd.brand.impQtyYears')}
            note={t('rnd.brand.impNote')}
            rows={brandImportQty.rows}
            years={brandImportQty.years}
            unit={t('rnd.unit.pieces')}
          />
          {hasM && brandMargin.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title={t('gm.brand.titleYears')}
              note={t('gm.brand.note')}
              rows={brandMargin.rows}
              years={brandMargin.years}
              unit={t('gm.unit.margin')}
            />
          ) : null}
          {brandImportValue.rows.some(r => r.total !== 0) ? (
            <BrandMatrix
              title={t('rnd.brand.impValueYears')}
              note={t('rnd.brand.impValueNote')}
              rows={brandImportValue.rows}
              years={brandImportValue.years}
              unit={t('rnd.unit.value')}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
