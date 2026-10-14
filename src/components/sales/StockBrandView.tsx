import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
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
  const buildPie = (metric: 'units' | 'value'): ChartConfiguration | null => {
    const slices = pieSlices(visible, 9, 'Other', metric)
    if (!slices.length) return null
    const total = slices.reduce((s, x) => s + x.units, 0) || 1
    const base = [0, 1, 2, 3, 4, 5].map(i => cssVar(`--chart-c${i}`))
    const colour = (i: number) => (i < base.length ? base[i] : `hsl(${(i * 47) % 360} 55% 58%)`)
    const narrow = typeof window !== 'undefined' && window.innerWidth < 700
    return {
      type: 'doughnut',
      data: {
        labels: slices.map(s => s.label),
        datasets: [
          {
            data: slices.map(s => s.units),
            backgroundColor: slices.map((_, i) => colour(i)),
            borderColor: cssVar('--sur', '#1b2236'),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: 0,
        plugins: {
          legend: { position: narrow ? 'bottom' : 'right', labels: { color: cssVar('--txt'), boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: c =>
                `${c.label}: ${fmt0(Number(c.parsed))}${metric === 'units' ? ' units' : ''} (${((Number(c.parsed) / total) * 100).toFixed(1)}%)`,
            },
          },
        },
      },
    } as ChartConfiguration
  }
  const pieUnits = useMemo(() => buildPie('units'), [visible])
  const pieValue = useMemo(() => (showValueAll ? buildPie('value') : null), [visible, showValueAll])

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
            {pieUnits ? (
              <div className="panel" style={{ padding: 12 }}>
                <h3 className="sb-pie-title">Quantity (units)</h3>
                <HubChart config={pieUnits} height={320} label="Units in stock by brand" />
              </div>
            ) : null}
            {pieValue ? (
              <div className="panel" style={{ padding: 12 }}>
                <h3 className="sb-pie-title">Cash (value at cost)</h3>
                <HubChart config={pieValue} height={320} label="Stock value at cost by brand" />
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
