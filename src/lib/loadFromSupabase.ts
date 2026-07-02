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
// Rows per parallel page; boundaries are exact ids computed server-side.
const PAGE_ROWS = 25000
const MAX_PARALLEL = 4

interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
  syncTimes?: SyncTimes
}

interface SalesBoundaries {
  boundaries?: number[]
  max_id?: number | null
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
  // Ids are sparse (gaps left by scope-replace deletes), so equal id spans give
  // wildly uneven page sizes. get_dashboard_sales_boundaries returns the actual
  // id at every PAGE_ROWS-th accessible row, so each range is ~PAGE_ROWS rows;
  // ranges are then fetched concurrently (capped) instead of chained cursors.
  const { data: boundsData, error: boundsError } = await supabase.rpc(
    'get_dashboard_sales_boundaries',
    { p_page_rows: PAGE_ROWS },
  )
  if (boundsError) throw new Error(`get_dashboard_sales_boundaries failed: ${boundsError.message}`)
  const bounds = (boundsData ?? {}) as SalesBoundaries
  const starts = bounds.boundaries ?? []

  let rows: SalesRow[] = []
  if (starts.length > 0 && bounds.max_id != null) {
    const ranges: Array<[number, number]> = starts.map((from, i) =>
      i + 1 < starts.length ? [from, starts[i + 1] - 1] : [from, bounds.max_id as number],
    )
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
