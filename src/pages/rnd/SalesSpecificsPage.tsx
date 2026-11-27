import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { useQuery } from '@tanstack/react-query'
import { cssVar, HubChart } from '../../components/oversite/hub/HubChart'
import { PlanHeader } from '../../components/rnd/PlanHeader'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { DEAL_RANGES, fetchDealsDetail, fetchDealsPerRange, monthLabel, type DealsPerRange } from '../../lib/dealsPerRange'
import { csvCell, downloadCSV } from '../../lib/csvExport'
import { fmt0, fmtDateIso } from '../../lib/format'
import type { LogicalCompany } from '../../types/dashboard'
import './SalesSpecificsPage.css'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'gold']
const FIXED = ['month', 'quarter', 'd90', 'd365'] as const

interface Picked {
  bucket: number
  period: string
  periodLabel: string
}

/** The invoices counted in one cell of the table. */
function DealsModal({ company, picked, asUser, onClose }: { company: LogicalCompany; picked: Picked; asUser: string | null; onClose: () => void }) {
  const { t } = useLocale()
  const q = useQuery({
    queryKey: ['deals-detail', company, picked.bucket, picked.period, asUser],
    queryFn: () => fetchDealsDetail(company, picked.bucket, picked.period, asUser),
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const range = DEAL_RANGES.find(r => r.bucket === picked.bucket)?.label ?? ''
  const rows = q.data?.rows ?? []
  const sum = rows.reduce((a, r) => a + r.total, 0)
  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal" style={{ maxWidth: 900 }} role="dialog" aria-modal="true" aria-label={`${range} · ${picked.periodLabel}`}>
        <div className="debt-modal-hdr">
          <span>
            {t('ss.detail.title')}: {range} · {picked.periodLabel}
          </span>
          <div className="debt-modal-hdr-actions">
            <button type="button" className="debt-modal-close" onClick={onClose}>
              {t('oc.close')} ✕
            </button>
          </div>
        </div>
        <div className="debt-modal-body">
          {q.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
          {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
          {q.data ? (
            <>
              <p style={{ margin: '0 0 8px' }}>
                {t('ss.detail.count', { n: fmt0(q.data.total), sum: fmt0(sum) })}
                {q.data.total > rows.length ? ` · ${t('ss.detail.limited', { n: fmt0(rows.length) })}` : ''}
              </p>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>{t('ss.col.date')}</th>
                      <th>{t('ss.col.doc')}</th>
                      <th style={{ textAlign: 'start' }}>{t('ss.col.client')}</th>
                      <th>{t('ss.col.lines')}</th>
                      <th>{t('ss.col.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={`${r.docType}|${r.docNum}`}>
                        <td>{fmtDateIso(r.date)}</td>
                        <td>
                          {r.docType}/{r.docNum}
                        </td>
                        <td style={{ textAlign: 'start' }}>
                          {r.clientName ?? ''} <small style={{ opacity: 0.6 }}>{r.clientID ?? ''}</small>
                        </td>
                        <td>{r.lines}</td>
                        <td>{fmt0(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Change against last year as text + direction. */
function change(cur: number, prev: number, newLabel: string): { text: string; cls: string } {
  if (!prev) return cur ? { text: newLabel, cls: 'up' } : { text: '–', cls: 'flat' }
  const r = Math.round(((cur - prev) / prev) * 100)
  if (r === 0) return { text: '0%', cls: 'flat' }
  return { text: `${r > 0 ? '+' : ''}${r}%`, cls: r > 0 ? 'up' : 'down' }
}

/** Invoices per month: this year against last year, for all ranges or one range. */
function TrendChart({ data }: { data: DealsPerRange }) {
  const { t, monthNames } = useLocale()
  const [bucket, setBucket] = useState(0) // 0 = all ranges
  const year = Number(data.asOf.slice(0, 4))
  const curMonth = Number(data.asOf.slice(5, 7))
  const config = useMemo<ChartConfiguration>(() => {
    const byYm = new Map<string, number>()
    for (const r of data.trend) if (!bucket || r.bucket === bucket) byYm.set(r.ym, (byYm.get(r.ym) ?? 0) + r.n)
    const series = (y: number, upTo: number) =>
      Array.from({ length: 12 }, (_, i) => (i + 1 <= upTo ? (byYm.get(`${y}-${String(i + 1).padStart(2, '0')}`) ?? 0) : null))
    // Linear trend over completed months only (this year's running month is partial and would drag the line down).
    const fit = (vals: Array<number | null>, done: number, span: number): Array<number | null> => {
      const pts = vals.slice(0, done).map((v, i) => ({ x: i, y: v ?? 0 }))
      if (pts.length < 2) return Array(12).fill(null)
      const mx = pts.reduce((a, q) => a + q.x, 0) / pts.length
      const my = pts.reduce((a, q) => a + q.y, 0) / pts.length
      const sxx = pts.reduce((a, q) => a + (q.x - mx) ** 2, 0)
      const slope = sxx ? pts.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / sxx : 0
      return Array.from({ length: 12 }, (_, i) => (i + 1 <= span ? Math.max(0, my + slope * (i - mx)) : null))
    }
    const cur = series(year, curMonth)
    const prev = series(year - 1, 12)
    const trend = fit(cur, curMonth - 1, curMonth)
    const trendPrev = fit(prev, 12, 12)
    const acc = cssVar('--acc', '#2563eb')
    const muted = cssVar('--muted', '#8e8e93')
    const txt = cssVar('--txt', '#2c2c2e')
    return {
      type: 'line',
      data: {
        labels: monthNames.length === 12 ? monthNames : Array.from({ length: 12 }, (_, i) => String(i + 1)),
        datasets: [
          { label: String(year), data: cur, borderColor: acc, backgroundColor: acc, borderWidth: 2.5, tension: 0.25, pointRadius: 3 },
          { label: t('ss.chart.trend', { y: year }), data: trend, borderColor: acc, backgroundColor: acc, borderWidth: 1.5, borderDash: [2, 3], pointRadius: 0, tension: 0 },
          { label: String(year - 1), data: prev, borderColor: muted, backgroundColor: muted, borderWidth: 2, borderDash: [6, 4], tension: 0.25, pointRadius: 2 },
          { label: t('ss.chart.trend', { y: year - 1 }), data: trendPrev, borderColor: muted, backgroundColor: muted, borderWidth: 1.5, borderDash: [2, 3], pointRadius: 0, tension: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: txt } } },
        scales: {
          x: { ticks: { color: txt }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: txt, precision: 0 }, grid: { color: 'rgba(127,127,127,0.2)' } },
        },
      },
    }
  }, [data.trend, bucket, year, curMonth, monthNames, t])
  return (
    <div className="ss-chart">
      <h3 style={{ margin: '4px 0' }}>{t('ss.chart.title', { cur: year, prev: year - 1 })}</h3>
      <div className="ss-chart-bar">
        <label>
          {t('ss.chart.range')}{' '}
          <select value={bucket} onChange={e => setBucket(Number(e.target.value))}>
            <option value={0}>{t('ss.chart.all')}</option>
            {DEAL_RANGES.map(r => (
              <option key={r.bucket} value={r.bucket}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <HubChart config={config} height={300} label={t('ss.chart.alt')} />
      <p className="ss-note">{t('ss.chart.note')}</p>
    </div>
  )
}

/** R&D → Sales specifics: Deals per Range (invoices issued, positive totals only) by invoice-total range and period. */
export function SalesSpecificsPage() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [pickedCo, setPickedCo] = useState<LogicalCompany | null>(null)
  const company = (pickedCo && companies.includes(pickedCo) ? pickedCo : companies[0]) as LogicalCompany | undefined
  const [picked, setPicked] = useState<Picked | null>(null)

  const q = useQuery({
    queryKey: ['deals-per-range', company, asUser],
    queryFn: () => fetchDealsPerRange(company as string, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })

  const fixedLabel: Record<(typeof FIXED)[number], string> = {
    month: t('ss.p.month'),
    quarter: t('ss.p.quarter'),
    d90: t('ss.p.d90'),
    d365: t('ss.p.d365'),
  }
  const monthCols = useMemo(() => (q.data?.months ?? []).map(m => ({ key: `m:${m}`, label: monthLabel(m) })), [q.data?.months])

  const cell = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of q.data?.counts ?? []) m.set(`${c.bucket}|${c.key}`, c.n)
    return m
  }, [q.data?.counts])
  const n = (bucket: number, key: string) => cell.get(`${bucket}|${key}`) ?? 0
  const colTotal = (key: string) => DEAL_RANGES.reduce((a, r) => a + n(r.bucket, key), 0)

  if (!company) return <p className="status-msg">{t('oc.noData')}</p>

  const exportCsv = () => {
    const cols: string[] = [t('ss.range')]
    for (const k of FIXED) cols.push(`${fixedLabel[k]} - ${t('ss.col.deals')}`, `${fixedLabel[k]} - ${t('ss.col.pct')}`, `${fixedLabel[k]} - ${t('ss.col.vsly')}`, `${fixedLabel[k]} - ${t('ss.csv.lastYear')}`)
    for (const c of monthCols) cols.push(c.label)
    const line = (label: string, get: (key: string) => number) => {
      const out: string[] = [label]
      for (const k of FIXED) {
        const v = get(k)
        const py = get(`${k}_py`)
        const tot = colTotal(k)
        out.push(String(v), tot ? ((v / tot) * 100).toFixed(1) : '', py ? String(Math.round(((v - py) / py) * 100)) : '', String(py))
      }
      for (const c of monthCols) out.push(String(get(c.key)))
      return out
    }
    const rows = DEAL_RANGES.map(r => line(r.label, key => n(r.bucket, key)))
    rows.push(line(t('ss.total'), key => colTotal(key)))
    downloadCSV([cols, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'), `deals_per_range_${company}_${q.data?.asOf ?? ''}.csv`)
  }
  const open = (bucket: number, period: string, periodLabel: string) => setPicked({ bucket, period, periodLabel })
  const newLabel = t('ss.vsly.new')
  const countCell = (bucket: number, key: string, label: string) => {
    const v = n(bucket, key)
    return v ? (
      <button type="button" className="pt-link" onClick={() => open(bucket, key, label)}>
        {fmt0(v)}
      </button>
    ) : (
      <span style={{ opacity: 0.4 }}>0</span>
    )
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <PlanHeader title={t('ss.title')} companyLabelText={t('oc.company')} companies={companies} company={company} onCompany={setPickedCo} buttons={[]} />
      <h3 style={{ margin: '4px 0' }}>{t('ss.deals.title')}</h3>
      <p style={{ opacity: 0.8, maxWidth: 900 }}>{t('ss.deals.intro')}</p>
      {q.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      {q.data === null ? <p className="status-msg">{t('oc.noData')}</p> : null}
      {q.data ? (
        <>
          <div className="tw ss-deals">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2} className="ss-first">
                    {t('ss.range')}
                  </th>
                  {FIXED.map(k => (
                    <th key={k} colSpan={3} className="ss-grp">
                      {fixedLabel[k]}
                    </th>
                  ))}
                  {monthCols.map(c => (
                    <th key={c.key} rowSpan={2} className="ss-month">
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {FIXED.map(k => (
                    <Fragment key={k}>
                      <th className="ss-grp">{t('ss.col.deals')}</th>
                      <th>{t('ss.col.pct')}</th>
                      <th>{t('ss.col.vsly')}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEAL_RANGES.map(r => (
                  <tr key={r.bucket}>
                    <th scope="row" style={{ textAlign: 'start' }}>
                      {r.label}
                    </th>
                    {FIXED.map(k => {
                      const tot = colTotal(k)
                      const ch = change(n(r.bucket, k), n(r.bucket, `${k}_py`), newLabel)
                      return (
                        <Fragment key={k}>
                          <td className="ss-grp">{countCell(r.bucket, k, fixedLabel[k])}</td>
                          <td className="ss-pct">{tot ? `${((n(r.bucket, k) / tot) * 100).toFixed(1)}%` : '–'}</td>
                          <td className={`ss-chg ${ch.cls}`}>{ch.text}</td>
                        </Fragment>
                      )
                    })}
                    {monthCols.map(c => (
                      <td key={c.key} className="ss-month">
                        {countCell(r.bucket, c.key, c.label)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="ss-total">
                  <th scope="row" style={{ textAlign: 'start' }}>
                    {t('ss.total')}
                  </th>
                  {FIXED.map(k => {
                    const tot = colTotal(k)
                    const ch = change(tot, colTotal(`${k}_py`), newLabel)
                    return (
                      <Fragment key={k}>
                        <td className="ss-grp">{fmt0(tot)}</td>
                        <td className="ss-pct">{tot ? '100%' : '–'}</td>
                        <td className={`ss-chg ${ch.cls}`}>{ch.text}</td>
                      </Fragment>
                    )
                  })}
                  {monthCols.map(c => (
                    <td key={c.key} className="ss-month">
                      {fmt0(colTotal(c.key))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="dl-bar">
            <button type="button" className="dl-btn" onClick={exportCsv}>
              {t('sales.exportCsv')}
            </button>
          </div>
          <p className="ss-note">{t('ss.vsly.note')}</p>
          <TrendChart data={q.data} />
        </>
      ) : null}
      {picked ? <DealsModal company={company} picked={picked} asUser={asUser} onClose={() => setPicked(null)} /> : null}
    </div>
  )
}
