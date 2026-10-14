import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Chart as ChartJS, ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../oversite/hub/HubChart'
import { SortableTh } from './SortableTh'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt0 } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import { supabase } from '../../lib/supabase'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import {
  brandsForCompany,
  brandTotals,
  companiesWithStock,
  filterBrandRows,
  fmtK,
  maskBrandPayloadForPreview,
  pieSlices,
  type BrandStockPayload,
} from '../../lib/stockByBrand'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { TableWithExport } from './TableWithExport'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

async function fetchStockByBrand(): Promise<BrandStockPayload> {
  const { data, error } = await supabase.rpc('get_stock_by_brand')
  if (error) throw error
  const d = (data ?? {}) as Partial<BrandStockPayload>
  return { rows: d.rows ?? [], showValue: d.showValue === true }
}

function StockBrandContent({ initialCompany }: { initialCompany: LogicalCompany | null }) {
  const { searchQuery, setSearchQuery } = useSalesReportUi()
  const raw = useQuery({ queryKey: ['stock-by-brand'], queryFn: fetchStockByBrand, staleTime: 5 * 60 * 1000 })
  const { access } = useDashboardAccess()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  // "View as user": the fetch used the admin's session, so cut it down to the previewed user's access.
  const data = useMemo(
    () => (raw.data && isPreviewing && !effectiveIsSuperAdmin && access ? maskBrandPayloadForPreview(raw.data, access) : raw.data),
    [raw.data, isPreviewing, effectiveIsSuperAdmin, access],
  )
  const q = { isLoading: raw.isLoading, error: raw.error, data }
  const [picked, setPicked] = useState<string | null>(initialCompany)

  const companies = useMemo(() => companiesWithStock(q.data?.rows ?? [], COMPANY_ORDER), [q.data])
  // One company only = no choice to make; otherwise open on the sidebar company when it has stock.
  const company = companies.length === 1 ? companies[0] : picked && companies.includes(picked) ? picked : companies[0]

  const companyRows = useMemo(() => brandsForCompany(q.data?.rows ?? [], company ?? ''), [q.data, company])
  const visible = useMemo(() => filterBrandRows(companyRows, searchQuery), [companyRows, searchQuery])
  const totals = useMemo(() => brandTotals(visible, q.data?.showValue === true), [visible, q.data])

  const showValueAll = q.data?.showValue === true
  // Horizontal bars: brand name on the left of each bar, the amount (in K) at its end.
  const buildBars = (metric: 'units' | 'value'): { config: ChartConfiguration; height: number } | null => {
    const slices = pieSlices(visible, 14, 'Other', metric)
    if (!slices.length) return null
    const total = slices.reduce((s, x) => s + x.units, 0) || 1
    const txt = cssVar('--txt')
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    const colour = metric === 'units' ? cssVar('--chart-c0') : cssVar('--chart-c1')
    const valueLabels = {
      id: 'barValueLabels',
      afterDatasetsDraw(chart: ChartJS) {
        const { ctx } = chart
        const meta = chart.getDatasetMeta(0)
        ctx.save()
        ctx.fillStyle = txt
        ctx.font = '600 11px sans-serif'
        ctx.textBaseline = 'middle'
        meta.data.forEach((bar, i) => {
          ctx.fillText(fmtK(slices[i].units), (bar as unknown as { x: number }).x + 6, (bar as unknown as { y: number }).y)
        })
        ctx.restore()
      },
    }
    const config = {
      type: 'bar',
      data: {
        labels: slices.map(s => s.label),
        datasets: [{ data: slices.map(s => s.units), backgroundColor: colour, borderRadius: 3, barPercentage: 0.78 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 56 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c =>
                `${fmt0(Number(c.parsed.x))}${metric === 'units' ? ' units' : ''} (${((Number(c.parsed.x) / total) * 100).toFixed(1)}%)`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: muted, callback: v => fmtK(Number(v)) }, grid: { color: grid } },
          y: { ticks: { color: txt, autoSkip: false }, grid: { display: false } },
        },
      },
      plugins: [valueLabels],
    } as ChartConfiguration
    return { config, height: slices.length * 26 + 44 }
  }
  const barsUnits = useMemo(() => buildBars('units'), [visible])
  const barsValue = useMemo(() => (showValueAll ? buildBars('value') : null), [visible, showValueAll])

  if (q.isLoading) {
    return (
      <div className="welcome">
        <div className="spin-wrap">
          <div className="spin" />
        </div>
      </div>
    )
  }
  if (q.error) return <div className="err">Could not load stock by brand: {(q.error as Error).message}</div>
  if (!q.data?.rows.length || !company) return <div className="err">No stock data for your companies.</div>

  const showValue = q.data.showValue
  const totalUnits = totals.units || 1
  const totalValue = totals.value ?? 0

  return (
    <div>
      <div className="sbar">
        <span>
          View: <b>Stock by brand</b>
        </span>
        <span>
          Brands: <b className="accent2">{fmt0(visible.length)}</b>
        </span>
        <span>
          Units: <b className="accent2">{fmt0(totals.units)}</b>
        </span>
        {showValue && totals.value != null ? (
          <span>
            Value at cost: <b className="accent2">{fmt0(totals.value)}</b>
          </span>
        ) : null}
        <div className="sbar-actions">
          {companies.length > 1 ? (
            <select
              className="sbar-search"
              value={company}
              onChange={e => setPicked(e.target.value)}
              aria-label="Company"
            >
              {companies.map(c => (
                <option key={c} value={c}>
                  {companyLabel(c as LogicalCompany)}
                </option>
              ))}
            </select>
          ) : (
            <b>{companyLabel(company as LogicalCompany)}</b>
          )}
          <input
            className="sbar-search"
            type="text"
            placeholder="🔍 Search brand…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!visible.length ? (
        <div className="err">No brands match.</div>
      ) : (
        <>
          <div className="sb-pies">
            {barsUnits ? (
              <div className="panel" style={{ padding: 12 }}>
                <h3 className="sb-pie-title">Quantity (units)</h3>
                <HubChart config={barsUnits.config} height={barsUnits.height} label="Units in stock by brand" />
              </div>
            ) : null}
            {barsValue ? (
              <div className="panel" style={{ padding: 12 }}>
                <h3 className="sb-pie-title">Cash (value at cost)</h3>
                <HubChart config={barsValue.config} height={barsValue.height} label="Stock value at cost by brand" />
              </div>
            ) : null}
          </div>
          <details className="sb-table-toggle">
            <summary>Table by brand</summary>
            <div>
        <TableWithExport exportName="Stock by brand">
          <div className="tw tw-sticky">
            <table>
              <thead>
                <tr>
                  <SortableTh style={{ textAlign: 'left' }}>Brand</SortableTh>
                  <SortableTh>Items</SortableTh>
                  <SortableTh>In stock</SortableTh>
                  <SortableTh className="accent2">Units</SortableTh>
                  <SortableTh>% of units</SortableTh>
                  {showValue && <SortableTh>Value at cost</SortableTh>}
                  {showValue && <SortableTh>% of total cost</SortableTh>}
                </tr>
              </thead>
              <tbody>
                {[...visible]
                  .sort((a, b) => (Number(b.units) || 0) - (Number(a.units) || 0))
                  .map(r => (
                    <tr key={`${r.co}|${r.brand}`}>
                      <td>{r.brand}</td>
                      <td data-sv={r.items}>{fmt0(r.items)}</td>
                      <td data-sv={r.inStock}>{fmt0(r.inStock)}</td>
                      <td data-sv={Number(r.units) || 0} className="accent2">
                        {fmt0(Number(r.units) || 0)}
                      </td>
                      <td data-sv={(Number(r.units) || 0) / totalUnits}>
                        {(((Number(r.units) || 0) / totalUnits) * 100).toFixed(1)}%
                      </td>
                      {showValue && (
                        <td
                          data-sv={r.value ?? ''}
                          title={r.noCost ? `${r.noCost} stocked item(s) without a cost are not counted` : undefined}
                        >
                          {r.value != null ? fmt0(Number(r.value)) : '—'}
                          {r.noCost ? ' *' : ''}
                        </td>
                      )}
                      {showValue && (
                        <td data-sv={totalValue > 0 && r.value != null ? Number(r.value) / totalValue : ''}>
                          {totalValue > 0 && r.value != null ? `${((Number(r.value) / totalValue) * 100).toFixed(1)}%` : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{fmt0(totals.items)}</td>
                  <td>{fmt0(totals.inStock)}</td>
                  <td className="accent2">{fmt0(totals.units)}</td>
                  <td>100%</td>
                  {showValue && <td>{totals.value != null ? fmt0(totals.value) : '—'}</td>}
                  {showValue && <td>{totalValue > 0 ? '100%' : '—'}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
          {showValue && totals.noCost > 0 ? (
            <p className="status-msg" style={{ fontSize: '0.78rem' }}>
              * {fmt0(totals.noCost)} stocked item(s) have no cost on file and are not counted in the value.
            </p>
          ) : null}
        </TableWithExport>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

export function StockBrandView(props: { initialCompany: LogicalCompany | null }) {
  return (
    <SalesReportUiProvider>
      <div id="sales-report">
        <SalesReportStickySetup />
        <StockBrandContent {...props} />
      </div>
    </SalesReportUiProvider>
  )
}
