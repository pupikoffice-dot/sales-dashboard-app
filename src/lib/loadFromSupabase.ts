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
 * Sales rows come from get_dashboard_sales_page (paginated, access-filtered,
 * tag-mapped in SQL); debt/stock/cost/price from get_dashboard_aux. Both RPCs
 * are SECURITY DEFINER and enforce the caller's dashboard_user_access
 * (companies, agents, show_item_cost, show_client_profit) server-side.
 */
const PAGE_SIZE = 20000

interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
}

export async function loadDashboardDataFromSupabase(): Promise<DashboardData> {
  const rows: SalesRow[] = []
  let offset = 0
  // Page through sales rows until a short page signals the end.
  for (;;) {
    const { data, error } = await supabase.rpc('get_dashboard_sales_page', {
      p_offset: offset,
      p_limit: PAGE_SIZE,
    })
    if (error) throw new Error(`get_dashboard_sales_page failed: ${error.message}`)
    const page = (data ?? []) as SalesRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
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
