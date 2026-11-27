import { Fragment, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { cssVar, HubChart } from '../oversite/hub/HubChart'
import { useLocale } from '../../context/LocaleContext'
import { DEAL_RANGES, monthLabel, type DealsPerRange } from '../../lib/dealsPerRange'
import { csvCell, downloadCSV } from '../../lib/csvExport'
import { fmt0 } from '../../lib/format'
import '../../pages/rnd/SalesSpecificsPage.css'

export const DEALS_FIXED = ['month', 'quarter', 'd90', 'd365'] as const

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

/**
 * Deals per Range for one set of invoices: the table (this month / quarter / last 90 / last 365 days, % of total,
 * change vs last year, last 12 months), CSV export and the this-year-vs-last-year chart.
 * Used by Sales specifics (whole company) and the client card (one client or chain).
 */
export function DealsPerRangeView({
  data,
  csvName,
  onCell,
}: {
  data: DealsPerRange
  csvName: string
  /** Makes the counts clickable (Sales specifics opens the invoice list). */
  onCell?: (bucket: number, key: string, label: string) => void
}) {
  const { t } = useLocale()
  const fixedLabel: Record<(typeof DEALS_FIXED)[number], string> = {
    month: t('ss.p.month'),
    quarter: t('ss.p.quarter'),
    d90: t('ss.p.d90'),
    d365: t('ss.p.d365'),
  }
  const monthCols = useMemo(() => data.months.map(m => ({ key: `m:${m}`, label: monthLabel(m) })), [data.months])
  const cell = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of data.counts) m.set(`${c.bucket}|${c.key}`, c.n)
    return m
  }, [data.counts])
  const n = (bucket: number, key: string) => cell.get(`${bucket}|${key}`) ?? 0
  const colTotal = (key: string) => DEAL_RANGES.reduce((a, r) => a + n(r.bucket, key), 0)
  const newLabel = t('ss.vsly.new')

  const exportCsv = () => {
    const cols: string[] = [t('ss.range')]
    for (const k of DEALS_FIXED) cols.push(`${fixedLabel[k]} - ${t('ss.col.deals')}`, `${fixedLabel[k]} - ${t('ss.col.pct')}`, `${fixedLabel[k]} - ${t('ss.col.vsly')}`, `${fixedLabel[k]} - ${t('ss.csv.lastYear')}`)
    for (const c of monthCols) cols.push(c.label)
    const line = (label: string, get: (key: string) => number) => {
      const out: string[] = [label]
      for (const k of DEALS_FIXED) {
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
    downloadCSV([cols, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'), `${csvName}_${data.asOf}.csv`)
  }

  const countCell = (bucket: number, key: string, label: string) => {
    const v = n(bucket, key)
    if (!v) return <span style={{ opacity: 0.4 }}>0</span>
    return onCell ? (
      <button type="button" className="pt-link" onClick={() => onCell(bucket, key, label)}>
        {fmt0(v)}
      </button>
    ) : (
      <span>{fmt0(v)}</span>
    )
  }

  return (
    <>
      <div className="tw ss-deals">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="ss-first">
                {t('ss.range')}
              </th>
              {DEALS_FIXED.map(k => (
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
              {DEALS_FIXED.map(k => (
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
                {DEALS_FIXED.map(k => {
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
              {DEALS_FIXED.map(k => {
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
      <TrendChart data={data} />
    </>
  )
}
