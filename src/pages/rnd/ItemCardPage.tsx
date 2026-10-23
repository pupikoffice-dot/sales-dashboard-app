import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { Kpi, PurchaseSearchBar, useDebounced } from '../../components/rnd/PurchaseSearch'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { fmt0 } from '../../lib/format'
import {
  daysSince,
  fetchItemCard,
  lastMonthKeys,
  monthsOfCover,
  MOVE_LABEL,
  returnRate,
  searchItems,
  type ItemCardClient,
} from '../../lib/purchaseCards'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ClientRows({ rows, company, empty }: { rows: ItemCardClient[]; company: string; empty: string }) {
  if (!rows.length) return <p className="status-msg">{empty}</p>
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Client</th>
            <th>Pieces</th>
            <th>Cash</th>
            <th>Months bought</th>
            <th>Last bought</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ textAlign: 'left' }} title={r.name}>
                <Link to={`/rnd/client?co=${company}&id=${encodeURIComponent(r.id)}`}>{r.name || r.id}</Link> <small>{r.id}</small>
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

/** R&D → Item card: who buys one item, how fast it sells, how long the stock lasts. Needs the Purchase insights module. */
export function ItemCardPage() {
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

  const data = card.data
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
        labels: keys.map(k => `${MONTH_SHORT[k.m - 1]} ${String(k.y).slice(2)}`),
        datasets: [
          { label: 'Sold', data: keys.map(k => byKey.get(k.y * 12 + k.m)?.sold ?? 0), backgroundColor: cssVar('--chart-c0'), borderRadius: 3 },
          { label: 'Returned', data: keys.map(k => byKey.get(k.y * 12 + k.m)?.returned ?? 0), backgroundColor: cssVar('--chart-c3'), borderRadius: 3 },
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
    const stock: ChartConfiguration = {
      type: 'line',
      data: {
        labels: data.stockDaily.map(d => d.day.slice(5)),
        datasets: [
          {
            label: 'Pieces in stock (end of day)',
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
    return { monthly, stock }
  }, [data])

  if (!company) return <p className="status-msg">No companies available.</p>

  const pick = (s: string) => setParams({ co: company, sku: s })
  const rate = data ? returnRate(data.sold12, data.returned12) : null
  const cover = data ? monthsOfCover(data.stock, data.sold3) : null
  const since = data ? daysSince(data.last) : null

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>R&amp;D — Item card</h2>
      <PurchaseSearchBar
        companies={companies}
        company={company}
        onCompany={c => setParams({ co: c })}
        query={query}
        onQuery={setQuery}
        placeholder="🔍 SKU, name or barcode…"
      />

      {!sku || !data ? (
        <>
          {hits.isLoading ? <p className="status-msg">Searching…</p> : null}
          {hits.error ? <p className="status-msg error">{(hits.error as Error).message}</p> : null}
          {hits.data && !hits.data.length ? <p className="status-msg">No items match.</p> : null}
          {card.isLoading ? <p className="status-msg">Loading the item…</p> : null}
          {card.error ? <p className="status-msg error">{(card.error as Error).message}</p> : null}
          {hits.data?.length ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Item</th>
                    <th>Pieces, last 12 months</th>
                    <th>Net cash, last 12 months</th>
                    <th>Clients</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.data.map(h => (
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
              ← Other item
            </button>
          </div>

          {data.scoped ? (
            <p className="sel-months-list" style={{ margin: '0 0 8px' }}>
              Your clients only: sales, returns and clients count the clients you look after. Stock and arrivals are the whole warehouse.
            </p>
          ) : null}
          <div className="hub-grid">
            <Kpi label="In stock now" value={fmt0(data.stock)} note={cover == null ? 'no sales in the last 3 months' : `about ${cover.toFixed(1)} months at the last 3 months pace`} tone={cover != null && cover < 1 ? 'amber' : undefined} />
            <Kpi label="Sold, last 12 months" value={fmt0(data.sold12)} note={`${fmt0(data.sold3)} net in the last 3 months`} tone="grn" />
            <Kpi label="Return rate" value={rate == null ? '—' : `${(rate * 100).toFixed(1)}%`} note={`${fmt0(data.returned12)} pieces came back`} tone={rate != null && rate > 0.15 ? 'amber' : undefined} />
            <Kpi label="Clients, last 12 months" value={fmt0(data.clients12)} note={since == null ? undefined : `last sale ${since} days ago (${data.last})`} />

            <section className="hub-card hub-span-8">
              <div className="hub-card-hdr"><h3>Pieces sold and returned — 24 months</h3></div>
              {charts ? <HubChart config={charts.monthly} height={240} label="Sold and returned by month" minWidth={560} /> : null}
            </section>
            <section className="hub-card hub-span-4">
              <div className="hub-card-hdr"><h3>Stock — last 150 days</h3></div>
              {charts && data.stockDaily.length ? (
                <HubChart config={charts.stock} height={240} label="Stock by day" minWidth={420} />
              ) : (
                <p className="status-msg">No stock history for this item.</p>
              )}
            </section>

            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>Top clients — last 12 months</h3></div>
              <ClientRows rows={data.topClients} company={company} empty="Nobody bought it in the last 12 months." />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr">
                <h3>Stopped buying</h3>
                <span className="hub-card-aside">bought in 3+ different months of the year before, none in the last 3 months</span>
              </div>
              <ClientRows rows={data.stopped} company={company} empty="No regular client has stopped buying it." />
            </section>
            <section className="hub-card hub-span-12">
              <div className="hub-card-hdr"><h3>Latest arrivals (imports and local purchases)</h3></div>
              {data.moves.length ? (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Date</th>
                        <th style={{ textAlign: 'left' }}>Type</th>
                        <th>Pieces</th>
                        <th style={{ textAlign: 'left' }}>Document</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.moves.map((m, i) => (
                        <tr key={`${m.date}|${m.doc}|${i}`}>
                          <td style={{ textAlign: 'left' }}>{m.date}</td>
                          <td style={{ textAlign: 'left' }}>{MOVE_LABEL[m.kind] ?? m.kind}</td>
                          <td>{fmt0(m.qty)}</td>
                          <td style={{ textAlign: 'left' }}>{m.doc ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="status-msg">No purchase documents recorded for this item this year.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
