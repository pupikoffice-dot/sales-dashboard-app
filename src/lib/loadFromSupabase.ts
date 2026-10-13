import { supabase } from './supabase'
import { normalizeSalesDate } from './salesDate'
import { decodeSalesPage, encodeSalesRows, type CompactSalesPage } from './salesCompact'
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
 * Sales rows are fetched in ~25k-row chunks: get_dashboard_sales_boundaries
 * returns the exact id at every 25k-th accessible row (ids are sparse, so
 * equal id spans would give wildly uneven pages), then each [from,to] range is
 * fetched via get_dashboard_sales_range_v2 (compact columns + string dictionary,
 * ~2 MB a chunk; falls back to v1 objects, ~8 MB, if v2 is missing). Chunks were ~8 MB each — a single
 * all-rows response (~72 MB) crashes PostgREST and 521s the whole API, so DO
 * NOT consolidate this back into one query. Parallelism is kept modest (3) and
 * each chunk retries up to CHUNK_RETRIES times (3 attempts total) to ride out
 * transient 5xx while the hourly ETL runs.
 *
 * All RPCs are SECURITY DEFINER and enforce dashboard_user_access
 * (companies, agents, show_item_cost, show_client_profit) server-side.
 */
const PAGE_ROWS = 25000
const MAX_PARALLEL = 3
const CHUNK_RETRIES = 2

interface AuxPayload {
  debtRows?: DebtRow[]
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  debtLastUpdate?: string
  debtFileDates?: Record<string, string>
  receiptsMonthly?: Record<string, Record<string, number>>
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
  syncTimes?: SyncTimes
}

interface SalesBoundaries {
  boundaries?: number[]
  max_id?: number | null
}

interface SalesRangePage {
  rows?: SalesRow[]
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Everything one download brings, before decoding. This is what the device cache keeps. */
export interface DashboardWire {
  pages: CompactSalesPage[]
  aux: AuxPayload
}

/** PostgREST "function not found": the database has no v2 yet, so use v1. */
let v2Missing = false

async function fetchSalesRange(fromId: number, toId: number): Promise<CompactSalesPage> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt)
    if (!v2Missing) {
      const { data, error } = await supabase.rpc('get_dashboard_sales_range_v2', {
        p_from_id: fromId,
        p_to_id: toId,
      })
      if (!error) return data as CompactSalesPage
      if (error.code === 'PGRST202') v2Missing = true
      else {
        lastError = new Error(`get_dashboard_sales_range_v2 failed: ${error.message}`)
        continue
      }
    }
    const { data, error } = await supabase.rpc('get_dashboard_sales_range', {
      p_from_id: fromId,
      p_to_id: toId,
    })
    if (!error) return encodeSalesRows(((data ?? {}) as SalesRangePage).rows ?? [])
    lastError = new Error(`get_dashboard_sales_range failed: ${error.message}`)
  }
  throw lastError
}

async function fetchAux(): Promise<AuxPayload> {
  const { data: auxData, error: auxError } = await supabase.rpc('get_dashboard_aux')
  if (auxError) throw new Error(`get_dashboard_aux failed: ${auxError.message}`)
  return (auxData ?? {}) as AuxPayload
}

/** Downloads the payload in compact form. Aux runs alongside the sales pages. */
export async function fetchDashboardWire(): Promise<DashboardWire> {
  const auxPromise = fetchAux()
  auxPromise.catch(() => {}) // awaited below; avoids an unhandled rejection if sales fail first

  const { data: boundsData, error: boundsError } = await supabase.rpc(
    'get_dashboard_sales_boundaries',
    { p_page_rows: PAGE_ROWS },
  )
  if (boundsError) throw new Error(`get_dashboard_sales_boundaries failed: ${boundsError.message}`)
  const bounds = (boundsData ?? {}) as SalesBoundaries
  const starts = bounds.boundaries ?? []

  let pages: CompactSalesPage[] = []
  if (starts.length > 0 && bounds.max_id != null) {
    const ranges: Array<[number, number]> = starts.map((from, i) =>
      i + 1 < starts.length ? [from, starts[i + 1] - 1] : [from, bounds.max_id as number],
    )
    const results: CompactSalesPage[] = new Array(ranges.length)
    let next = 0
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, ranges.length) }, async () => {
      while (next < ranges.length) {
        const i = next++
        const [from, to] = ranges[i]
        results[i] = await fetchSalesRange(from, to)
      }
    })
    await Promise.all(workers)
    pages = results
  }

  return { pages, aux: await auxPromise }
}

/** Compact download (fresh or from the device cache) to the shape every page uses. */
export function dashboardDataFromWire(wire: DashboardWire): DashboardData {
  const rows = wire.pages.flatMap(decodeSalesPage).map(normalizeSalesRowDates)
  const aux = wire.aux ?? {}

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
    debtFileDates: aux.debtFileDates ?? {},
    receiptsMonthly: aux.receiptsMonthly ?? {},
    receiptsMonthlyByAgent: aux.receiptsMonthlyByAgent ?? {},
    syncTimes: aux.syncTimes ?? {},
  }
}

export async function loadDashboardDataFromSupabase(): Promise<DashboardData> {
  return dashboardDataFromWire(await fetchDashboardWire())
}

/** Force every sales row date to YYYY-MM-DD so day charts/KPIs never miss rows. */
function normalizeSalesRowDates(row: SalesRow): SalesRow {
  const date = normalizeSalesDate(row.date)
  if (!date || date === row.date) return row
  return { ...row, date }
}
