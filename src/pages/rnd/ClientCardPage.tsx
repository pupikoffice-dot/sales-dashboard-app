import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { Kpi, PurchaseSearchBar, useDebounced } from '../../components/rnd/PurchaseSearch'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import { fmtK } from '../../lib/stockByBrand'
import {
  daysSince,
  fetchClientCard,
  fetchCreditCheck,
  lastMonthKeys,
  rateWithoutReissue,
  returnRate,
  searchClients,
  type ClientCardItem,
} from '../../lib/purchaseCards'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ItemRows({ rows, company, empty }: { rows: ClientCardItem[]; company: string; empty: string }) {
  if (!rows.length) return <p className="status-msg">{empty}</p>
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Item</th>
            <th>Pieces</th>
            <th>Cash</th>
            <th>Months bought</th>
            <th>Last bought</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sku}>
              <td style={{ textAlign: 'left' }} title={r.name}>
                <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(r.sku)}`}>{r.sku}</Link> · {r.name}
              </td>
              <td>{r.qty != null ? fmt0(r.qty) : '—'}</td>
              <td>{r.cash != null ? fmt0(r.cash) : '—'}</td>
              <td>{r.months}</td>
              <td>{r.last ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** R&D → Client card: what one client buys, how often, what they stopped buying. Needs the Purchase insights module. */
export function ClientCardPage() {
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
  const data = card.data
  const charts = useMemo(() => {
    if (!data) return null
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const now = new Date()
    const keys = lastMonthKeys(now.getFullYear(), now.getMonth() + 1, 24)
    const cashOf = new Map(data.months.map(m => [m.y * 12 + m.m, m.cash]))
    const monthly: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: keys.map(k => `${MONTH_SHORT[k.m - 1]} ${String(k.y).slice(2)}`),
        datasets: [{ label: 'Net cash', data: keys.map(k => cashOf.get(k.y * 12 + k.m) ?? 0), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
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
  }, [data])

  if (!company) return <p className="status-msg">No companies available.</p>

  const pick = (id: string) => setParams({ co: company, id })
  const rate = data ? returnRate(data.sold12, data.returned12) : null
  const since = data ? daysSince(data.last) : null

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>R&amp;D — Client card</h2>
      <PurchaseSearchBar
        companies={companies}
        company={company}
        onCompany={c => setParams({ co: c })}
        query={query}
        onQuery={setQuery}
        placeholder="🔍 Client name or number…"
      />

      {!clientId || !data ? (
        <>
          {hits.isLoading ? <p className="status-msg">Searching…</p> : null}
          {hits.error ? <p className="status-msg error">{(hits.error as Error).message}</p> : null}
          {hits.data && !hits.data.length ? <p className="status-msg">No clients match.</p> : null}
          {card.isLoading ? <p className="status-msg">Loading the client…</p> : null}
          {card.error ? <p className="status-msg error">{(card.error as Error).message}</p> : null}
          {hits.data?.length ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Client</th>
                    <th style={{ textAlign: 'left' }}>City</th>
                    <th>Agent</th>
                    <th>Net cash, last 12 months</th>
                    <th>Last bought</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.data.map(h => (
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
                      <td>{h.last ?? '—'}</td>
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
              {data.client.id}
              {data.client.city ? ` · ${data.client.city}` : ''}
              {data.client.agent ? ` · agent ${data.client.agent}` : ''}
              {data.client.chain ? ` · chain ${data.client.chain}` : ''}
              {data.client.intergroup ? ' · group company' : ''}
            </small>
            <button type="button" className="chip" onClick={() => setParams({ co: company })}>
              ← Other client
            </button>
          </div>

          <div className="hub-grid">
            <Kpi label="Net cash, last 12 months" value={fmt0(data.sold12 - data.returned12)} note={`${fmt0(data.sold12)} sold · ${fmt0(data.returned12)} returned`} tone="grn" />
            <Kpi
              label="Credit notes ÷ invoiced"
              value={rate == null ? '—' : `${(rate * 100).toFixed(1)}%`}
              hint="Credit-note cash (credit invoices and the credit-notes report) divided by invoiced cash, last 12 months. A credit note can be goods returned, a price correction, or an invoice cancelled and issued again; the reports do not say which."
              note={
                credit.data && credit.data.credits12 > 0
                  ? (() => {
                      const c = credit.data
                      const pct = (v: number) => `${Math.round((v / c.credits12) * 100)}%`
                      const clean = rateWithoutReissue(data.sold12, data.returned12, c.reissued12)
                      return `of the credits: ${pct(c.reverses12)} reverse a whole earlier invoice line, ${pct(c.reissued12)} were invoiced again (cancel and reissue), ${pct(c.other12)} other (partial or price)${clean == null ? '' : `. Without the reissued: ${(clean * 100).toFixed(1)}%`}`
                    })()
                  : 'credit notes ÷ invoiced cash, last 12 months'
              }
              tone={rate != null && rate > 0.15 ? 'amber' : undefined}
            />
            <Kpi label="Documents, last 12 months" value={fmt0(data.docs12)} note={data.first ? `first purchase ${data.first}` : undefined} />
            <Kpi label="Last purchase" value={since == null ? '—' : `${since} days ago`} note={data.last ?? undefined} tone={since != null && since > 90 ? 'amber' : undefined} />

            <section className="hub-card hub-span-8">
              <div className="hub-card-hdr"><h3>Net cash by month — 24 months</h3></div>
              {charts ? <HubChart config={charts.monthly} height={240} label="Net cash by month" minWidth={560} /> : null}
            </section>
            <section className="hub-card hub-span-4">
              <div className="hub-card-hdr"><h3>Brands — last 12 months</h3></div>
              {charts && data.topBrands.length ? (
                <HubChart config={charts.brands} height={Math.max(160, data.topBrands.length * 30)} label="Cash by brand" />
              ) : (
                <p className="status-msg">No purchases in the last 12 months.</p>
              )}
            </section>

            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>Top items — last 12 months</h3></div>
              <ItemRows rows={data.topItems} company={company} empty="No purchases in the last 12 months." />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>Stopped buying</h3>
                <span className="hub-card-aside">bought in 3+ different months of the year before, none in the last 3 months</span>
              </div>
              <ItemRows rows={data.stopped} company={company} empty="Nothing the client used to buy regularly has stopped." />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>By year</h3></div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Year</th>
                      <th>Sold</th>
                      <th>Credit notes</th>
                      <th>Credit notes ÷ invoiced</th>
                      <th>Net pieces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.years].reverse().map(y => {
                      const r = returnRate(y.sold, y.returned)
                      return (
                        <tr key={y.y}>
                          <td style={{ textAlign: 'left' }}>{y.y}</td>
                          <td>{fmt0(y.sold)}</td>
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
