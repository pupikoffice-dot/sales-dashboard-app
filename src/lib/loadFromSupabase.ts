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
 * Sales rows come from get_dashboard_sales_after (keyset/cursor pagination,
 * access-filtered, tag-mapped in SQL); debt/stock/cost/price from
 * get_dashboard_aux. Both RPCs are SECURITY DEFINER and enforce the caller's
 * dashboard_user_access (companies, agents, show_item_cost, show_client_profit)
 * server-side. Keyset paging (id > cursor) keeps every page a fast index seek
 * regardless of depth, unlike OFFSET which re-scans on each page.
 */
// Rows per parallel id-range chunk (assumes roughly uniform id density).
const CHUNK_TARGET_ROWS = 30000
const MAX_PARALLEL = 6

interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
  syncTimes?: SyncTimes
}

interface SalesBounds {
  min_id?: number | null
  max_id?: number | null
  total?: number
}

interface SalesRangePage {
  rows?: SalesRow[]
}

async function fetchSalesRange(fromId: number, toId: number): Promise<SalesRow[]> {
  const { data, error } = await supabase.rpc('get_dashboard_sales_range', {
    p_from_id: fromId,
    p_to_id: toId,
  })
  if (error) throw new Error(`get_dashboard_sales_range failed: ${error.message}`)
  return ((data ?? {}) as SalesRangePage).rows ?? []
}

export async function loadDashboardDataFromSupabase(): Promise<DashboardData> {
  // Split the accessible id space into equal ranges and fetch them concurrently
  // (with a small parallelism cap), instead of chaining keyset cursors one after
  // another — wall time drops to roughly total/parallelism.
  const { data: boundsData, error: boundsError } = await supabase.rpc('get_dashboard_sales_bounds')
  if (boundsError) throw new Error(`get_dashboard_sales_bounds failed: ${boundsError.message}`)
  const bounds = (boundsData ?? {}) as SalesBounds

  let rows: SalesRow[] = []
  if (bounds.min_id != null && bounds.max_id != null && (bounds.total ?? 0) > 0) {
    const chunkCount = Math.max(1, Math.ceil((bounds.total ?? 0) / CHUNK_TARGET_ROWS))
    const span = bounds.max_id - bounds.min_id + 1
    const step = Math.ceil(span / chunkCount)
    const ranges: Array<[number, number]> = []
    for (let from = bounds.min_id; from <= bounds.max_id; from += step) {
      ranges.push([from, Math.min(from + step - 1, bounds.max_id)])
    }
    const results: SalesRow[][] = new Array(ranges.length)
    let next = 0
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, ranges.length) }, async () => {
      while (next < ranges.length) {
        const i = next++
        const [from, to] = ranges[i]
        results[i] = await fetchSalesRange(from, to)
      }
    })
    await Promise.all(workers)
    rows = results.flat()
  }

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
