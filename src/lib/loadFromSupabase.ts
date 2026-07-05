import { supabase } from './supabase'
import type {
  CostRow,
  DashboardData,
  DebtRow,
  PriceRow,
  SalesRow,
  SyncTimes,
  WmsRow,
} from '../types/dashboard'

/**
 * Loads the dashboard payload from Supabase in the same shape the legacy
 * data_loader.js blob produced, so no downstream component changes.
 *
 * Sales rows come from get_dashboard_sales_all (single access-filtered,
 * tag-mapped query); debt/stock/cost/price from get_dashboard_aux. Both RPCs
 * are SECURITY DEFINER and enforce the caller's dashboard_user_access
 * (companies, agents, show_item_cost, show_client_profit) server-side.
 *
 * Data volume is ~213k rows post-cleanup (was ~4M when this was first built),
 * so a single query is sub-second — no pagination/parallelism needed, and
 * skipping it avoids contending with the hourly ETL sync's delete+insert.
 */
interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
  syncTimes?: SyncTimes
}

interface SalesAllPayload {
  rows?: SalesRow[]
}

export async function loadDashboardDataFromSupabase(): Promise<DashboardData> {
  const { data: salesData, error: salesError } = await supabase.rpc('get_dashboard_sales_all')
  if (salesError) throw new Error(`get_dashboard_sales_all failed: ${salesError.message}`)
  const rows = ((salesData ?? {}) as SalesAllPayload).rows ?? []

  const { data: auxData, error: auxError } = await supabase.rpc('get_dashboard_aux')
  if (auxError) throw new Error(`get_dashboard_aux failed: ${auxError.message}`)
  const aux = (auxData ?? {}) as AuxPayload

  // generated should be the max sync time across all segments, not the browser's current time
  let generatedTs = new Date().toISOString()
  if (aux.syncTimes) {
    const allTimes = Object.values(aux.syncTimes)
      .flatMap((company: Record<string, string>) => Object.values(company) as string[])
      .filter(Boolean)
      .sort()
    if (allTimes.length > 0) {
      generatedTs = allTimes[allTimes.length - 1]
    }
  }

  return {
    generated: generatedTs,
    totalRows: rows.length,
    rows,
    debtRows: aux.debtRows ?? [],
    wmsRows: aux.wmsRows ?? [],
    costRows: aux.costRows ?? [],
    priceRows: aux.priceRows ?? [],
    debtLastUpdate: aux.debtLastUpdate || undefined,
    syncTimes: aux.syncTimes ?? {},
  }
}
