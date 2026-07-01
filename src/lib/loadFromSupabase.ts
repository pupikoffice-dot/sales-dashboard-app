import { supabase } from './supabase'
import type {
  CostRow,
  DashboardData,
  DebtRow,
  PriceRow,
  SalesRow,
  WmsRow,
} from '../types/dashboard'

/**
 * Loads the dashboard payload from Supabase in the same shape the legacy
 * data_loader.js blob produced, so no downstream component changes.
 *
 * Sales rows come from get_dashboard_sales_after (keyset/cursor pagination,
 * access-filtered, tag-mapped in SQL); debt/stock/cost/price from
 * get_dashboard_aux. Both RPCs are SECURITY DEFINER and enforce the caller's
 * dashboard_user_access (companies, agents, show_item_cost, show_client_profit)
 * server-side. Keyset paging (id > cursor) keeps every page a fast index seek
 * regardless of depth, unlike OFFSET which re-scans on each page.
 */
const PAGE_SIZE = 25000

interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
}

interface SalesPage {
  rows?: SalesRow[]
  last_id?: number | null
}

export async function loadDashboardDataFromSupabase(): Promise<DashboardData> {
  const rows: SalesRow[] = []
  let afterId = 0
  // Cursor through sales rows until a short page (or null cursor) signals the end.
  for (;;) {
    const { data, error } = await supabase.rpc('get_dashboard_sales_after', {
      p_after_id: afterId,
      p_limit: PAGE_SIZE,
    })
    if (error) throw new Error(`get_dashboard_sales_after failed: ${error.message}`)
    const page = (data ?? {}) as SalesPage
    const pageRows = page.rows ?? []
    rows.push(...pageRows)
    if (pageRows.length < PAGE_SIZE || page.last_id == null) break
    afterId = page.last_id
  }

  const { data: auxData, error: auxError } = await supabase.rpc('get_dashboard_aux')
  if (auxError) throw new Error(`get_dashboard_aux failed: ${auxError.message}`)
  const aux = (auxData ?? {}) as AuxPayload

  return {
    generated: new Date().toISOString(),
    totalRows: rows.length,
    rows,
    debtRows: aux.debtRows ?? [],
    wmsRows: aux.wmsRows ?? [],
    costRows: aux.costRows ?? [],
    priceRows: aux.priceRows ?? [],
    debtLastUpdate: aux.debtLastUpdate || undefined,
  }
}
