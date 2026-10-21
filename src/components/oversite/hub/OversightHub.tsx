import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { useAuth } from '../../../context/AuthContext'
import { useDashboardAccess } from '../../../context/DashboardAccessContext'
import { useLocale } from '../../../context/LocaleContext'
import { usePreview } from '../../../context/PreviewContext'
import { useTheme } from '../../../context/ThemeContext'
import { useDashboardData } from '../../../hooks/useDashboardData'
import { useOpsDeliveries } from '../../../hooks/useOpsDeliveries'
import { computeDebtSummary, debtRowsForCompany } from '../../../lib/debtMetrics'
import { fmt, MONTH_NAMES } from '../../../lib/format'
import {
  addDays, agentLeaderboard, agentMonthHeatmap, categoryByMonth, dailySeries, lastMonths, monthlySales, squarify, topItems,
} from '../../../lib/hubMetrics'
import { salesLyToDate } from '../../../lib/oversightGroupKpis'
import { readOversightCompanyFilter, writeOversightCompanyFilter } from '../../../lib/oversightCompanyFilter'
import { canShowOversiteModule } from '../../../lib/oversiteModuleGate'
import type { OversiteModuleId } from '../../../lib/oversiteModules'
import {
  OVERSITE_COMPANIES, computeDelivery720Mtd, computeOpenOrders, getOversiteDateContext, resolveOpenOrdersTag, resolveOrdersTag,
} from '../../../lib/oversiteMetrics'
import { canShowModule } from '../../../lib/permissions'
import { computeSalesForecast } from '../../../lib/salesForecast'
import type { OversightLayoutPreference } from '../../../lib/oversightLayouts'
import type { LogicalCompany } from '../../../types/dashboard'
import { OversightCompanyFilter } from '../OversightCompanyFilter'
import { OversightLayoutToggle, type OversightLayoutOption } from '../OversightLayoutToggle'
import { HubChart, cssVar, withAlpha } from './HubChart'

const shortName = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, '').trim()
const monthLabel = (m: { month: number; year: number }) => `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`

/** Chart-first Oversight layout ("Hub"): all selected companies combined, company colours inside the charts. */
export function OversightHub({
  layoutToggle,
}: {
  layoutToggle?: { active: string; options?: OversightLayoutOption[]; onSelect: (p: OversightLayoutPreference) => void }
}) {
  const { t } = useLocale()
  const { theme } = useTheme()
  const { session } = useAuth()
  const { access } = useDashboardAccess()
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const { rows, debtRows, isLoading, error } = useDashboardData()
  const show = (id: OversiteModuleId) => canShowOversiteModule(access, id, isSuperAdmin)
  const showDeliveries = canShowModule(access, 'ops_deliveries', isSuperAdmin)
  const deliveriesQ = useOpsDeliveries(6)
  const includeNotes = show('deliveryNotes')

  const ctx = useMemo(() => getOversiteDateContext(), [])
  const companiesKey = access?.companies?.join(',') ?? ''
  const visible = useMemo(
    () => OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on companies identity
    [companiesKey],
  )
  const allowedIds = useMemo(() => visible.map(c => c.id), [visible])
  const userId = session?.user.id ?? ''
  const [selected, setSelected] = useState<Set<LogicalCompany>>(() => readOversightCompanyFilter(userId, allowedIds))
  useEffect(() => setSelected(readOversightCompanyFilter(userId, allowedIds)), [userId, companiesKey, allowedIds])
  const cos = useMemo(() => visible.filter(c => selected.has(c.id)), [visible, selected])

  const data = useMemo(() => {
    const salesSet = new Set<string>(cos.map(c => c.id))
    const ordersTags = new Map<string, LogicalCompany>()
    const openTags: string[] = []
    for (const c of cos) {
      ordersTags.set(resolveOrdersTag(rows, c.ordersTag), c.id)
      openTags.push(resolveOpenOrdersTag(rows, c.openOrdersTag))
    }
    const today = ctx.todayStr
    const from14 = addDays(today, -13)
    const from30 = addDays(today, -29)
    const sales14 = dailySeries(rows, salesSet, from14, today)
    const orders30 = dailySeries(rows, new Set(ordersTags.keys()), from30, today)
    const invoicesMtd = rows.reduce(
      (s, r) => (salesSet.has(r.company) && Number(r.year) === ctx.curYear && Number(r.month) === ctx.curMonth ? s + (Number(r.cash) || 0) : s), 0)
    const notesMtd = includeNotes
      ? cos.reduce((s, c) => s + computeDelivery720Mtd(rows, c.delivery720Tag, ctx.monthStart, today).cash, 0)
      : 0
    const salesMtd = invoicesMtd + notesMtd
    const lyToDate = cos.reduce((s, c) => s + salesLyToDate(rows, c.id, ctx.curYear, ctx.curMonth, Number(today.slice(8, 10))), 0)
    const open = openTags.reduce((acc, tag) => {
      const o = computeOpenOrders(rows, tag)
      return { cash: acc.cash + o.cash, qty: acc.qty + o.qty }
    }, { cash: 0, qty: 0 })
    const debt = cos.reduce((s, c) => s + (computeDebtSummary(debtRowsForCompany(debtRows, c.id))?.grandTotal ?? 0), 0)
    const ordersMtdByCo = cos.map(c => {
      const tag = [...ordersTags.entries()].find(([, id]) => id === c.id)?.[0] ?? c.ordersTag
      return { co: c, cash: dailySeries(rows, new Set([tag]), ctx.monthStart, today).reduce((s, d) => s + d.cash, 0) }
    })
    const leaders = agentLeaderboard(rows, ordersTags, ctx.monthStart, today, 10)
    const months12 = monthlySales(rows, salesSet, lastMonths(ctx, 12))
    const projected = cos.reduce((s, c) => s + (computeSalesForecast(rows, c.id, ctx)?.projected ?? 0), 0)
    const months6 = lastMonths(ctx, 6)
    const shortOf = (id: LogicalCompany) => shortName(cos.find(c => c.id === id)?.label ?? id)
    return {
      sales14, orders30, salesMtd, lyToDate, open, debt, ordersMtdByCo, leaders, months12, projected,
      heat: agentMonthHeatmap(rows, salesSet, months6, shortOf, 12),
      items: topItems(rows, salesSet, ctx.curYear, ctx.curMonth, 16),
      cats: categoryByMonth(rows, salesSet, months6, t('hub.other'), 6),
      ordersToday: orders30[orders30.length - 1],
      shortOf,
    }
  }, [rows, debtRows, cos, ctx, t, includeNotes])

  // Theme-aware palette (recomputed when the theme changes).
  const pal = useMemo(() => ({
    txt: cssVar('--txt'), muted: cssVar('--muted'), grid: cssVar('--bdr-s', '#2d3449'),
    acc: cssVar('--acc'), grn: cssVar('--grn'), amber: cssVar('--amber'),
    series: [0, 1, 2, 3, 4, 5].map(i => cssVar(`--chart-c${i}`)),
    co: (id: LogicalCompany) => cssVar(`--co-${id}`),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [theme])

  const axes = useMemo(() => ({
    x: { ticks: { color: pal.muted, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
    y: { ticks: { color: pal.muted }, grid: { color: withAlpha(pal.grid, 0.6) }, beginAtZero: true },
  }), [pal])

  const ordersChart = useMemo<ChartConfiguration>(() => ({
    type: 'bar',
    data: {
      labels: data.orders30.map(d => d.date.slice(8, 10) + '/' + d.date.slice(5, 7)),
      datasets: [
        { type: 'line', label: t('hub.orderValue'), data: data.orders30.map(d => d.cash), borderColor: pal.acc,
          backgroundColor: withAlpha(pal.acc, 0.18), fill: true, tension: 0.35, pointRadius: 0, yAxisID: 'y', order: 1 },
        { type: 'bar', label: t('hub.orderCount'), data: data.orders30.map(d => d.orders),
          backgroundColor: withAlpha(pal.grn, 0.55), borderRadius: 3, yAxisID: 'y1', order: 2 },
      ],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: pal.txt, boxWidth: 10 } } },
      scales: { ...axes, y1: { position: 'right', ticks: { color: pal.muted }, grid: { display: false }, beginAtZero: true } },
    },
  }), [data.orders30, pal, axes, t])

  const donutChart = useMemo<ChartConfiguration>(() => {
    const single = data.ordersMtdByCo.length === 1
    const entries = single
      ? data.leaders.map((a, i) => ({ label: a.agent, value: a.cash, color: pal.series[i % pal.series.length] }))
      : data.ordersMtdByCo.map(x => ({ label: shortName(x.co.label), value: x.cash, color: pal.co(x.co.id) }))
    return {
      type: 'doughnut',
      data: { labels: entries.map(e => e.label), datasets: [{ data: entries.map(e => e.value), backgroundColor: entries.map(e => e.color), borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: pal.txt, boxWidth: 10 } } } },
    }
  }, [data.ordersMtdByCo, data.leaders, pal])

  const forecastChart = useMemo<ChartConfiguration>(() => {
    const labels = data.months12.map(monthLabel)
    const last = data.months12.length - 1
    const actual = data.months12.map((m, i) => (i === last ? null : m.cash))
    const proj = data.months12.map((m, i) => (i === last ? Math.max(data.projected, m.cash) : i === last - 1 ? m.cash : null))
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: t('hub.actual'), data: actual, borderColor: pal.grn, backgroundColor: withAlpha(pal.grn, 0.2), fill: true, tension: 0.35, pointRadius: 2 },
          { label: t('hub.projected'), data: proj, borderColor: pal.amber, borderDash: [6, 4], pointRadius: 3, fill: false, spanGaps: false },
        ],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: pal.txt, boxWidth: 10 } } }, scales: axes },
    }
  }, [data.months12, data.projected, pal, axes, t])

  const catChart = useMemo<ChartConfiguration>(() => ({
    type: 'bar',
    data: {
      labels: data.cats.months.map(monthLabel),
      datasets: data.cats.series.map((s, i) => ({ label: s.label, data: s.values, backgroundColor: i < pal.series.length ? pal.series[i] : pal.muted, borderRadius: 2 })),
    },
    options: {
      maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: pal.txt, boxWidth: 10 } } },
      scales: { x: { ...axes.x, stacked: true }, y: { ...axes.y, stacked: true } },
    },
  }), [data.cats, pal, axes])

  const deliveriesChart = useMemo<ChartConfiguration | null>(() => {
    const rowsD = (deliveriesQ.data ?? []).filter(r => cos.some(c => c.id === r.company))
    if (!rowsD.length) return null
    const yms = [...new Set(rowsD.map(r => r.ym))].sort()
    return {
      type: 'bar',
      data: {
        labels: yms.map(ym => monthLabel({ year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) })),
        datasets: cos.map(c => ({
          label: shortName(c.label), backgroundColor: pal.co(c.id), borderRadius: 3,
          data: yms.map(ym => rowsD.filter(r => r.company === c.id && r.ym === ym).reduce((s, r) => s + r.cartons, 0)),
        })),
      },
      options: {
        maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: pal.txt, boxWidth: 10 } } },
        scales: { x: { ...axes.x, stacked: true }, y: { ...axes.y, stacked: true } },
      },
    }
  }, [deliveriesQ.data, cos, pal, axes])

  if (isLoading) return <p className="status-msg">{t('common.loadingSalesData')}</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const lyPct = data.lyToDate > 0 ? ((data.salesMtd - data.lyToDate) / data.lyToDate) * 100 : null
  const avgOrder = (() => {
    const o = data.orders30.reduce((s, d) => s + d.orders, 0)
    return o ? data.orders30.reduce((s, d) => s + d.cash, 0) / o : 0
  })()
  const leaderMax = Math.max(1, ...data.leaders.map(a => a.cash))
  const rects = squarify(data.items.map(i => i.cash))

  return (
    <div className="hub">
      <div className="ov-header">
        <div className="ov-header-row">
          <h2>📊 {t('hub.title')}</h2>
          <div className="ov-header-actions">
            <OversightCompanyFilter
              allowed={allowedIds}
              selected={selected}
              onChange={next => { setSelected(next); if (userId) writeOversightCompanyFilter(userId, next) }}
            />
            {layoutToggle ? <OversightLayoutToggle {...layoutToggle} /> : null}
          </div>
        </div>
        <div className="ov-sub">
          {t('oversite.today')}: <b>{ctx.todayDisp}</b> · {t('oversite.month')}: <b>{ctx.monthLbl}</b> ·{' '}
          {t('hub.scope')}: <b>{cos.map(c => shortName(c.label)).join(', ') || '—'}</b>
        </div>
      </div>

      {cos.length === 0 ? <p className="ov-empty">{t('oversite.noCompaniesSelected')}</p> : (
        <div className="hub-grid">
          {/* KPI tiles */}
          {show('salesMtd') ? (
            <Tile cls="hub-span-3" label={t('hub.salesMtd')} value={fmt(data.salesMtd)} tone="grn"
              badge={lyPct == null ? null : { up: lyPct >= 0, text: `${Math.abs(lyPct).toFixed(1)}%`, title: t('hub.vsLy') }}
              spark={data.sales14.map(d => d.cash)} sparkColor={pal.grn} foot={t('hub.last14')} />
          ) : null}
          {show('ordersToday') ? (
            <Tile cls="hub-span-3" label={t('hub.ordersToday')} value={fmt(data.ordersToday?.cash ?? 0)}
              sub={`${fmt(data.ordersToday?.clients ?? 0)} ${t('oversite.clients')} · ${fmt(data.ordersToday?.orders ?? 0)} ${t('hub.orderCount')}`}
              spark={data.orders30.slice(-14).map(d => d.cash)} sparkColor={pal.acc} foot={t('hub.last14')} />
          ) : null}
          {show('openOrders') ? (
            <Tile cls="hub-span-3" label={t('hub.openOrders')} value={fmt(data.open.cash)} sub={`${fmt(data.open.qty)} ${t('oversite.qty')}`} />
          ) : null}
          {show('debt') ? (
            <Tile cls="hub-span-3" label={t('hub.openDebt')} value={fmt(data.debt)} tone="amber" />
          ) : null}

          {/* Orders last 30 days + donut */}
          {show('ordersToday') || show('ordersMtd') ? (
            <Card cls="hub-span-8" title={t('hub.orders30')} aside={`${t('hub.avgOrder')}: ${fmt(avgOrder)}`}>
              <HubChart config={ordersChart} height={250} label={t('hub.orders30')} />
            </Card>
          ) : null}
          {show('ordersMtd') ? (
            <Card cls="hub-span-4" title={cos.length === 1 ? t('hub.ordersMtdByAgent') : t('hub.ordersMtdSplit')}
              aside={fmt(data.ordersMtdByCo.reduce((s, x) => s + x.cash, 0))}>
              <HubChart config={donutChart} height={250} label={t('hub.ordersMtdSplit')} />
            </Card>
          ) : null}

          {/* Leaderboard + forecast */}
          {show('ordersMtd') ? (
            <Card cls="hub-span-5" title={t('hub.leaderboard')}>
              {data.leaders.length ? (
                <table className="hub-table">
                  <thead><tr><th>{t('hub.agent')}</th><th>{t('oversite.clients')}</th><th>{t('oversite.qty')}</th><th>{t('oversite.cash')}</th></tr></thead>
                  <tbody>
                    {data.leaders.map(a => (
                      <tr key={`${a.company}|${a.agent}`}>
                        <td><span className="hub-dot" style={{ background: pal.co(a.company) }} />{cos.length > 1 ? `${data.shortOf(a.company)} · ` : ''}{a.agent}</td>
                        <td>{fmt(a.clients)}</td>
                        <td>{fmt(a.qty)}</td>
                        <td className="hub-cash">
                          <span className="hub-bar" style={{ width: `${(a.cash / leaderMax) * 100}%`, background: withAlpha(pal.co(a.company), 0.25) }} />
                          <span className="hub-cash-val">{fmt(a.cash)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="hub-empty">{t('hub.noData')}</p>}
            </Card>
          ) : null}
          {show('salesMtd') ? (
            <Card cls="hub-span-7" title={t('hub.forecast')} aside={data.projected ? `${t('hub.projected')}: ${fmt(data.projected)}` : undefined}>
              <HubChart config={forecastChart} height={260} label={t('hub.forecast')} />
            </Card>
          ) : null}

          {/* Treemap + categories */}
          {show('topItems') ? (
            <Card cls="hub-span-7" title={t('hub.topProducts')}>
              {data.items.length ? (
                <div className="hub-treemap" role="img" aria-label={t('hub.topProducts')}>
                  {data.items.map((it, i) => {
                    const q = rects[i]
                    return (
                      <div key={`${it.company}|${it.sku}`} className="hub-tile"
                        title={`${it.label} (${it.sku}) · ${fmt(it.cash)}`}
                        style={{ left: `${q.x * 100}%`, top: `${q.y * 100}%`, width: `${q.w * 100}%`, height: `${q.h * 100}%`,
                          background: withAlpha(pal.co(it.company), 0.18 + 0.5 * (it.cash / data.items[0].cash)), borderColor: withAlpha(pal.co(it.company), 0.8) }}>
                        <span className="hub-tile-name" dir="auto">{it.label}</span>
                        <span className="hub-tile-val">{fmt(it.cash)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="hub-empty">{t('hub.noData')}</p>}
            </Card>
          ) : null}
          {show('topItems') ? (
            <Card cls="hub-span-5" title={t('hub.categories')}>
              <HubChart config={catChart} height={300} label={t('hub.categories')} />
            </Card>
          ) : null}

          {/* Heatmap + deliveries */}
          {show('salesMtd') ? (
            <Card cls={showDeliveries && deliveriesChart ? 'hub-span-8' : 'hub-span-12'} title={t('hub.heatmap')}>
              {data.heat.rows.length ? (
                <div className="hub-heat" style={{ gridTemplateColumns: `minmax(110px, 1.3fr) repeat(${data.heat.months.length}, minmax(52px, 1fr))` }}>
                  <div />
                  {data.heat.months.map(m => <div key={m.ym} className="hub-heat-h">{monthLabel(m)}</div>)}
                  {data.heat.rows.map(row => (
                    <div key={row.label} className="hub-heat-row" style={{ display: 'contents' }}>
                      <div className="hub-heat-lbl" dir="auto"><span className="hub-dot" style={{ background: pal.co(row.company) }} />{row.label}</div>
                      {row.values.map((v, i) => {
                        const k = data.heat.max ? v / data.heat.max : 0
                        return (
                          <div key={i} className="hub-heat-cell" title={`${row.label} · ${monthLabel(data.heat.months[i])}: ${fmt(v)}`}
                            style={{ background: v ? withAlpha(pal.grn, 0.12 + 0.78 * k) : 'transparent', color: k > 0.55 ? '#06281f' : undefined }}>
                            {v ? (Math.abs(v) < 500 ? '0' : `${fmt(Math.round(v / 1000))}K`) : '·'}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ) : <p className="hub-empty">{t('hub.noData')}</p>}
            </Card>
          ) : null}
          {showDeliveries && deliveriesChart ? (
            <Card cls="hub-span-4" title={t('hub.deliveries')}>
              <HubChart config={deliveriesChart} height={280} label={t('hub.deliveries')} />
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Card({ cls, title, aside, children }: { cls: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className={`hub-card ${cls}`}>
      <div className="hub-card-hdr">
        <h3>{title}</h3>
        {aside ? <span className="hub-card-aside">{aside}</span> : null}
      </div>
      {children}
    </section>
  )
}

function Tile({
  cls, label, value, sub, tone, badge, spark, sparkColor, foot,
}: {
  cls: string; label: string; value: string; sub?: string; tone?: 'grn' | 'amber'
  badge?: { up: boolean; text: string; title: string } | null
  spark?: number[]; sparkColor?: string; foot?: string
}) {
  const max = Math.max(1, ...(spark ?? [0]))
  return (
    <section className={`hub-card hub-tile-kpi ${cls}`}>
      <span className="hub-kpi-lbl">{label}</span>
      <div className="hub-kpi-main">
        <span className={`hub-kpi-val${tone ? ` ${tone}` : ''}`}>{value}</span>
        {badge ? <span className={`bento-kpi-delta ${badge.up ? 'up' : 'down'}`} title={badge.title}>{badge.up ? '▲' : '▼'} {badge.text}</span> : null}
      </div>
      {sub ? <span className="hub-kpi-sub">{sub}</span> : null}
      {spark?.length ? (
        <div className="hub-spark" aria-hidden="true">
          {spark.map((v, i) => (
            <span key={i} style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: sparkColor, opacity: i === spark.length - 1 ? 1 : 0.55 }} />
          ))}
        </div>
      ) : null}
      {foot ? <span className="hub-kpi-foot">{foot}</span> : null}
    </section>
  )
}
