import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { usePreview } from '../context/PreviewContext'
import { filterRows } from '../lib/permissions'
import { filterDebtRows, normalizeDebtRows } from '../lib/debtMetrics'
import { buildItemCostMap, buildItemPriceMap } from '../lib/itemPricing'
import { checkOrdersDataHealth } from '../lib/dataHealth'
import { fetchDashboardLoader } from '../lib/parseDashboardLoader'
import { loadDashboardDataFromSupabase } from '../lib/loadFromSupabase'
import { normalizeSalesDate } from '../lib/salesDate'
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

  // Blob path may still carry ISO/datetime/dd-mm dates — normalize once for all KPIs.
  if (!useSupabase) {
    data.rows = data.rows.map(r => {
      const date = normalizeSalesDate(r.date)
      return date && date !== r.date ? { ...r, date } : r
    })
  }

  const filterIndex = buildSalesFilterIndex(data.rows)
  return { ...data, filterIndex }
}

export function useDashboardData() {
  const { access } = useDashboardAccess()
  const { session } = useAuth()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()

  const q = useQuery({
    // Keyed by user id (not just a static string) so cached data from one
    // user's session is never served to a different user in the same tab —
    // AuthContext also clears the whole cache on any user change as a
    // second layer, but a distinct key is the safer primary guard.
    queryKey: ['dashboard-data', session?.user.id ?? null],
    queryFn: loadDashboardData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!access && !!session,
  })

  // The payload was fetched under the REAL session, so while previewing a
  // non-super-admin it can contain things that user could never receive. Mask
  // those before anything renders.
  //   * receipts: get_dashboard_aux gates receiptsMonthly / receiptsMonthlyByAgent
  //     behind is_super_admin() server-side, so a real non-super-admin gets {}.
  //   * cost/price: the server only returns these when the caller's
  //     show_item_cost / show_client_profit are set. The UI also gates them, but
  //     blanking the maps means a missed gate still cannot leak a number.
  const maskPreview = isPreviewing && !effectiveIsSuperAdmin
  const data = useMemo(() => {
    if (!maskPreview || !q.data) return q.data
    return { ...q.data, receiptsMonthly: {}, receiptsMonthlyByAgent: {} }
  }, [q.data, maskPreview])

  const allRows: SalesRow[] = data?.rows ?? []
  const filterIndex = data?.filterIndex
  const rows = access ? filterRows(access, allRows) : []
  const allDebtRows: DebtRow[] = normalizeDebtRows(data?.debtRows)
  const debtRows = access ? filterDebtRows(access, allDebtRows) : []
  const { wmsStock, wmsNames } = buildWmsMaps(data?.wmsRows)
  const itemCost = buildItemCostMap(
    maskPreview && access?.showItemCost !== true ? undefined : data?.costRows,
  )
  const itemPrice = buildItemPriceMap(
    maskPreview && access?.showClientProfit !== true ? undefined : data?.priceRows,
  )
  const dataHealth = checkOrdersDataHealth(allRows, access?.companies ?? [])

  return {
    ...q,
    data,
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
