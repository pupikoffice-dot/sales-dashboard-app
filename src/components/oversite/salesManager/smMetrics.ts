import type { DebtRow, LogicalCompany, SalesRow } from '../../../types/dashboard'
import { computeDebtSummary, debtRowsForCompany, type DebtSummary } from '../../../lib/debtMetrics'
import {
  OVERSITE_COMPANIES,
  computeOpenOrders,
  computeOrdersLast7DaysByAgent,
  computeReturnsMtd,
  computeSalesMtd,
  computeTop10BySku,
  getOversiteDateContext,
  resolveOpenOrdersTag,
  resolveOrdersTag,
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

/** Display labels for suite company headers / Orders report (classic + extras). */
const COMPANY_REPORT_LABELS: Record<LogicalCompany, string> = {
  pupik: '🏢 Pupik',
  mt: '🐒 Monkeytime',
  grow: '🌱 Grow',
  gold: '🥇 Gold',
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
 */
export function buildSmSuiteKpis(args: BuildSmSuiteKpisArgs): SmSuiteKpis {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const scopedRows = narrowByAgents(args.rows, args.agents)
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

  const sales = computeSalesMtd(scopedRows, args.company, dateCtx.curYear, dateCtx.curMonth)
  const openTag = resolveOpenOrdersTag(scopedRows, def.openOrdersTag)
  const open = computeOpenOrders(scopedRows, openTag)
  const returns = computeReturnsMtd(scopedRows, def.returnsTag, dateCtx.curYear, dateCtx.curMonth)
  const ordersTag = resolveOrdersTag(scopedRows, def.ordersTag)
  const ordersLast7Days = computeOrdersLast7DaysByAgent(scopedRows, ordersTag, dateCtx.todayStr)
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

/** Top 10 open **orders** (by cash) for one company ∩ window agents — not SKUs. */
export function buildSmOpenOrdersTop10(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
}): OrderTodayGroup[] {
  const scoped = narrowByAgents(args.rows, args.agents)
  const def = companyDef(args.company)
  if (!def) return []
  const tag = resolveOpenOrdersTag(scoped, def.openOrdersTag)
  return topOpenOrdersByCash(scoped, tag, 10)
}

/** Top 10 returns SKUs (MTD) for one company ∩ window agents. */
export function buildSmReturnsTop10(args: {
  rows: SalesRow[]
  company: LogicalCompany
  agents?: string[] | null
  dateCtx?: OversiteDateContext
}): Top10Item[] {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const scoped = narrowByAgents(args.rows, args.agents)
  const def = companyDef(args.company)
  if (!def) return []
  return computeTop10BySku(
    scoped.filter(
      r =>
        r.company === def.returnsTag &&
        Number(r.year) === dateCtx.curYear &&
        Number(r.month) === dateCtx.curMonth,
    ),
    10,
    'low-first',
  )
}
