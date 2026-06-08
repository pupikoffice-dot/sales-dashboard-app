import { useQuery } from '@tanstack/react-query'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { filterRows } from '../lib/permissions'
import { filterDebtRows, normalizeDebtRows } from '../lib/debtMetrics'
import { buildItemCostMap, buildItemPriceMap } from '../lib/itemPricing'
import { checkOrdersDataHealth } from '../lib/dataHealth'
import { buildWmsMaps } from '../lib/wmsData'
import type { DashboardData, DebtRow, SalesRow } from '../types/dashboard'

declare global {
  interface Window {
    __DASHBOARD_DATA__?: DashboardData
    __DEBT_LAST_UPDATE__?: string
  }
}

function resolveDataUrl(base: string): string {
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}t=${Date.now()}`
}

async function loadDashboardData(): Promise<DashboardData> {
  const base =
    (import.meta.env.DEV && import.meta.env.VITE_DASHBOARD_DATA_URL_DEV) ||
    (import.meta.env.VITE_DASHBOARD_DATA_URL as string)
  if (!base) throw new Error('VITE_DASHBOARD_DATA_URL not set')

  if (base.endsWith('.js')) {
    document
      .querySelectorAll('script[data-dashboard-loader]')
      .forEach(el => el.remove())
    delete window.__DASHBOARD_DATA__
    delete window.__DEBT_LAST_UPDATE__

    const url = resolveDataUrl(
      base.startsWith('/')
        ? `${window.location.origin}${base}`
        : base,
    )

    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.charset = 'utf-8'
      s.dataset.dashboardLoader = '1'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error(`Failed to load data_loader.js from ${url}`))
      document.head.appendChild(s)
    })
    const d = window.__DASHBOARD_DATA__
    if (!d?.rows) throw new Error('__DASHBOARD_DATA__ missing after script load')
    return d
  }

  const res = await fetch(resolveDataUrl(base))
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`)
  return res.json() as Promise<DashboardData>
}

export function useDashboardData() {
  const { access } = useDashboardAccess()

  const q = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: loadDashboardData,
    staleTime: 5 * 60 * 1000,
    enabled: !!access,
  })

  const allRows: SalesRow[] = q.data?.rows ?? []
  const rows = access ? filterRows(access, allRows) : []
  const allDebtRows: DebtRow[] = normalizeDebtRows(q.data?.debtRows)
  const debtRows = access ? filterDebtRows(access, allDebtRows) : []
  const { wmsStock, wmsNames } = buildWmsMaps(q.data?.wmsRows)
  const itemCost = buildItemCostMap(q.data?.costRows)
  const itemPrice = buildItemPriceMap(q.data?.priceRows)
  const dataHealth = checkOrdersDataHealth(allRows, access?.companies ?? [])

  return {
    ...q,
    allRows,
    rows,
    dataHealth,
    allDebtRows,
    debtRows,
    wmsStock,
    wmsNames,
    itemCost,
    itemPrice,
    debtLastUpdate: q.data?.debtLastUpdate ?? window.__DEBT_LAST_UPDATE__,
  }
}
