import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { Kpi, PurchaseSearchBar, useDebounced } from '../../components/rnd/PurchaseSearch'
import { SortTh, useSortedRows } from '../../components/rnd/sortRows'
import { ComparisonTable } from '../../components/rnd/ComparisonTable'
import { MarginNote } from '../../components/rnd/marginShared'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { attachMargin, fmtPct, hasMarginData, marginOf, type CostCover } from '../../lib/grossMargin'
import { fetchItemCardMargin } from '../../lib/grossMarginApi'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import {
  daysSince,
  fetchItemCard,
  fetchItemVsLastYear,
  changeLabel,
  throughLabel,
  lastMonthKeys,
  monthsOfCover,
  returnRate,
  searchItems,
  type ItemCardClient,
} from '../../lib/purchaseCards'
import type { LogicalCompany } from '../../types/dashboard'
import { ReturnsDetail } from '../../components/rnd/ReturnsDetail'
import { fmtDate } from '../../lib/dates'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

function ClientRows({ rows: baseRows, company, empty, margins }: { rows: ItemCardClient[]; company: string; empty: string; margins?: Array<CostCover & { id: string }> | null }) {
  const { t } = useLocale()
  const showM = hasMarginData(margins ?? [])
  const rows = useMemo(() => attachMargin(baseRows, margins, r => r.id, e => e.id, r => r.cash ?? 0), [baseRows, margins])
  const { sorted, sort, onSort } = useSortedRows(
    rows,
    { client: r => r.name || r.id, qty: r => r.qty, cash: r => r.cash, margin: r => r.margin, marginPct: r => r.marginPct, months: r => r.months, last: r => r.last },
    { key: 'cash', dir: 'desc' },
    ['client'],
  )
  if (!rows.length) return <p className="status-msg">{empty}</p>
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <SortTh label={t('pc.col.client')} k="client" left sort={sort} onSort={onSort} />
            <SortTh label={t('pc.col.pieces')} k="qty" sort={sort} onSort={onSort} />
            <SortTh label={t('pc.col.cash')} k="cash" sort={sort} onSort={onSort} />
            {showM ? <SortTh label={t('gm.col.margin')} k="margin" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
            {showM ? <SortTh label={t('gm.col.marginPct')} k="marginPct" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
            <SortTh label={t('pc.col.monthsBought')} k="months" sort={sort} onSort={onSort} />
            <SortTh label={t('pc.col.lastBought')} k="last" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td style={{ textAlign: 'left' }} title={r.name}>
                <Link to={`/rnd/client?co=${company}&id=${encodeURIComponent(r.id)}`}>{r.name || r.id}</Link> <small>{r.id}</small>
              </td>
              <td>{r.qty != null ? fmt0(r.qty) : '—'}</td>
              <td>{r.cash != null ? fmt0(r.cash) : '—'}</td>
              {showM ? <td>{r.margin == null ? '—' : fmt0(r.margin)}</td> : null}
              {showM ? <td>{fmtPct(r.marginPct)}</td> : null}
              <td>{r.months}</td>
              <td>{r.last ? fmtDate(r.last) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** R&D → Item card: who buys one item, how fast it sells, how long the stock lasts. Needs the Purchase insights module. */
export function ItemCardPage() {
  const { t, monthNames } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const [params, setParams] = useSearchParams()
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const paramCo = params.get('co') as LogicalCompany | null
  const company = (paramCo && companies.includes(paramCo) ? paramCo : companies[0]) as LogicalCompany | undefined
  const sku = params.get('sku')
  const [query, setQuery] = useState('')
  const q = useDebounced(query)

  const moveLabel = (k: string) =>
    k === 'import' ? t('pc.move.import') : k === 'local_purchase' ? t('pc.move.local') : k === 'return_in' ? t('pc.move.returnIn') : k

  const hits = useQuery({
    queryKey: ['pc-items', company, q, asUser],
    queryFn: () => searchItems(company as string, q, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })
  const card = useQuery({
    queryKey: ['item-card', company, sku, asUser],
    queryFn: () => fetchItemCard(company as string, sku as string, asUser),
    enabled: !!company && !!sku,
    staleTime: 5 * 60 * 1000,
  })

  const vs = useQuery({
    queryKey: ['item-vs-ly', company, sku, asUser],
    queryFn: () => fetchItemVsLastYear(company as string, sku as string, asUser),
    enabled: !!company && !!sku,
    staleTime: 5 * 60 * 1000,
  })
  const data = card.data
  // Gross margin (null for users who may not see item costs).
  const marginQ = useQuery({
    queryKey: ['item-card-margin', company, sku, asUser],
    queryFn: () => fetchItemCardMargin(company as string, sku as string, asUser),
    enabled: !!company && !!sku,
    staleTime: 5 * 60 * 1000,
  })
  const marginData = marginQ.data ?? null
  const hasM = hasMarginData(marginData?.months ?? [])
  const net12 = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const cur = now.getFullYear() * 12 + now.getMonth() + 1
    return data.months.filter(m => m.y * 12 + m.m > cur - 12).reduce((a, m) => a + m.cash, 0)
  }, [data])
  const margin12 = marginOf({ cost: marginData?.cost12, covered: marginData?.covered12 }, net12)
  const hitSort = useSortedRows(
    hits.data,
    { item: h => `${h.sku} ${h.name}`, qty12: h => h.qty12, cash12: h => h.cash12, clients12: h => h.clients12 },
    null,
    ['item'],
  )
  const moveSort = useSortedRows(
    data?.moves,
    { date: m => m.date, type: m => moveLabel(m.kind), qty: m => m.qty, doc: m => m.doc },
    { key: 'date', dir: 'desc' },
    ['type', 'doc'],
  )
  const charts = useMemo(() => {
    if (!data) return null
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const now = new Date()
    const keys = lastMonthKeys(now.getFullYear(), now.getMonth() + 1, 24)
    const byKey = new Map(data.months.map(m => [m.y * 12 + m.m, m]))
    const monthly: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: keys.map(k => `${monthNames[k.m - 1]} ${String(k.y).slice(2)}`),
        datasets: [
          { label: t('pc.col.sold'), data: keys.map(k => byKey.get(k.y * 12 + k.m)?.sold ?? 0), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 },
          { label: t('pc.col.returned'), data: keys.map(k => byKey.get(k.y * 12 + k.m)?.returned ?? 0), backgroundColor: cssVar('--chart-c3'), borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: muted } } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
          y: { ticks: { color: muted }, grid: { color: grid }, beginAtZero: true },
        },
      },
    }
    const marginOfMonth = new Map((marginData?.months ?? []).map(m => [m.y * 12 + m.m, marginOf(m).margin]))
    const marginChart: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: keys.map(k => `${monthNames[k.m - 1]} ${String(k.y).slice(2)}`),
        datasets: [{ label: t('gm.chart.margin'), data: keys.map(k => marginOfMonth.get(k.y * 12 + k.m) ?? 0), backgroundColor: cssVar('--chart-c4'), borderRadius: 3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
          y: { ticks: { color: muted }, grid: { color: grid } },
        },
      },
    }
    const stock: ChartConfiguration = {
      type: 'line',
      data: {
        labels: data.stockDaily.map(d => fmtDate(d.day).slice(0, 5)),
        datasets: [
          {
            label: t('pc.item.stockSeries'),
            data: data.stockDaily.map(d => d.qty),
            borderColor: cssVar('--chart-c1'),
            backgroundColor: cssVar('--chart-c1'),
            borderWidth: 2,
            pointRadius: 0,
            stepped: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 24 }, grid: { display: false } },
          y: { ticks: { color: muted }, grid: { color: grid }, beginAtZero: true },
        },
      },
    }
    return { monthly, stock, marginChart }
  }, [data, marginData, t, monthNames])

  if (!company) return <p className="status-msg">{t('pc.noCompanies')}</p>

  const pick = (s: string) => setParams({ co: company, sku: s })
  const rate = data ? returnRate(data.sold12, data.returned12) : null
  const cover = data ? monthsOfCover(data.stock, data.sold3) : null
  const since = data ? daysSince(data.last) : null

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('pc.item.title')}</h2>
      <PurchaseSearchBar
        companies={companies}
        company={company}
        onCompany={c => setParams({ co: c })}
        query={query}
        onQuery={setQuery}
        placeholder={t('pc.item.placeholder')}
      />

      {!sku || !data ? (
        <>
          {hits.isLoading ? <p className="status-msg">{t('pc.searching')}</p> : null}
          {hits.error ? <p className="status-msg error">{(hits.error as Error).message}</p> : null}
          {hits.data && !hits.data.length ? <p className="status-msg">{t('pc.item.noMatch')}</p> : null}
          {card.isLoading ? <p className="status-msg">{t('pc.item.loading')}</p> : null}
          {card.error ? <p className="status-msg error">{(card.error as Error).message}</p> : null}
          {hits.data?.length ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <SortTh label={t('pc.col.item')} k="item" left sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.piecesL12')} k="qty12" sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.netCashL12')} k="cash12" sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.clients')} k="clients12" sort={hitSort.sort} onSort={hitSort.onSort} />
                  </tr>
                </thead>
                <tbody>
                  {hitSort.sorted.map(h => (
                    <tr key={h.sku} style={{ cursor: 'pointer' }} onClick={() => pick(h.sku)}>
                      <td style={{ textAlign: 'left' }} title={h.name}>
                        <a
                          href={`?co=${company}&sku=${encodeURIComponent(h.sku)}`}
                          onClick={e => {
                            e.preventDefault()
                            pick(h.sku)
                          }}
                        >
                          {h.sku}
                        </a>{' '}
                        · {h.name}
                      </td>
                      <td>{h.qty12 != null ? fmt0(h.qty12) : '—'}</td>
                      <td>{h.cash12 != null ? fmt0(h.cash12) : '—'}</td>
                      <td>{h.clients12 ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{data.item.name}</h3>
            <small>
              {data.item.sku} · {data.item.brand}
              {data.item.barcode ? ` · ${data.item.barcode}` : ''}
            </small>
            <button type="button" className="chip" onClick={() => setParams({ co: company })}>
              {t('pc.item.other')}
            </button>
          </div>

          {data.scoped ? (
            <p className="sel-months-list" style={{ margin: '0 0 8px' }}>
              {t('pc.item.scoped')}
            </p>
          ) : null}
          <div className="hub-grid">
            <Kpi label={t('pc.item.inStock')} value={fmt0(data.stock)} note={cover == null ? t('pc.item.noSales3') : t('pc.item.cover', { n: cover.toFixed(1) })} tone={cover != null && cover < 1 ? 'amber' : undefined} />
            <Kpi label={t('pc.item.sold12')} value={fmt0(data.sold12)} note={t('pc.item.net3', { n: fmt0(data.sold3) })} tone="grn" />
            <Kpi label={t('pc.kpi.netCash12')} value={net12 == null ? '—' : fmt0(net12)} note={data.scoped ? t('pc.item.cashNoteScoped') : t('pc.item.cashNote')} hint={t('pc.item.cashHint')} tone="grn" />
            <Kpi label={t('pc.kpi.returnRate')} value={rate == null ? '—' : `${(rate * 100).toFixed(1)}%`} hint={t('pc.item.rateHint')} note={t('pc.item.piecesReturned', { n: fmt0(data.returned12) })} tone={rate != null && rate > 0.15 ? 'amber' : undefined} />
            {hasM ? (
              <Kpi
                label={t('gm.kpi.margin') + ' — 12m'}
                value={margin12.margin == null ? '—' : fmt0(margin12.margin)}
                note={margin12.pct == null ? t('gm.coverageNone') : t('gm.kpi.marginSub', { pct: fmtPct(margin12.pct) })}
                hint={t('gm.hint')}
                tone={margin12.margin != null && margin12.margin < 0 ? 'amber' : undefined}
              />
            ) : null}
            <Kpi label={t('pc.item.clients12')} value={fmt0(data.clients12)} note={since == null ? undefined : t('pc.item.lastSale', { days: since, date: fmtDate(data.last) })} />

            {vs.data ? (
              <>
                <Kpi
                  label={t('pc.item.piecesThrough', { through: throughLabel(vs.data.throughMonth, monthNames) })}
                  value={fmt0(vs.data.cy.qty)}
                  note={t('pc.kpi.lastYearChange', { ly: fmt0(vs.data.ly.qty), chg: changeLabel(vs.data.cy.qty, vs.data.ly.qty, t('pc.new')) })}
                  tone={vs.data.cy.qty >= vs.data.ly.qty ? 'grn' : 'amber'}
                  hint={t('pc.item.piecesHint', { y: vs.data.year, py: vs.data.prevYear })}
                />
                <Kpi
                  label={t('pc.item.clientsThrough', { through: throughLabel(vs.data.throughMonth, monthNames) })}
                  value={fmt0(vs.data.cy.clients ?? 0)}
                  note={t('pc.kpi.lastYearChange', { ly: fmt0(vs.data.ly.clients ?? 0), chg: changeLabel(vs.data.cy.clients ?? 0, vs.data.ly.clients ?? 0, t('pc.new')) })}
                />
              </>
            ) : null}

            <ReturnsDetail company={company} target={{ sku: data.item.sku }} asUser={asUser} />

            <section className="hub-card hub-span-8">
              <div className="hub-card-hdr"><h3>{t('pc.item.soldReturnedTitle')}</h3></div>
              {charts ? <HubChart config={charts.monthly} height={240} label={t('pc.item.soldReturnedAria')} minWidth={560} /> : null}
            </section>
            {hasM && charts ? (
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr">
                  <h3>{t('gm.monthly.title')} — 24</h3>
                  <span className="hub-card-aside">
                    {marginData!.unitCosts.length
                      ? `${t('gm.item.costs')}: ` +
                        marginData!.unitCosts
                          .map(u => `${u.year} ${u.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${u.basis === 'import' ? t('gm.item.basisImport') : t('gm.item.basisCurrent')})`)
                          .join(' · ')
                      : t('gm.coverageNone')}
                  </span>
                </div>
                <MarginNote visible coverage={margin12.coverage} />
                <HubChart config={charts.marginChart} height={200} label={t('gm.monthly.aria')} minWidth={560} />
              </section>
            ) : null}
            <section className="hub-card hub-span-4">
              <div className="hub-card-hdr"><h3>{t('pc.item.stock150')}</h3></div>
              {charts && data.stockDaily.length ? (
                <HubChart config={charts.stock} height={240} label={t('pc.item.stockAria')} minWidth={420} />
              ) : (
                <p className="status-msg">{t('pc.item.noStockHist')}</p>
              )}
            </section>

            {vs.data ? (
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr">
                  <h3>{t('pc.item.clientsVs')}</h3>
                  <span className="hub-card-aside">
                    {t('pc.item.clientsVsAside', { through: throughLabel(vs.data.throughMonth, monthNames), y: vs.data.year, py: vs.data.prevYear })}
                  </span>
                </div>
                <ComparisonTable
                  head={t('pc.col.client')}
                  cyLabel={String(vs.data.year)}
                  lyLabel={String(vs.data.prevYear)}
                  empty={t('pc.item.noneEither')}
                  rows={vs.data.clients.map(c => ({
                    key: c.id,
                    label: (
                      <span title={c.name}>
                        <Link to={`/rnd/client?co=${company}&id=${encodeURIComponent(c.id)}`}>{c.name || c.id}</Link> <small>{c.id}</small>
                      </span>
                    ),
                    text: c.name || c.id,
                    cy: c.cyQty,
                    ly: c.lyQty,
                  }))}
                />
              </section>
            ) : null}

            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>{t('pc.item.topClients')}</h3></div>
              <ClientRows rows={data.topClients} company={company} empty={t('pc.item.noBuyers12')} margins={marginData?.topClients} />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>{t('pc.stopped')}</h3>
                <span className="hub-card-aside">{t('pc.stoppedAside')}</span>
              </div>
              <ClientRows rows={data.stopped} company={company} empty={t('pc.item.noStopped')} margins={marginData?.stopped} />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>{t('pc.item.arrivals')}</h3></div>
              {data.moves.length ? (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <SortTh label={t('pc.col.date')} k="date" left sort={moveSort.sort} onSort={moveSort.onSort} />
                        <SortTh label={t('pc.col.type')} k="type" left sort={moveSort.sort} onSort={moveSort.onSort} />
                        <SortTh label={t('pc.col.pieces')} k="qty" sort={moveSort.sort} onSort={moveSort.onSort} />
                        <SortTh label={t('pc.col.document')} k="doc" left sort={moveSort.sort} onSort={moveSort.onSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {moveSort.sorted.map((m, i) => (
                        <tr key={`${m.date}|${m.doc}|${i}`}>
                          <td style={{ textAlign: 'left' }}>{fmtDate(m.date)}</td>
                          <td style={{ textAlign: 'left' }}>{moveLabel(m.kind)}</td>
                          <td>{fmt0(m.qty)}</td>
                          <td style={{ textAlign: 'left' }}>{m.doc ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="status-msg">{t('pc.item.noArrivals')}</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
