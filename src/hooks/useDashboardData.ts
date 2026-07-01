import { useQuery } from '@tanstack/react-query'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { filterRows } from '../lib/permissions'
import { filterDebtRows, normalizeDebtRows } from '../lib/debtMetrics'
import { buildItemCostMap, buildItemPriceMap } from '../lib/itemPricing'
import { checkOrdersDataHealth } from '../lib/dataHealth'
import { fetchDashboardLoader } from '../lib/parseDashboardLoader'
import { loadDashboardDataFromSupabase } from '../lib/loadFromSupabase'
import { buildSalesFilterIndex, type SalesFilterIndex } from '../lib/salesFilterIndex'
import { buildWmsMaps } from '../lib/wmsData'
import type { DashboardData, DebtRow, SalesRow } from '../types/dashboard'

declare global {
  interface Window {
    __DASHBOARD_DATA__?: DashboardData
    __DEBT_LAST_UPDATE__?: string
  }
}

interface LoadedDashboardPayload extends DashboardData {
  filterIndex: SalesFilterIndex
}

function resolveDataUrl(base: string, bustCache = false): string {
  if (!bustCache) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}t=${Date.now()}`
}

async function loadFromBlob(): Promise<DashboardData> {
  const base =
    (import.meta.env.DEV && import.meta.env.VITE_DASHBOARD_DATA_URL_DEV) ||
    (import.meta.env.VITE_DASHBOARD_DATA_URL as string)
  if (!base) throw new Error('VITE_DASHBOARD_DATA_URL not set')

  const url = resolveDataUrl(
    base.startsWith('/') ? `${window.location.origin}${base}` : base,
    true,
  )

  if (base.endsWith('.js')) {
    const data = await fetchDashboardLoader(url)
    window.__DASHBOARD_DATA__ = data
    return data
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`)
  return (await res.json()) as DashboardData
}

async function loadDashboardData(): Promise<LoadedDashboardPayload> {
  // Default to the Supabase data path; set VITE_USE_SUPABASE_DATA=false to fall
  // back to the legacy data_loader.js blob during parallel parity testing.
  const useSupabase = (import.meta.env.VITE_USE_SUPABASE_DATA ?? 'true') !== 'false'
  const data = useSupabase ? await loadDashboardDataFromSupabase() : await loadFromBlob()

  if (!data?.rows) throw new Error('Dashboard data missing rows')

  const filterIndex = buildSalesFilterIndex(data.rows)
  return { ...data, filterIndex }
}

export function useDashboardData() {
  const { access } = useDashboardAccess()

  const q = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: loadDashboardData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!access,
  })

  const allRows: SalesRow[] = q.data?.rows ?? []
  const filterIndex = q.data?.filterIndex
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
    filterIndex,
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
