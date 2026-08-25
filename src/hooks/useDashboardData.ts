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

const EMPTY_SALES_ROWS: SalesRow[] = []
const EMPTY_DEBT_ROWS: DebtRow[] = []

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
  //   * receiptsMonthly (company totals): blank in preview — classic Oversight
  //     would otherwise show full-company receipts.
  //   * receiptsMonthlyByAgent: keep but trim to the preview user's companies
  //     + agents so Sales Manager suite View-as still works without leaking.
  //   * cost/price: blanked unless the preview target has those field flags.
  const maskPreview = isPreviewing && !effectiveIsSuperAdmin
  const data = useMemo(() => {
    if (!maskPreview || !q.data || !access) return q.data
    const allowedCo = new Set(access.companies.map(String))
    const agentSet =
      Array.isArray(access.agents) && access.agents.length > 0
        ? new Set(access.agents.map(String))
        : null
    const src = q.data.receiptsMonthlyByAgent ?? {}
    const filtered: Record<string, Record<string, Record<string, number>>> = {}
    for (const [co, agents] of Object.entries(src)) {
      if (!allowedCo.has(co)) continue
      const nextAgents: Record<string, Record<string, number>> = {}
      for (const [agent, months] of Object.entries(agents || {})) {
        if (agentSet && !agentSet.has(agent)) continue
        nextAgents[agent] = months
      }
      if (Object.keys(nextAgents).length) filtered[co] = nextAgents
    }
    return {
      ...q.data,
      receiptsMonthly: {},
      receiptsMonthlyByAgent: filtered,
    }
  }, [q.data, maskPreview, access])

  const allRows: SalesRow[] = data?.rows ?? EMPTY_SALES_ROWS
  const filterIndex = data?.filterIndex
  // Access-scoped slices MUST be memoised — suite/BI memos and classic metrics
  // depend on stable identity. Rebuilding on every render invalidates them.
  const rows = useMemo(
    () => (access ? filterRows(access, allRows) : EMPTY_SALES_ROWS),
    [access, allRows],
  )
  const allDebtRows = useMemo(
    () => normalizeDebtRows(data?.debtRows),
    [data?.debtRows],
  )
  const debtRows = useMemo(
    () => (access ? filterDebtRows(access, allDebtRows) : EMPTY_DEBT_ROWS),
    [access, allDebtRows],
  )
  // These MUST be memoised. They are passed as props and used as effect
  // dependencies (e.g. the batched report builder in LargeClientsItemsReport);
  // rebuilding them on every render gave them a new identity each time, which
  // restarted long-running effects and could stop a large report from ever
  // finishing.
  const { wmsStock, wmsNames } = useMemo(() => buildWmsMaps(data?.wmsRows), [data?.wmsRows])
  const itemCost = useMemo(
    () =>
      buildItemCostMap(
        maskPreview && access?.showItemCost !== true ? undefined : data?.costRows,
      ),
    [data?.costRows, maskPreview, access?.showItemCost],
  )
  const itemPrice = useMemo(
    () =>
      buildItemPriceMap(
        maskPreview && access?.showClientProfit !== true ? undefined : data?.priceRows,
      ),
    [data?.priceRows, maskPreview, access?.showClientProfit],
  )
  const companiesKey = access?.companies?.join(',') ?? ''
  const dataHealth = useMemo(
    () => checkOrdersDataHealth(allRows, access?.companies ?? []),
    [allRows, companiesKey],
  )

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
