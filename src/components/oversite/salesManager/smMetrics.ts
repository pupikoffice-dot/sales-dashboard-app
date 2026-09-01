import type { DebtRow, LogicalCompany, SalesRow } from '../../../types/dashboard'
import { computeDebtSummary, debtRowsForCompany, type DebtSummary } from '../../../lib/debtMetrics'
import {
  OVERSITE_COMPANIES,
  computeOrdersLast7DaysByAgent,
  computeTop10BySku,
  getOversiteDateContext,
  resolveOpenOrdersTag,
  topOpenOrdersByCash,
  type OrderTodayGroup,
  type OrdersLast7DaysResult,
  type OversiteCompanyDef,
  type OversiteDateContext,
  type OpenOrdersMetrics,
  type ReturnsMtdMetrics,
  type SalesMtdMetrics,
  type Top10Item,
} from '../../../lib/oversiteMetrics'

/**
 * CORE RULE — Companies never combined.
 * Callers pass exactly one company per KPI / report build. Multi-company users
 * get sequential company blocks in the suite UI — never summed here.
 *
 * CORE RULE — Oversight ⊥ Sidebar: pass access company/agents only, never filters.
 */

/** Sum agent monthly maps into one YYYY-MM → gross map (same as OversiteReceipts). */
function sumAgentMonthly(
  byAgent: Record<string, Record<string, number>> | undefined,
  agents: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  if (!byAgent) return out
  for (const agent of agents) {
    const months = byAgent[agent]
    if (!months) continue
    for (const [ym, v] of Object.entries(months)) {
      out[ym] = (out[ym] || 0) + (Number(v) || 0)
    }
  }
  return out
}

/** Tag defs for companies not listed in classic OVERSITE_COMPANIES. */
const EXTRA_COMPANY_DEFS: Partial<Record<LogicalCompany, Omit<OversiteCompanyDef, 'label' | 'accentColor'>>> = {
  grow: {
    id: 'grow',
    ordersTag: 'orders-grow',
    openOrdersTag: 'openorders-grow',
    delivery720Tag: 'delivery720-grow',
    returnsTag: 'returns-grow',
  },
  gold: {
    id: 'gold',
    ordersTag: 'orders-gold',
    openOrdersTag: 'openorders-gold',
    delivery720Tag: 'delivery720-gold',
    returnsTag: 'returns-gold',
  },
}

function companyDef(id: LogicalCompany): Pick<
  OversiteCompanyDef,
  'id' | 'ordersTag' | 'openOrdersTag' | 'delivery720Tag' | 'returnsTag'
> | null {
  const fromClassic = OVERSITE_COMPANIES.find(c => c.id === id)
  if (fromClassic) return fromClassic
  return EXTRA_COMPANY_DEFS[id] ?? null
}

/** Open-orders company tag for BI / suite (e.g. `openorders` for Pupik). */
export function smOpenOrdersTag(company: LogicalCompany): string | null {
  return companyDef(company)?.openOrdersTag ?? null
}

/** Display labels for suite company headers / Orders report (classic + extras). */
const COMPANY_REPORT_LABELS: Record<LogicalCompany, string> = {
  pupik: '🏢 Pupik',
  mt: '🐒 Monkeytime',
  grow: '🌱 Grow',
  gold: '🥇 Goldbug',
}

export function smCompanyLabel(id: LogicalCompany): string {
  const classic = OVERSITE_COMPANIES.find(c => c.id === id)
  return classic?.label ?? COMPANY_REPORT_LABELS[id] ?? id
}

export interface SmOrdersReportCompany {
  id: LogicalCompany
  label: string
  /** Base orders tag before `resolveOrdersTag`. */
  ordersTag: string
}

/**
 * Companies eligible for full Orders Today report entry.
 * CORE RULE: pass `access.companies` only — never sidebar selection.
 */
export function listSmOrdersReportCompanies(companies: LogicalCompany[]): SmOrdersReportCompany[] {
  const out: SmOrdersReportCompany[] = []
  for (const id of companies) {
    const def = companyDef(id)
    if (!def) continue
    out.push({
      id,
      label: smCompanyLabel(id),
      ordersTag: def.ordersTag,
    })
  }
  return out
}

function narrowByAgents<T extends { agent?: string | null }>(
  rows: T[],
  agents: string[] | null | undefined,
): T[] {
  if (!Array.isArray(agents) || agents.length === 0) return rows
  const set = new Set(agents.map(String))
  return rows.filter(r => set.has(String(r.agent ?? '')))
}

const EMPTY_TAG_ROWS: SalesRow[] = []

/** Group access-scoped sales rows by `company` tag once (suite KPI / cube indexing). */
export function partitionSalesRowsByTag(rows: SalesRow[]): Map<string, SalesRow[]> {
  const map = new Map<string, SalesRow[]>()
  for (const r of rows) {
    const tag = String(r.company ?? '')
    let bucket = map.get(tag)
    if (!bucket) {
      bucket = []
      map.set(tag, bucket)
    }
    bucket.push(r)
  }
  return map
}

function tagSlice(partition: Map<string, SalesRow[]>, tag: string): SalesRow[] {
  return partition.get(tag) ?? EMPTY_TAG_ROWS
}

/** Resolve orders tag using partitioned counts (same rules as resolveOrdersTag). */
function resolveOrdersTagFromPartition(
  partition: Map<string, SalesRow[]>,
  ordersTag: string,
  agents?: string[] | null,
): string {
  const count = narrowByAgents(tagSlice(partition, ordersTag), agents).length
  if (count > 0) return ordersTag
  if (ordersTag === 'orders-pupik') {
    const legacy = narrowByAgents(tagSlice(partition, 'openorders'), agents).length
    if (legacy > 2000) return 'openorders'
  }
  if (ordersTag === 'orders-mt') {
    const legacy = narrowByAgents(tagSlice(partition, 'openorders-mt'), agents).length
    if (legacy > 2000) return 'openorders-mt'
  }
  return ordersTag
}

/**
 * One pass over company sales rows for MTD + LY (same predicates as computeSalesMtd).
 */
function salesMtdFromSlice(
  salesRows: SalesRow[],
  company: string,
  curYear: number,
  curMonth: number,
): SalesMtdMetrics {
  let cash = 0
  let qty = 0
  let lyCash = 0
  let lyQty = 0
  const lyYear = curYear - 1
  for (const r of salesRows) {
    if (r.company !== company) continue
    const y = Number(r.year)
    const m = Number(r.month)
    if (m !== curMonth) continue
    const c = Number(r.cash) || 0
    const q = Number(r.qty) || 0
    if (y === curYear) {
      cash += c
      qty += q
    } else if (y === lyYear) {
      lyCash += c
      lyQty += q
    }
  }
  const lyChangeCashPct = lyCash > 0 ? ((cash - lyCash) / lyCash) * 100 : null
  return { cash, qty, lyCash, lyQty, lyChangeCashPct }
}

/** Same predicates as computeOpenOrders on an open-orders tag slice. */
function openOrdersFromSlice(openRows: SalesRow[], openOrdersTag: string): OpenOrdersMetrics {
  let cash = 0
  let qty = 0
  const clients = new Set<string | number>()
  for (const r of openRows) {
    if (r.company !== openOrdersTag) continue
    cash += Number(r.cash) || 0
    qty += Number(r.qty) || 0
    if (r.clientID) clients.add(r.clientID)
  }
  return { clients: clients.size, cash, qty }
}

/** Same predicates as computeReturnsMtd on a returns tag slice. */
function returnsMtdFromSlice(
  returnsRows: SalesRow[],
  returnsTag: string,
  curYear: number,
  curMonth: number,
): ReturnsMtdMetrics {
  let cash = 0
  let qty = 0
  for (const r of returnsRows) {
    if (r.company !== returnsTag) continue
    if (Number(r.year) !== curYear || Number(r.month) !== curMonth) continue
    cash += Number(r.cash) || 0
    qty += Number(r.qty) || 0
  }
  return { cash, qty }
}

export interface SmReceiptsMetrics {
  /** Gross monthly sums (YYYY-MM → amount) for **one** company. */
  monthly: Record<string, number>
  /** Per-agent gross monthly maps for that company. */
  byAgent: Record<string, Record<string, number>>
  /** Agents included in this window (suite scope ∩ data present). */
  agents: string[]
}

export interface SmSuiteKpis {
  salesMtd: SalesMtdMetrics
  openOrders: OpenOrdersMetrics
  returnsMtd: ReturnsMtdMetrics
  openDebt: DebtSummary | null
  ordersLast7Days: OrdersLast7DaysResult
  receipts: SmReceiptsMetrics
}

export interface BuildSmSuiteKpisArgs {
  /**
   * Sales rows already scoped by access companies (+ access agents if applicable).
   * Do not pass sidebar / DashboardFilters selections.
   */
  rows: SalesRow[]
  /** Debt rows already scoped by access (companies + agents). */
  debtRows: DebtRow[]
  /**
   * Exactly one company from `access.companies`.
   * CORE RULE: never pass multiple companies to combine — UI stacks company blocks.
   */
  company: LogicalCompany
  /**
   * Window agent scope. `null` / `[]` = all agents in the provided rows (All window).
   * Non-empty = further narrow to these agents (per-agent window).
   */
  agents?: string[] | null
  dateCtx?: OversiteDateContext
  /** company → agent → YYYY-MM → gross. Suite scopes agents; no RECEIPTS_TEAM_AGENTS. */
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
  /**
   * Optional pre-built tag partition of `rows` (same row set).
   * When omitted, built once from `rows` so each KPI reads a slice instead of re-scanning all.
   */
  rowPartition?: Map<string, SalesRow[]>
}

function emptyOrdersLast7(): OrdersLast7DaysResult {
  return { days: [], agents: [] }
}

function emptySales(): SalesMtdMetrics {
  return { cash: 0, qty: 0, lyCash: 0, lyQty: 0, lyChangeCashPct: null }
}

function emptyOpen(): OpenOrdersMetrics {
  return { clients: 0, cash: 0, qty: 0 }
}

function emptyReturns(): ReturnsMtdMetrics {
  return { cash: 0, qty: 0 }
}

/**
 * Suite KPIs for **one** company and the window's agent set.
 * CORE RULE: one company only — never combine. Callers must not pass sidebar filter company.
 * Internals: tag partition + single-pass sales/open/returns (same numbers as classic helpers).
 */
export function buildSmSuiteKpis(args: BuildSmSuiteKpisArgs): SmSuiteKpis {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const partition = args.rowPartition ?? partitionSalesRowsByTag(args.rows)
  const scopedDebt = narrowByAgents(args.debtRows, args.agents)
  const def = companyDef(args.company)

  if (!def) {
    return {
      salesMtd: emptySales(),
      openOrders: emptyOpen(),
      returnsMtd: emptyReturns(),
      openDebt: computeDebtSummary(debtRowsForCompany(scopedDebt, args.company)),
      ordersLast7Days: emptyOrdersLast7(),
      receipts: buildSmReceipts({
        receiptsMonthlyByAgent: args.receiptsMonthlyByAgent,
        company: args.company,
        agents: args.agents,
      }),
    }
  }

  const salesSlice = narrowByAgents(tagSlice(partition, args.company), args.agents)
  const openTag = def.openOrdersTag
  const openSlice = narrowByAgents(tagSlice(partition, openTag), args.agents)
  const returnsSlice = narrowByAgents(tagSlice(partition, def.returnsTag), args.agents)
  const ordersTag = resolveOrdersTagFromPartition(partition, def.ordersTag, args.agents)
  // Agent-narrow the resolved orders tag; if legacy fallback switched tags, re-slice.
  const ordersSlice = narrowByAgents(tagSlice(partition, ordersTag), args.agents)

  const sales = salesMtdFromSlice(salesSlice, args.company, dateCtx.curYear, dateCtx.curMonth)
  const open = openOrdersFromSlice(openSlice, openTag)
  const returns = returnsMtdFromSlice(
    returnsSlice,
    def.returnsTag,
    dateCtx.curYear,
    dateCtx.curMonth,
  )
  const ordersLast7Days = computeOrdersLast7DaysByAgent(ordersSlice, ordersTag, dateCtx.todayStr)
  const debtData = debtRowsForCompany(scopedDebt, args.company)
  const openDebt = computeDebtSummary(debtData)

  const receipts = buildSmReceipts({
    receiptsMonthlyByAgent: args.receiptsMonthlyByAgent,
    company: args.company,
    agents: args.agents,
  })

  return {
    salesMtd: sales,
    openOrders: open,
    returnsMtd: returns,
    openDebt,
    ordersLast7Days,
    receipts,
  }
}

export interface BuildSmReceiptsArgs {
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
  /** Exactly one company — never merge companies. */
  company: LogicalCompany
  /** Suite / window agent set. null/[] = every agent present for that company. */
  agents?: string[] | null
}

/**
 * Receipts for one company ∩ suite agents.
 * Does **not** use hardcoded RECEIPTS_TEAM_AGENTS.
 */
export function buildSmReceipts(args: BuildSmReceiptsArgs): SmReceiptsMetrics {
  const byCompany = args.receiptsMonthlyByAgent ?? {}
  const restrictAgents =
    Array.isArray(args.agents) && args.agents.length > 0 ? new Set(args.agents.map(String)) : null

  const byAgent: Record<string, Record<string, number>> = {}
  const agentMaps = byCompany[args.company] ?? {}

  for (const [agent, months] of Object.entries(agentMaps || {})) {
    if (restrictAgents && !restrictAgents.has(agent)) continue
    if (!byAgent[agent]) byAgent[agent] = {}
    for (const [ym, v] of Object.entries(months || {})) {
      byAgent[agent][ym] = (byAgent[agent][ym] || 0) + (Number(v) || 0)
    }
  }

  const agents = Object.keys(byAgent).sort((a, b) => {
    const an = Number(a)
    const bn = Number(b)
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
    return a.localeCompare(b)
  })

  const monthly = sumAgentMonthly(byAgent, agents)
  return { monthly, byAgent, agents }
}

/** Debt rows for one company ∩ optional agent scope. */
export function buildSmDebtRows(args: {
  debtRows: DebtRow[]
  company: LogicalCompany
  agents?: string[] | null
}): DebtRow[] {
  const scoped = narrowByAgents(args.debtRows, args.agents)
  return debtRowsForCompany(scoped, args.company)
}

/** Open orders (by cash) for one company ∩ window agents — not SKUs. */
export function buildSmOpenOrdersReport(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
  /** Omit to return all open orders in scope; default 10 for legacy top-N views. */
  limit?: number
}): OrderTodayGroup[] {
  const scoped = narrowByAgents(args.rows, args.agents)
  const def = companyDef(args.company)
  if (!def) return []
  const tag = resolveOpenOrdersTag(scoped, def.openOrdersTag)
  return topOpenOrdersByCash(scoped, tag, args.limit)
}

/** @deprecated use buildSmOpenOrdersReport */
export function buildSmOpenOrdersTop10(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
}): OrderTodayGroup[] {
  return buildSmOpenOrdersReport({ ...args, limit: 10 })
}

/** Returns SKUs (MTD) for one company ∩ window agents. */
export function buildSmReturnsReport(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
  dateCtx?: OversiteDateContext
  /** Omit for top 10; pass `null` for all returns in scope. */
  limit?: number | null
}): Top10Item[] {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const scoped = narrowByAgents(args.rows, args.agents)
  const def = companyDef(args.company)
  if (!def) return []
  const cap = args.limit === null ? null : (args.limit ?? 10)
  return computeTop10BySku(
    scoped.filter(
      r =>
        r.company === def.returnsTag &&
        Number(r.year) === dateCtx.curYear &&
        Number(r.month) === dateCtx.curMonth,
    ),
    cap,
    'low-first',
  )
}

/** @deprecated use buildSmReturnsReport */
export function buildSmReturnsTop10(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
  dateCtx?: OversiteDateContext
}): Top10Item[] {
  return buildSmReturnsReport(args)
}

export interface SmVsAgentPoint {
  agentId: string
  salesMtdCash: number
  /** null = missing / not ready — UI shows em dash. */
  goalCash: number | null
  openOrdersCash: number
  returnsCash: number
  openDebtCash: number
  /** Sum of orders cash over last 7 workdays for this agent ∩ company. */
  orders7Cash: number
}

export interface SmVsCompanySeries {
  company: LogicalCompany
  agents: SmVsAgentPoint[]
  /** All-suite-agents receipts for this company (Vs receipts cube). */
  receipts: SmReceiptsMetrics
  /** Orders last-7 for all suite agents ∩ this company (shared chart). */
  ordersLast7Days: OrdersLast7DaysResult
}

export interface BuildSmVsAgentSeriesArgs {
  rows: SalesRow[]
  debtRows: DebtRow[]
  company: LogicalCompany
  agents: string[]
  dateCtx?: OversiteDateContext
  /** agent → target cash for current month; omit keys = missing goal. */
  targets?: Record<string, number>
  goalsReady?: boolean
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
}

/**
 * Vs mode: one series per agent for a single company — never combine companies.
 * CORE RULE: callers pass access company + suite agents only.
 */
export function buildSmVsAgentSeries(args: BuildSmVsAgentSeriesArgs): SmVsCompanySeries {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const goalsReady = args.goalsReady === true
  const targets = args.targets ?? {}
  const partition = partitionSalesRowsByTag(args.rows)

  const agents: SmVsAgentPoint[] = args.agents.map(agentId => {
    const kpis = buildSmSuiteKpis({
      rows: args.rows,
      debtRows: args.debtRows,
      company: args.company,
      agents: [agentId],
      dateCtx,
      receiptsMonthlyByAgent: args.receiptsMonthlyByAgent,
      rowPartition: partition,
    })
    const goalCash =
      goalsReady && Object.prototype.hasOwnProperty.call(targets, agentId) ? targets[agentId]! : null
    const orders7Cash = kpis.ordersLast7Days.days.reduce((s, d) => s + (d.byAgent[agentId] || 0), 0)
    return {
      agentId,
      salesMtdCash: kpis.salesMtd.cash,
      goalCash,
      openOrdersCash: kpis.openOrders.cash,
      returnsCash: kpis.returnsMtd.cash,
      openDebtCash: kpis.openDebt?.grandTotal ?? 0,
      orders7Cash,
    }
  })

  const allKpis = buildSmSuiteKpis({
    rows: args.rows,
    debtRows: args.debtRows,
    company: args.company,
    agents: args.agents.length > 0 ? args.agents : null,
    dateCtx,
    receiptsMonthlyByAgent: args.receiptsMonthlyByAgent,
    rowPartition: partition,
  })

  return {
    company: args.company,
    agents,
    receipts: allKpis.receipts,
    ordersLast7Days: allKpis.ordersLast7Days,
  }
}

/**
 * Build Vs series from already-computed All + per-agent suite KPIs (Alone path).
 * Avoids a second full `buildSmSuiteKpis` pass per agent.
 */
export function buildSmVsAgentSeriesFromKpis(args: {
  company: LogicalCompany
  agentWindows: Array<{ agentId: string; kpis: SmSuiteKpis; goalCash: number | null }>
  allKpis: SmSuiteKpis
}): SmVsCompanySeries {
  const agents: SmVsAgentPoint[] = args.agentWindows.map(({ agentId, kpis, goalCash }) => {
    const orders7Cash = kpis.ordersLast7Days.days.reduce((s, d) => s + (d.byAgent[agentId] || 0), 0)
    return {
      agentId,
      salesMtdCash: kpis.salesMtd.cash,
      goalCash,
      openOrdersCash: kpis.openOrders.cash,
      returnsCash: kpis.returnsMtd.cash,
      openDebtCash: kpis.openDebt?.grandTotal ?? 0,
      orders7Cash,
    }
  })
  return {
    company: args.company,
    agents,
    receipts: args.allKpis.receipts,
    ordersLast7Days: args.allKpis.ordersLast7Days,
  }
}
