import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { fmt0 } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import {
  availableYears,
  combinePicks,
  linearTrend,
  monthHasArrived,
  receiptsByMonth,
  salesByDay,
  salesByMonth,
  summarize,
  totalsByYear,
} from '../../lib/monthlyData'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v]
}

/** R&D → Monthly data: pick a company, years and months; see sales and receipts as graphs. Super admin only. */
export function MonthlyDataPage() {
  const { access } = useDashboardAccess()
  const { allRows, data, isLoading, error } = useDashboardData()

  const companies = useMemo(
    () => COMPANY_ORDER.filter(c => access?.companies.includes(c)),
    [access?.companies],
  )
  const [company, setCompany] = useState<LogicalCompany | null>(null)
  const activeCompany = company && companies.includes(company) ? company : companies[0] ?? null

  const receipts = activeCompany ? data?.receiptsMonthly?.[activeCompany] : undefined
  const years = useMemo(
    () => (activeCompany ? availableYears(allRows, receipts, activeCompany) : []),
    [allRows, receipts, activeCompany],
  )

  const [pickedYears, setPickedYears] = useState<number[] | null>(null)
  const [pickedMonths, setPickedMonths] = useState<number[] | null>(null)
  // Start with every year the company has, all months; changing company starts over.
  useEffect(() => {
    setPickedYears(null)
    setPickedMonths(null)
  }, [activeCompany])
  const yearsSel = useMemo(
    () => (pickedYears ?? years).filter(y => years.includes(y)),
    [pickedYears, years],
  )
  const monthsSel = useMemo(() => pickedMonths ?? MONTH_SHORT.map((_, i) => i + 1), [pickedMonths])

  const picks = useMemo(() => combinePicks(yearsSel, monthsSel), [yearsSel, monthsSel])
  const sales = useMemo(
    () => (activeCompany ? salesByMonth(allRows, activeCompany, picks) : new Map<number, number>()),
    [allRows, activeCompany, picks],
  )
  const rec = useMemo(() => receiptsByMonth(receipts, picks), [receipts, picks])
  const summary = useMemo(() => summarize(picks, sales, rec), [picks, sales, rec])
  const yearTotals = useMemo(() => totalsByYear(summary), [summary])
  const hasReceipts = rec.size > 0
  const yearCols = useMemo(() => [...yearsSel].sort((a, b) => a - b), [yearsSel])
  const monthRows = useMemo(() => [...monthsSel].sort((a, b) => a - b), [monthsSel])
  const dailyYear = yearCols[yearCols.length - 1]

  const charts = useMemo(() => {
    if (!picks.length || !activeCompany) return null
    const txt = cssVar('--txt')
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const palette = [0, 1, 2, 3, 4, 5].map(i => cssVar(`--chart-c${i}`))
    const colour = (i: number) => palette[i % palette.length]
    const ys = [...yearsSel].sort((a, b) => a - b)
    const ms = [...monthsSel].sort((a, b) => a - b)
    const labelsM = ms.map(m => MONTH_SHORT[m - 1])
    const num = (v: number | string) => fmt0(Number(v))
    const base = (extra: Partial<ChartConfiguration['options']> = {}): ChartConfiguration['options'] => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: txt, boxWidth: 12 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${num(c.parsed.y ?? 0)}` } },
      },
      scales: {
        x: { ticks: { color: muted }, grid: { color: grid } },
        y: { ticks: { color: muted, callback: v => num(v) }, grid: { color: grid }, beginAtZero: true },
      },
      ...extra,
    })
    const k = (y: number, m: number) => y * 12 + (m - 1)
    const monthValues = (src: Map<number, number>, y: number) => ms.map(m => src.get(k(y, m)) ?? 0)
    const barsOf = (src: Map<number, number>): ChartConfiguration => ({
      type: 'bar',
      data: {
        labels: labelsM,
        datasets: ys.map((y, i) => ({
          label: String(y),
          data: monthValues(src, y),
          backgroundColor: colour(i),
          borderRadius: 3,
        })),
      },
      options: base(),
    })
    const salesWithTrend = (): ChartConfiguration => ({
      type: 'bar',
      data: {
        labels: labelsM,
        datasets: [
          ...ys.map((y, i) => ({
            type: 'bar' as const,
            label: String(y),
            data: monthValues(sales, y),
            backgroundColor: colour(i),
            borderRadius: 3,
            order: 2,
          })),
          ...ys.map((y, i) => ({
            type: 'line' as const,
            label: ys.length === 1 ? 'Trend' : `${y} trend`,
            data: linearTrend(ms.map(m => (monthHasArrived(y, m) ? (sales.get(k(y, m)) ?? 0) : null))),
            borderColor: colour(i),
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            spanGaps: false,
            order: 1,
          })),
        ],
      },
      options: base(),
    })
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1))
    const dailyYear = ys[ys.length - 1]
    const dailyDatasets = picks.filter(p => p.year === dailyYear).map((p, i) => ({
      label: `${MONTH_SHORT[p.month - 1]} ${p.year}`,
      data: salesByDay(allRows, activeCompany, p.year, p.month),
      borderColor: colour(i),
      backgroundColor: colour(i),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
    }))
    return {
      salesMonthly: salesWithTrend(),
      receiptsMonthly: barsOf(rec),
      salesDaily: {
        type: 'line',
        data: { labels: days, datasets: dailyDatasets },
        options: base(),
      } as ChartConfiguration,
    }
  }, [picks, activeCompany, yearsSel, monthsSel, sales, rec, allRows])

  if (isLoading) return <p className="status-msg">Loading data…</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>
  if (!activeCompany) return <p className="status-msg">No companies available.</p>

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>R&amp;D — Monthly data</h2>

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div>
          <div className="sidebar-label">Company</div>
          {companies.length === 1 ? (
            <b>{companyLabel(activeCompany)}</b>
          ) : (
            <div className="chip-row">
              {companies.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`chip${c === activeCompany ? ' active' : ''}`}
                  onClick={() => setCompany(c)}
                >
                  {companyLabel(c)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="sidebar-label">Year (one or more)</div>
          <div className="chip-row">
            {years.length === 0 ? <span>No data for this company.</span> : null}
            {years.map(y => (
              <button
                key={y}
                type="button"
                className={`chip${yearsSel.includes(y) ? ' active' : ''}`}
                onClick={() => setPickedYears(toggle(yearsSel, y))}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="sidebar-label">
            Month (as many as you like){' '}
            <button type="button" className="chip chip-link" onClick={() => setPickedMonths(MONTH_SHORT.map((_, i) => i + 1))}>
              All
            </button>{' '}
            <button type="button" className="chip chip-link" onClick={() => setPickedMonths([])}>
              None
            </button>
          </div>
          <div className="chip-row">
            {MONTH_SHORT.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`chip${monthsSel.includes(i + 1) ? ' active' : ''}`}
                onClick={() => setPickedMonths(toggle(monthsSel, i + 1))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!charts ? (
        <p className="status-msg">Choose at least one year and one month.</p>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ marginBottom: 8 }}>Sales by month</h3>
              <div>
                {yearTotals.map(t => (
                  <span key={t.year} style={{ marginLeft: 12 }}>
                    {t.year} <b>{fmt0(t.sales)}</b>
                  </span>
                ))}
              </div>
            </div>
            <HubChart config={charts.salesMonthly} height={260} label="Sales by month" />
          </section>
          <section>
            <h3>Sales by day{yearCols.length > 1 && dailyYear ? ` — ${dailyYear}` : ''}</h3>
            <HubChart config={charts.salesDaily} height={260} label="Sales by day" />
          </section>
          <section>
            <h3>Receivables — receipts by month (net of VAT)</h3>
            {hasReceipts ? (
              <HubChart config={charts.receiptsMonthly} height={260} label="Receipts by month" />
            ) : (
              <p className="status-msg">No receipts recorded for the chosen months.</p>
            )}
          </section>
          <section>
            <h3>Numbers</h3>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Month</th>
                    {yearCols.map(y => (
                      <th key={y}>{y}</th>
                    ))}
                    {hasReceipts
                      ? yearCols.map(y => (
                          <th key={`r${y}`}>{y} receipts</th>
                        ))
                      : null}
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map(m => (
                    <tr key={m}>
                      <td>{MONTH_SHORT[m - 1]}</td>
                      {yearCols.map(y => {
                        const row = summary.find(s => s.year === y && s.month === m)
                        return <td key={y}>{fmt0(row?.sales ?? 0)}</td>
                      })}
                      {hasReceipts
                        ? yearCols.map(y => {
                            const row = summary.find(s => s.year === y && s.month === m)
                            return <td key={`r${y}`}>{row?.receipts != null ? fmt0(row.receipts) : '—'}</td>
                          })
                        : null}
                    </tr>
                  ))}
                  <tr>
                    <td>Total</td>
                    {yearTotals.map(t => (
                      <td key={t.year}>
                        <b>{fmt0(t.sales)}</b>
                      </td>
                    ))}
                    {hasReceipts
                      ? yearCols.map(y => {
                          const amounts = monthRows.map(m => summary.find(s => s.year === y && s.month === m)?.receipts)
                          const any = amounts.some(v => v != null)
                          const total = amounts.reduce<number>((sum, v) => sum + (v ?? 0), 0)
                          return <td key={`rt${y}`}>{any ? <b>{fmt0(total)}</b> : '—'}</td>
                        })
                      : null}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
