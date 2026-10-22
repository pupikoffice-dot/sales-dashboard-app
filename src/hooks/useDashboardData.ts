import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { usePreview } from '../context/PreviewContext'
import { filterRows } from '../lib/permissions'
import { filterDebtRows, normalizeDebtRows } from '../lib/debtMetrics'
import { buildItemCostMap, buildItemPriceMap } from '../lib/itemPricing'
import { checkOrdersDataHealth } from '../lib/dataHealth'
import { fetchDashboardLoader } from '../lib/parseDashboardLoader'
import {
  dashboardDataFromWire,
  defaultYears,
  fetchDashboardWire,
  fetchYearInfos,
  fetchYearWire,
  rowsFromYearWire,
  yearFingerprint,
  type DashboardWire,
  type YearInfo,
  type YearWire,
} from '../lib/loadFromSupabase'
import {
  readDashboardCache,
  readYearCache,
  writeDashboardCache,
  writeYearCache,
} from '../lib/dashboardCache'
import { yearLoadStore, useYearLoadState } from '../lib/yearLoadStore'
import { supabase } from '../lib/supabase'
import { normalizeSalesDate } from '../lib/salesDate'
import { buildSalesFilterIndex, type SalesFilterIndex } from '../lib/salesFilterIndex'
import { augmentWmsMapsForGold } from '../lib/goldPupikWms'
import { buildWmsMaps } from '../lib/wmsData'
import type { DashboardData, DebtRow, SalesRow } from '../types/dashboard'

const EMPTY_SALES_ROWS: SalesRow[] = []
const EMPTY_DEBT_ROWS: DebtRow[] = []
const EMPTY_YEAR_INFOS: YearInfo[] = []

declare global {
  interface Window {
    __DASHBOARD_DATA__?: DashboardData
    __DEBT_LAST_UPDATE__?: string
  }
}

interface LoadedDashboardPayload extends DashboardData {
  filterIndex: SalesFilterIndex
  /** Years whose sales rows are in `rows`. null = every year the user may see. */
  loadedYears: number[] | null
}

/** Older years being downloaded right now, shared so two pickers never fetch the same year twice. */
const inflightYears = new Map<number, Promise<void>>()

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

const useSupabaseData = (import.meta.env.VITE_USE_SUPABASE_DATA ?? 'true') !== 'false'

function withFilterIndex(data: DashboardData, loadedYears: number[] | null = null): LoadedDashboardPayload {
  if (!data?.rows) throw new Error('Dashboard data missing rows')
  return { ...data, filterIndex: buildSalesFilterIndex(data.rows), loadedYears }
}

/** The year a row belongs to (rows carry `year`, else the first four characters of `date`). */
function yearOfRow(r: SalesRow): number {
  const y = Number(r.year)
  return Number.isInteger(y) && y > 1999 ? y : Number(String(r.date ?? '').slice(0, 4))
}

async function loadDashboardData(
  userId: string | null,
  prev: LoadedDashboardPayload | undefined,
): Promise<LoadedDashboardPayload> {
  // Default to the Supabase data path; set VITE_USE_SUPABASE_DATA=false to fall
  // back to the legacy data_loader.js blob during parallel parity testing.
  if (!useSupabaseData) {
    const data = await loadFromBlob()
    if (!data?.rows) throw new Error('Dashboard data missing rows')
    // Blob path may still carry ISO/datetime/dd-mm dates — normalize once for all KPIs.
    data.rows = data.rows.map(r => {
      const date = normalizeSalesDate(r.date)
      return date && date !== r.date ? { ...r, date } : r
    })
    return withFilterIndex(data)
  }

  const wire = await fetchDashboardWire()
  if (userId) void saveWire(userId, wire)
  const fresh = dashboardDataFromWire(wire)
  const covered = wire.years ?? null
  // Older years the user already opened this session stay in place while the newest two refresh.
  const keepYears = covered && prev?.loadedYears ? prev.loadedYears.filter(y => !covered.includes(y)) : []
  if (!keepYears.length || !prev) return withFilterIndex(fresh, covered)
  const kept = prev.rows.filter(r => keepYears.includes(yearOfRow(r)))
  const rows = fresh.rows.concat(kept)
  return withFilterIndex({ ...fresh, rows, totalRows: rows.length }, [...covered!, ...keepYears].sort((a, b) => a - b))
}

/** Keep the download on this device, but only while the same user is still signed in. */
async function saveWire(userId: string, wire: DashboardWire): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id !== userId) return
  await writeDashboardCache(userId, wire)
}

export function useDashboardData() {
  const { access } = useDashboardAccess()
  const { session } = useAuth()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()

  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null
  const enabled = !!access && !!session
  const queryKey = useMemo(() => ['dashboard-data', userId] as const, [userId])

  const q = useQuery({
    // Keyed by user id (not just a static string) so cached data from one
    // user's session is never served to a different user in the same tab —
    // AuthContext also clears the whole cache on any user change as a
    // second layer, but a distinct key is the safer primary guard.
    queryKey,
    queryFn: () => loadDashboardData(userId, queryClient.getQueryData<LoadedDashboardPayload>(queryKey)),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  })

  // Reopening the app: show the last download kept on this device at once; the
  // query above keeps loading fresh data and replaces it when it arrives.
  useEffect(() => {
    if (!enabled || !userId || !useSupabaseData) return
    if (queryClient.getQueryData(queryKey)) return
    let cancelled = false
    readDashboardCache<DashboardWire>(userId).then(hit => {
      if (cancelled || !hit || queryClient.getQueryData(queryKey)) return
      try {
        const payload = withFilterIndex(dashboardDataFromWire(hit.value), hit.value.years ?? null)
        // Still missing? (the fresh download may have landed while decoding)
        if (!queryClient.getQueryData(queryKey)) {
          queryClient.setQueryData(queryKey, payload, { updatedAt: hit.savedAt })
        }
      } catch {
        /* unreadable cache: just wait for the download */
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, userId, queryKey, queryClient])

  // The years this user may open (with a fingerprint of each), and the loader for the ones not downloaded yet.
  const infosKey = useMemo(() => ['dashboard-year-infos', userId] as const, [userId])
  const infosQ = useQuery({
    queryKey: infosKey,
    queryFn: fetchYearInfos,
    staleTime: 5 * 60 * 1000,
    enabled: enabled && useSupabaseData,
  })
  const loadedYears = q.data?.loadedYears ?? null

  const loadYear = useCallback(
    (year: number): Promise<void> => {
      const cur = queryClient.getQueryData<LoadedDashboardPayload>(queryKey)
      if (!userId || !cur || cur.loadedYears === null || cur.loadedYears.includes(year)) return Promise.resolve()
      const running = inflightYears.get(year)
      if (running) return running
      const job = (async () => {
        yearLoadStore.start(year)
        try {
          const infos = await queryClient.fetchQuery({ queryKey: infosKey, queryFn: fetchYearInfos, staleTime: 5 * 60 * 1000 })
          const fingerprint = yearFingerprint(infos, year)
          let wire = fingerprint ? await readYearCache<YearWire>(userId, year, fingerprint) : null
          if (!wire) {
            wire = await fetchYearWire(year)
            if (fingerprint) void writeYearCache(userId, year, wire, fingerprint)
          }
          const rows = rowsFromYearWire(wire)
          queryClient.setQueryData<LoadedDashboardPayload>(queryKey, prev => {
            if (!prev || prev.loadedYears === null || prev.loadedYears.includes(year)) return prev
            const merged = prev.rows.concat(rows)
            return {
              ...prev,
              rows: merged,
              totalRows: merged.length,
              filterIndex: buildSalesFilterIndex(merged),
              loadedYears: [...prev.loadedYears, year].sort((a, b) => a - b),
            }
          })
        } catch (e) {
          yearLoadStore.fail(year, e instanceof Error ? e.message : 'Could not load this year')
        } finally {
          yearLoadStore.end(year)
          inflightYears.delete(year)
        }
      })()
      inflightYears.set(year, job)
      return job
    },
    [queryClient, queryKey, infosKey, userId],
  )

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
    const hiddenYears = new Set((access.hiddenYears ?? []).map(Number))
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
        nextAgents[agent] = hiddenYears.size
          ? Object.fromEntries(Object.entries(months || {}).filter(([ym]) => !hiddenYears.has(Number(ym.slice(0, 4)))))
          : months
      }
      if (Object.keys(nextAgents).length) filtered[co] = nextAgents
    }
    return {
      ...q.data,
      receiptsMonthly: {},
      receiptsMonthlyByAgent: filtered,
    }
  }, [q.data, maskPreview, access])

  const yearState = useYearLoadState()
  const hiddenKey = (access?.hiddenYears ?? []).join(',')
  /** Every year this user may open: downloaded ones plus those the database lists (older years load on demand). */
  const availableYears = useMemo(() => {
    const hidden = new Set((access?.hiddenYears ?? []).map(Number))
    const years = new Set<number>(defaultYears())
    for (const i of infosQ.data ?? []) years.add(i.year)
    for (const y of loadedYears ?? []) years.add(y)
    return [...years].filter(y => !hidden.has(y)).sort((a, b) => a - b)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the hidden-years list contents
  }, [infosQ.data, loadedYears, hiddenKey])
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
  const { wmsStock, wmsNames } = useMemo(() => {
    const base = buildWmsMaps(data?.wmsRows)
    return augmentWmsMapsForGold(base.wmsStock, base.wmsNames)
  }, [data?.wmsRows])
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
  const agentsKey = access?.agents?.join(',') ?? ''
  const dataHealth = useMemo(
    () => checkOrdersDataHealth(allRows, access?.companies ?? [], access?.agents ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on companies/agents identity
    [allRows, companiesKey, agentsKey],
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
    /** Showing earlier data (e.g. the copy kept on this device) while a fresh download runs. */
    isRefreshing: !!q.data && q.isFetching,
    /** Years the user may open; the ones not in `loadedYears` are downloaded by `loadYear` when asked for. */
    availableYears,
    /** The database's (company, year) list behind `availableYears`. */
    yearInfos: infosQ.data ?? EMPTY_YEAR_INFOS,
    /** Years whose rows are on screen. null = all of them. */
    loadedYears,
    loadYear,
    /** Older years being downloaded right now, and any that failed. */
    loadingYears: yearState.loading,
    failedYears: yearState.failed,
    /** When the data on screen was downloaded (ms). */
    dataSavedAt: q.dataUpdatedAt,
  }
}
