import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { Kpi, PurchaseSearchBar, useDebounced } from '../../components/rnd/PurchaseSearch'
import { SortTh, useSortedRows } from '../../components/rnd/sortRows'
import { ComparisonTable } from '../../components/rnd/ComparisonTable'
import { ClientItemSales } from '../../components/rnd/ClientItemSales'
import { MarginNote } from '../../components/rnd/marginShared'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { attachMargin, fmtPct, hasMarginData, marginOf, type CostCover } from '../../lib/grossMargin'
import { fetchClientCardMargin } from '../../lib/grossMarginApi'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import { fmtK } from '../../lib/stockByBrand'
import {
  daysSince,
  fetchClientCard,
  fetchChainStores,
  fetchClientChain,
  fetchClientVsLastYear,
  searchChains,
  fetchCreditCheck,
  changeLabel,
  throughLabel,
  lastMonthKeys,
  rateWithoutReissue,
  returnRate,
  searchClients,
  type ClientCardItem,
} from '../../lib/purchaseCards'
import type { LogicalCompany } from '../../types/dashboard'
import { ReturnsDetail } from '../../components/rnd/ReturnsDetail'
import { fmtDate } from '../../lib/dates'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

function ItemRows({ rows: baseRows, company, empty, margins }: { rows: ClientCardItem[]; company: string; empty: string; margins?: Array<CostCover & { sku: string }> | null }) {
  const { t } = useLocale()
  const showM = hasMarginData(margins ?? [])
  const rows = useMemo(() => attachMargin(baseRows, margins, r => r.sku, e => e.sku, r => r.cash ?? 0), [baseRows, margins])
  const { sorted, sort, onSort } = useSortedRows(
    rows,
    { item: r => `${r.sku} ${r.name}`, qty: r => r.qty, cash: r => r.cash, margin: r => r.margin, marginPct: r => r.marginPct, months: r => r.months, last: r => r.last },
    { key: 'cash', dir: 'desc' },
    ['item'],
  )
  if (!rows.length) return <p className="status-msg">{empty}</p>
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <SortTh label={t('pc.col.item')} k="item" left sort={sort} onSort={onSort} />
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
            <tr key={r.sku}>
              <td style={{ textAlign: 'left' }} title={r.name}>
                <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(r.sku)}`}>{r.sku}</Link> · {r.name}
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

/** R&D → Client card: what one client buys, how often, what they stopped buying. Needs the Purchase insights module. */
export function ClientCardPage() {
  const { t, monthNames } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const [params, setParams] = useSearchParams()
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const paramCo = params.get('co') as LogicalCompany | null
  const company = (paramCo && companies.includes(paramCo) ? paramCo : companies[0]) as LogicalCompany | undefined
  const clientId = params.get('id')
  const [query, setQuery] = useState('')
  const q = useDebounced(query)

  const hits = useQuery({
    queryKey: ['pc-clients', company, q, asUser],
    queryFn: () => searchClients(company as string, q, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })
  const chains = useQuery({
    queryKey: ['pc-chains', company, q, asUser],
    queryFn: () => searchChains(company as string, q, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })
  const isChainId = !!clientId && clientId.startsWith('chain:')
  const stores = useQuery({
    queryKey: ['chain-stores', company, clientId, asUser],
    queryFn: () => fetchChainStores(company as string, (clientId as string).slice(6), asUser),
    enabled: !!company && isChainId,
    staleTime: 5 * 60 * 1000,
  })
  const ownChain = useQuery({
    queryKey: ['client-chain', company, clientId, asUser],
    queryFn: () => fetchClientChain(company as string, clientId as string, asUser),
    enabled: !!company && !!clientId && !isChainId,
    staleTime: 5 * 60 * 1000,
  })
  const card = useQuery({
    queryKey: ['client-card', company, clientId, asUser],
    queryFn: () => fetchClientCard(company as string, clientId as string, asUser),
    enabled: !!company && !!clientId,
    staleTime: 5 * 60 * 1000,
  })

  const credit = useQuery({
    queryKey: ['client-credit', company, clientId, asUser],
    queryFn: () => fetchCreditCheck(company as string, clientId as string, asUser),
    enabled: !!company && !!clientId,
    staleTime: 5 * 60 * 1000,
  })
  const vs = useQuery({
    queryKey: ['client-vs-ly', company, clientId, asUser],
    queryFn: () => fetchClientVsLastYear(company as string, clientId as string, asUser),
    enabled: !!company && !!clientId,
    staleTime: 5 * 60 * 1000,
  })
  const data = card.data
  // Gross margin (null for users who may not see item costs: then no margin column, tile or line appears).
  const marginQ = useQuery({
    queryKey: ['client-card-margin', company, clientId, asUser],
    queryFn: () => fetchClientCardMargin(company as string, clientId as string, asUser),
    enabled: !!company && !!clientId,
    staleTime: 5 * 60 * 1000,
  })
  const marginData = marginQ.data ?? null
  const hasM = hasMarginData(marginData?.years ?? [])
  const margin12 = marginOf({ cost: marginData?.cost12, covered: marginData?.covered12 }, data ? data.sold12 - data.returned12 : null)
  const yearRows = useMemo(
    () => attachMargin(data?.years ?? [], marginData?.years, y => y.y, e => e.y, y => y.sold - y.returned),
    [data, marginData],
  )
  const chainRows = useMemo(
    () => (chains.data ?? []).map(c => ({ id: c.id, name: c.name, stores: c.stores, cash12: c.cash12, last: c.last })),
    [chains.data],
  )
  const allHits = hits.data ?? []
  const chainSort = useSortedRows(
    chainRows,
    { chain: c => c.name, stores: c => c.stores, cash12: c => c.cash12, last: c => c.last },
    null,
    ['chain'],
  )
  const storeSort = useSortedRows(
    stores.data,
    { store: s => s.name || s.id, city: s => s.city, agent: s => s.agent, cash12: s => s.cash12, last: s => s.last },
    { key: 'cash12', dir: 'desc' },
    ['store', 'city', 'agent'],
  )
  const agentRows = useMemo(() => {
    const m = new Map<string, { agent: string; stores: number; cash12: number }>()
    for (const st of stores.data ?? []) {
      const key = st.agent ?? ''
      const e = m.get(key) ?? { agent: key, stores: 0, cash12: 0 }
      e.stores += 1
      e.cash12 += st.cash12 ?? 0
      m.set(key, e)
    }
    const total = [...m.values()].reduce((a, e) => a + e.cash12, 0)
    return [...m.values()].map(e => ({ ...e, share: total > 0 ? e.cash12 / total : 0 }))
  }, [stores.data])
  const agentSort = useSortedRows(
    agentRows,
    { agent: a => a.agent, stores: a => a.stores, cash12: a => a.cash12, share: a => a.share },
    { key: 'cash12', dir: 'desc' },
    ['agent'],
  )
  const hitSort = useSortedRows(
    allHits,
    { client: h => h.name || h.id, city: h => h.city, agent: h => h.agent, cash12: h => h.cash12, last: h => h.last },
    null,
    ['client', 'city', 'agent'],
  )
  const reasonSort = useSortedRows(
    credit.data?.reasons,
    { reason: r => `${r.code} ${r.text}`, cash: r => r.cash, lines: r => r.lines, share: r => r.cash, counts: r => r.counts },
    { key: 'cash', dir: 'desc' },
    ['reason'],
  )
  const yearSort = useSortedRows(
    yearRows,
    {
      margin: y => y.margin,
      marginPct: y => y.marginPct,
      year: y => y.y,
      sold: y => y.sold,
      returned: y => y.returned,
      rate: y => returnRate(y.sold, y.returned),
      qty: y => y.qty,
    },
    { key: 'year', dir: 'desc' },
  )
  const charts = useMemo(() => {
    if (!data) return null
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const now = new Date()
    const keys = lastMonthKeys(now.getFullYear(), now.getMonth() + 1, 24)
    const cashOf = new Map(data.months.map(m => [m.y * 12 + m.m, m.cash]))
    const marginOfMonth = new Map((marginData?.months ?? []).map(m => [m.y * 12 + m.m, marginOf(m).margin]))
    const monthly: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: keys.map(k => `${monthNames[k.m - 1]} ${String(k.y).slice(2)}`),
        datasets: [
          { label: t('pc.kpi.netCash'), data: keys.map(k => cashOf.get(k.y * 12 + k.m) ?? 0), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 },
          ...(hasM
            ? [{ label: t('gm.chart.margin'), data: keys.map(k => marginOfMonth.get(k.y * 12 + k.m) ?? 0), backgroundColor: cssVar('--chart-c4'), borderRadius: 3 }]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: hasM } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
          y: { ticks: { color: muted, callback: v => fmtK(Number(v)) }, grid: { color: grid }, beginAtZero: true },
        },
      },
    }
    const brands: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: data.topBrands.map(b => b.brand),
        datasets: [{ data: data.topBrands.map(b => b.cash), backgroundColor: cssVar('--chart-c1'), borderRadius: 3, barPercentage: 0.78 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, callback: v => fmtK(Number(v)) }, grid: { color: grid }, beginAtZero: true },
          y: { ticks: { color: muted }, grid: { display: false } },
        },
      },
    }
    return { monthly, brands }
  }, [data, marginData, hasM, t, monthNames])

  if (!company) return <p className="status-msg">{t('pc.noCompanies')}</p>

  const pick = (id: string) => setParams({ co: company, id })
  const rate = data ? returnRate(data.sold12, data.returned12) : null
  const since = data ? daysSince(data.last) : null

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('pc.client.title')}</h2>
      <PurchaseSearchBar
        companies={companies}
        company={company}
        onCompany={c => setParams({ co: c })}
        query={query}
        onQuery={setQuery}
        placeholder={t('pc.client.placeholder')}
      />

      {!clientId || !data ? (
        <>
          {hits.isLoading ? <p className="status-msg">{t('pc.searching')}</p> : null}
          {hits.error ? <p className="status-msg error">{(hits.error as Error).message}</p> : null}
          {hits.data && !allHits.length && !chainRows.length ? <p className="status-msg">{t('pc.client.noMatch')}</p> : null}
          {card.isLoading ? <p className="status-msg">{t('pc.client.loading')}</p> : null}
          {card.error ? <p className="status-msg error">{(card.error as Error).message}</p> : null}
          {chainRows.length ? (
            <>
              <h3 style={{ margin: '4px 0 8px' }}>{t('pc.client.chains')}</h3>
              <div className="tw" style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <SortTh label={t('pc.col.chain')} k="chain" left sort={chainSort.sort} onSort={chainSort.onSort} />
                      <SortTh label={t('pc.col.stores')} k="stores" sort={chainSort.sort} onSort={chainSort.onSort} />
                      <SortTh label={t('pc.col.netCashL12')} k="cash12" sort={chainSort.sort} onSort={chainSort.onSort} />
                      <SortTh label={t('pc.col.lastBought')} k="last" sort={chainSort.sort} onSort={chainSort.onSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {chainSort.sorted.map(c => (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => pick(c.id)}>
                        <td style={{ textAlign: 'left' }}>
                          <a
                            href={`?co=${company}&id=${encodeURIComponent(c.id)}`}
                            onClick={e => {
                              e.preventDefault()
                              pick(c.id)
                            }}
                          >
                            {c.name}
                          </a>
                        </td>
                        <td>{c.stores}</td>
                        <td>{c.cash12 != null ? fmt0(c.cash12) : '—'}</td>
                        <td>{c.last ? fmtDate(c.last) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allHits.length ? <h3 style={{ margin: '4px 0 8px' }}>{t('pc.client.clients')}</h3> : null}
            </>
          ) : null}
          {allHits.length ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <SortTh label={t('pc.col.client')} k="client" left sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.city')} k="city" left sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.agent')} k="agent" sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.netCashL12')} k="cash12" sort={hitSort.sort} onSort={hitSort.onSort} />
                    <SortTh label={t('pc.col.lastBought')} k="last" sort={hitSort.sort} onSort={hitSort.onSort} />
                  </tr>
                </thead>
                <tbody>
                  {hitSort.sorted.map(h => (
                    <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => pick(h.id)}>
                      <td style={{ textAlign: 'left' }}>
                        <a
                          href={`?co=${company}&id=${encodeURIComponent(h.id)}`}
                          onClick={e => {
                            e.preventDefault()
                            pick(h.id)
                          }}
                        >
                          {h.name || h.id}
                        </a>{' '}
                        <small>{h.id}</small>
                      </td>
                      <td style={{ textAlign: 'left' }}>{h.city ?? ''}</td>
                      <td>{h.agent ?? '—'}</td>
                      <td>{h.cash12 != null ? fmt0(h.cash12) : '—'}</td>
                      <td>{h.last ? fmtDate(h.last) : '—'}</td>
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
            <h3 style={{ margin: 0 }}>{data.client.name || data.client.id}</h3>
            <small>
              {data.client.isChain ? t('pc.client.chainSub', { n: data.client.stores ?? 0 }) : data.client.id}
              {data.client.city ? ` · ${data.client.city}` : ''}
              {data.client.agent ? t('pc.client.agentSub', { a: data.client.agent }) : ''}
              {data.client.chain ? t('pc.client.chainOf', { c: data.client.chain }) : ''}
              {data.client.intergroup ? t('pc.client.groupCo') : ''}
            </small>
            <button type="button" className="chip" onClick={() => setParams({ co: company })}>
              {t('pc.client.other')}
            </button>
            {!data.client.isChain && ownChain.data ? (
              <button type="button" className="chip" onClick={() => setParams({ co: company, id: ownChain.data!.id })}>
                {t('pc.client.wholeChain', { name: ownChain.data.name, n: ownChain.data.stores })}
              </button>
            ) : null}
            {data.client.isChain ? (
              <small>{t('pc.client.chainNote')}</small>
            ) : null}
          </div>

          <div className="hub-grid">
            <Kpi label={t('pc.kpi.netCash12')} value={fmt0(data.sold12 - data.returned12)} note={t('pc.client.soldReturned', { sold: fmt0(data.sold12), ret: fmt0(data.returned12) })} tone="grn" />
            <Kpi
              label={t('pc.kpi.returnRate')}
              value={rate == null ? '—' : `${(rate * 100).toFixed(1)}%`}
              hint={t('pc.client.rateHint')}
              note={
                credit.data && credit.data.credits12 > 0
                  ? (() => {
                      const c = credit.data
                      const pct = (v: number) => `${Math.round((v / c.credits12) * 100)}%`
                      const clean = rateWithoutReissue(data.sold12, data.returned12, c.reissued12)
                      return t('pc.client.rateNote', { a: pct(c.reverses12), b: pct(c.reissued12), c: pct(c.other12), clean: clean == null ? '' : t('pc.client.withoutReissued', { p: (clean * 100).toFixed(1) }), excl: c.excluded12 > 0 ? t('pc.client.notCounted', { n: fmt0(c.excluded12) }) : '' })
                    })()
                  : t('pc.client.rateDefault')
              }
              tone={rate != null && rate > 0.15 ? 'amber' : undefined}
            />
            <Kpi label={t('pc.client.docs12')} value={fmt0(data.docs12)} note={data.first ? t('pc.client.firstPurchase', { date: fmtDate(data.first) }) : undefined} />
            {hasM ? (
              <Kpi
                label={t('gm.kpi.margin') + ' — ' + '12m'}
                value={margin12.margin == null ? '—' : fmt0(margin12.margin)}
                note={margin12.pct == null ? t('gm.coverageNone') : t('gm.kpi.marginSub', { pct: fmtPct(margin12.pct) })}
                hint={t('gm.hint')}
                tone={margin12.margin != null && margin12.margin < 0 ? 'amber' : undefined}
              />
            ) : null}
            <Kpi label={t('pc.client.lastPurchase')} value={since == null ? '—' : t('pc.client.daysAgo', { n: since })} note={data.last ? fmtDate(data.last) : undefined} tone={since != null && since > 90 ? 'amber' : undefined} />

            {vs.data ? (
              <>
                <Kpi
                  label={t('pc.client.netCashThrough', { through: throughLabel(vs.data.throughMonth, monthNames) })}
                  value={fmt0(vs.data.cy.sold - vs.data.cy.returned)}
                  note={t('pc.kpi.lastYearChange', { ly: fmt0(vs.data.ly.sold - vs.data.ly.returned), chg: changeLabel(vs.data.cy.sold - vs.data.cy.returned, vs.data.ly.sold - vs.data.ly.returned, t('pc.new')) })}
                  tone={vs.data.cy.sold - vs.data.cy.returned >= vs.data.ly.sold - vs.data.ly.returned ? 'grn' : 'amber'}
                  hint={t('pc.client.netCashHint', { y: vs.data.year, py: vs.data.prevYear })}
                />
                <Kpi
                  label={t('pc.client.rateThrough', { through: throughLabel(vs.data.throughMonth, monthNames) })}
                  value={(() => {
                    const r = returnRate(vs.data.cy.sold, vs.data.cy.returned)
                    return r == null ? '—' : `${(r * 100).toFixed(1)}%`
                  })()}
                  note={(() => {
                    const r = returnRate(vs.data.ly.sold, vs.data.ly.returned)
                    return t('pc.kpi.lastYearRate', { r: r == null ? '—' : `${(r * 100).toFixed(1)}%` })
                  })()}
                />
              </>
            ) : null}

            {hasM ? (
              <div className="hub-span-12">
                <MarginNote visible coverage={margin12.coverage} />
              </div>
            ) : null}
            <section className="hub-card hub-span-8">
              <div className="hub-card-hdr"><h3>{t('pc.client.netCashByMonth')}</h3></div>
              {charts ? <HubChart config={charts.monthly} height={240} label={t('pc.client.netCashAria')} minWidth={560} /> : null}
            </section>
            <section className="hub-card hub-span-4">
              <div className="hub-card-hdr"><h3>{t('pc.client.brands12')}</h3></div>
              {charts && data.topBrands.length ? (
                <HubChart config={charts.brands} height={Math.max(160, data.topBrands.length * 30)} label={t('pc.client.brandsAria')} />
              ) : (
                <p className="status-msg">{t('pc.client.noPurch12')}</p>
              )}
            </section>

            {vs.data ? (
              <>
                <section className="hub-card hub-span-6">
                  <div className="hub-card-hdr">
                    <h3>{t('pc.client.brandsVs')}</h3>
                    <span className="hub-card-aside">{t('pc.client.brandsVsAside', { through: throughLabel(vs.data.throughMonth, monthNames), y: vs.data.year, py: vs.data.prevYear })}</span>
                  </div>
                  <ComparisonTable
                    head={t('pc.col.brand')}
                    cyLabel={String(vs.data.year)}
                    lyLabel={String(vs.data.prevYear)}
                    empty={t('pc.noPurchEither')}
                    rows={vs.data.brands.map(b => ({ key: b.brand, label: b.brand, text: b.brand, cy: b.cy, ly: b.ly }))}
                  />
                </section>
                <section className="hub-card hub-span-6">
                  <div className="hub-card-hdr">
                    <h3>{t('pc.client.itemsVs')}</h3>
                    <span className="hub-card-aside">{t('pc.client.itemsVsAside')}</span>
                  </div>
                  <ComparisonTable
                    head={t('pc.col.item')}
                    cyLabel={String(vs.data.year)}
                    lyLabel={String(vs.data.prevYear)}
                    empty={t('pc.noPurchEither')}
                    rows={vs.data.items.map(i => ({
                      key: i.sku,
                      label: (
                        <span title={i.name}>
                          <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(i.sku)}`}>{i.sku}</Link> · {i.name}
                        </span>
                      ),
                      text: `${i.sku} ${i.name}`,
                      cy: i.cy,
                      ly: i.ly,
                    }))}
                  />
                </section>
              </>
            ) : null}

            {data.client.isChain ? (
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr">
                  <h3>{t('pc.client.byAgent')}</h3>
                  <span className="hub-card-aside">{t('pc.client.byAgentAside')}</span>
                </div>
                {agentRows.length ? (
                  <div className="tw">
                    <table>
                      <thead>
                        <tr>
                          <SortTh label={t('pc.col.agent')} k="agent" left sort={agentSort.sort} onSort={agentSort.onSort} />
                          <SortTh label={t('pc.col.stores')} k="stores" sort={agentSort.sort} onSort={agentSort.onSort} />
                          <SortTh label={t('pc.col.netCashL12')} k="cash12" sort={agentSort.sort} onSort={agentSort.onSort} />
                          <SortTh label={t('pc.col.share')} k="share" sort={agentSort.sort} onSort={agentSort.onSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {agentSort.sorted.map(a => (
                          <tr key={a.agent || 'none'}>
                            <td style={{ textAlign: 'left' }}>{a.agent || t('pc.noAgent')}</td>
                            <td>{a.stores}</td>
                            <td>{fmt0(a.cash12)}</td>
                            <td>{`${(a.share * 100).toFixed(1)}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="status-msg">{stores.isLoading ? t('pc.client.loadingStores') : t('pc.client.noStores')}</p>
                )}
              </section>
            ) : null}

            {data.client.isChain ? (
              <section className="hub-card hub-span-12">
                <div className="hub-card-hdr">
                  <h3>{t('pc.client.storesTitle')}</h3>
                  <span className="hub-card-aside">{t('pc.client.storesAside')}</span>
                </div>
                {stores.data && stores.data.length ? (
                  <div className="tw">
                    <table>
                      <thead>
                        <tr>
                          <SortTh label={t('pc.col.store')} k="store" left sort={storeSort.sort} onSort={storeSort.onSort} />
                          <SortTh label={t('pc.col.city')} k="city" left sort={storeSort.sort} onSort={storeSort.onSort} />
                          <SortTh label={t('pc.col.agent')} k="agent" sort={storeSort.sort} onSort={storeSort.onSort} />
                          <SortTh label={t('pc.col.netCashL12')} k="cash12" sort={storeSort.sort} onSort={storeSort.onSort} />
                          <SortTh label={t('pc.col.lastBought')} k="last" sort={storeSort.sort} onSort={storeSort.onSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {storeSort.sorted.map(s => (
                          <tr key={s.id}>
                            <td style={{ textAlign: 'left' }}>
                              <a
                                href={`?co=${company}&id=${encodeURIComponent(s.id)}`}
                                onClick={e => {
                                  e.preventDefault()
                                  pick(s.id)
                                }}
                              >
                                {s.name || s.id}
                              </a>{' '}
                              <small>{s.id}</small>
                            </td>
                            <td style={{ textAlign: 'left' }}>{s.city ?? ''}</td>
                            <td>{s.agent ?? '—'}</td>
                            <td>{s.cash12 != null ? fmt0(s.cash12) : '—'}</td>
                            <td>{s.last ? fmtDate(s.last) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="status-msg">{stores.isLoading ? t('pc.client.loadingStores') : t('pc.client.noStores')}</p>
                )}
              </section>
            ) : null}

            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>{t('pc.client.searchSales')}</h3>
                <span className="hub-card-aside">{t('pc.client.searchSalesAside')}</span>
              </div>
              <ClientItemSales company={company} clientId={clientId} asUser={asUser} />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>{t('pc.client.topItems')}</h3></div>
              <ItemRows rows={data.topItems} company={company} empty={t('pc.client.noPurch12')} margins={marginData?.topItems} />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>{t('pc.stopped')}</h3>
                <span className="hub-card-aside">{t('pc.stoppedAside')}</span>
              </div>
              <ItemRows rows={data.stopped} company={company} empty={t('pc.client.noStopped')} margins={marginData?.stopped} />
            </section>
            <ReturnsDetail company={company} target={{ clientId }} asUser={asUser} />

            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>{t('pc.client.whyReturn')}</h3>
                <span className="hub-card-aside">{t('pc.client.whyReturnAside')}</span>
              </div>
              {credit.data && credit.data.reasons.length ? (
                <>
                  <p className="sel-months-list" style={{ margin: '0 0 8px' }}>
                    {t('pc.client.reasonKnown', { p: Math.round((credit.data.withReason12 / Math.max(1, credit.data.credits12)) * 100) })}
                  </p>
                  <div className="tw">
                    <table>
                      <thead>
                        <tr>
                          <SortTh label={t('pc.col.reason')} k="reason" left sort={reasonSort.sort} onSort={reasonSort.onSort} />
                          <SortTh label={t('pc.col.cash')} k="cash" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                          <SortTh label={t('pc.col.lines')} k="lines" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                          <SortTh label={t('pc.col.shareKnown')} k="share" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                          <SortTh label={t('pc.col.countsReturn')} k="counts" sort={reasonSort.sort} onSort={reasonSort.onSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {reasonSort.sorted.map(r => (
                          <tr key={r.code}>
                            <td style={{ textAlign: 'left' }}>
                              {r.code} · {r.text}
                            </td>
                            <td>{fmt0(r.cash)}</td>
                            <td>{r.lines}</td>
                            <td>{Math.round((r.cash / Math.max(1, credit.data!.withReason12)) * 100)}%</td>
                            <td>{r.counts ? t('pc.yes') : t('pc.no')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="status-msg">{t('pc.client.noReasons')}</p>
              )}
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>{t('pc.client.byYear')}</h3></div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <SortTh label={t('pc.col.year')} k="year" left sort={yearSort.sort} onSort={yearSort.onSort} />
                      <SortTh label={t('pc.col.sold')} k="sold" sort={yearSort.sort} onSort={yearSort.onSort} />
                      {hasM ? <SortTh label={t('gm.col.margin')} k="margin" sort={yearSort.sort} onSort={yearSort.onSort} title={t('gm.hint')} /> : null}
                      {hasM ? <SortTh label={t('gm.col.marginPct')} k="marginPct" sort={yearSort.sort} onSort={yearSort.onSort} title={t('gm.hint')} /> : null}
                      <SortTh label={t('pc.col.returned')} k="returned" sort={yearSort.sort} onSort={yearSort.onSort} />
                      <SortTh label={t('pc.col.returnRate')} k="rate" sort={yearSort.sort} onSort={yearSort.onSort} />
                      <SortTh label={t('pc.col.netPieces')} k="qty" sort={yearSort.sort} onSort={yearSort.onSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {yearSort.sorted.map(y => {
                      const r = returnRate(y.sold, y.returned)
                      return (
                        <tr key={y.y}>
                          <td style={{ textAlign: 'left' }}>{y.y}</td>
                          <td>{fmt0(y.sold)}</td>
                          {hasM ? <td>{y.margin == null ? '—' : fmt0(y.margin)}</td> : null}
                          {hasM ? <td>{fmtPct(y.marginPct)}</td> : null}
                          <td>{fmt0(y.returned)}</td>
                          <td>{r == null ? '—' : `${(r * 100).toFixed(1)}%`}</td>
                          <td>{fmt0(y.qty)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
