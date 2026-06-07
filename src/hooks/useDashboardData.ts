import { useQuery } from '@tanstack/react-query'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { filterRows } from '../lib/permissions'
import { filterDebtRows, normalizeDebtRows } from '../lib/debtMetrics'
import { buildWmsMaps } from '../lib/wmsData'
import type { DashboardData, DebtRow, SalesRow } from '../types/dashboard'

declare global {
  interface Window {
    __DASHBOARD_DATA__?: DashboardData
    __DEBT_LAST_UPDATE__?: string
  }
}

async function loadDashboardData(): Promise<DashboardData> {
  const url = import.meta.env.VITE_DASHBOARD_DATA_URL as string
  if (!url) throw new Error('VITE_DASHBOARD_DATA_URL not set')

  if (url.endsWith('.js')) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.charset = 'utf-8'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load data_loader.js'))
      document.head.appendChild(s)
    })
    const d = window.__DASHBOARD_DATA__
    if (!d?.rows) throw new Error('__DASHBOARD_DATA__ missing after script load')
    return d
  }

  const res = await fetch(url)
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

  return {
    ...q,
    allRows,
    rows,
    allDebtRows,
    debtRows,
    wmsStock,
    wmsNames,
    debtLastUpdate: q.data?.debtLastUpdate ?? window.__DEBT_LAST_UPDATE__,
  }
}
