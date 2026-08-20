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
  type OrdersLast7DaysResult,
  type OversiteCompanyDef,
  type OversiteDateContext,
  type OpenOrdersMetrics,
  type ReturnsMtdMetrics,
  type SalesMtdMetrics,
  type Top10Item,
} from '../../../lib/oversiteMetrics'
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

/** Display labels for suite Orders report buttons (classic Oversight columns + extras). */
const COMPANY_REPORT_LABELS: Record<LogicalCompany, string> = {
  pupik: '🏢 Pupik',
  mt: '🐒 Monkeytime',
  grow: '🌱 Grow',
  gold: '🥇 Gold',
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
    const classic = OVERSITE_COMPANIES.find(c => c.id === id)
    out.push({
      id,
      label: classic?.label ?? COMPANY_REPORT_LABELS[id] ?? id,
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
  /** Gross monthly sums (YYYY-MM → amount), aggregated across allowed companies. */
  monthly: Record<string, number>
  /** Per-agent gross monthly maps (agent → YYYY-MM → amount), companies merged. */
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
   * All companies from `access.companies`.
   * Suite KPIs always aggregate across this list — never a sidebar selected company.
   */
  companies: LogicalCompany[]
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

function mergeOrdersLast7Days(parts: OrdersLast7DaysResult[]): OrdersLast7DaysResult {
  if (parts.length === 0) return { days: [], agents: [] }
  if (parts.length === 1) return parts[0]

  const dayMap = new Map<string, { label: string; total: number; byAgent: Record<string, number>; isToday: boolean }>()
  const agentTotals = new Map<string, number>()

  for (const part of parts) {
    for (const day of part.days) {
      let entry = dayMap.get(day.date)
      if (!entry) {
        entry = { label: day.label, total: 0, byAgent: {}, isToday: day.isToday }
        dayMap.set(day.date, entry)
      }
      entry.total += day.total
      for (const [agent, cash] of Object.entries(day.byAgent)) {
        entry.byAgent[agent] = (entry.byAgent[agent] || 0) + cash
        agentTotals.set(agent, (agentTotals.get(agent) || 0) + cash)
      }
    }
  }

  const agents = [...agentTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([a]) => a)

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({
      date,
      label: e.label,
      total: e.total,
      byAgent: e.byAgent,
      isToday: e.isToday,
    }))

  return { days, agents }
}

/**
 * Aggregate suite KPIs across **all** allowed companies for the window's agent set.
 * CORE RULE: callers must pass `access.companies` — never sidebar filter / Apply company.
 */
export function buildSmSuiteKpis(args: BuildSmSuiteKpisArgs): SmSuiteKpis {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const scopedRows = narrowByAgents(args.rows, args.agents)
  const scopedDebt = narrowByAgents(args.debtRows, args.agents)
  const companies = args.companies

  let salesCash = 0
  let salesQty = 0
  let lyCash = 0
  let lyQty = 0
  let openCash = 0
  let openQty = 0
  let openClients = 0
  let returnsCash = 0
  let returnsQty = 0
  const ordersParts: OrdersLast7DaysResult[] = []

  for (const coId of companies) {
    const def = companyDef(coId)
    if (!def) continue

    const sales = computeSalesMtd(scopedRows, coId, dateCtx.curYear, dateCtx.curMonth)
    salesCash += sales.cash
    salesQty += sales.qty
    lyCash += sales.lyCash
    lyQty += sales.lyQty

    const openTag = resolveOpenOrdersTag(scopedRows, def.openOrdersTag)
    const open = computeOpenOrders(scopedRows, openTag)
    openCash += open.cash
    openQty += open.qty
    openClients += open.clients

    const returns = computeReturnsMtd(scopedRows, def.returnsTag, dateCtx.curYear, dateCtx.curMonth)
    returnsCash += returns.cash
    returnsQty += returns.qty

    const ordersTag = resolveOrdersTag(scopedRows, def.ordersTag)
    ordersParts.push(computeOrdersLast7DaysByAgent(scopedRows, ordersTag, dateCtx.todayStr))
  }

  const debtData = companies.flatMap(co => debtRowsForCompany(scopedDebt, co))
  const openDebt = computeDebtSummary(debtData)

  const receipts = buildSmReceipts({
    receiptsMonthlyByAgent: args.receiptsMonthlyByAgent,
    companies,
    agents: args.agents,
  })

  return {
    salesMtd: {
      cash: salesCash,
      qty: salesQty,
      lyCash,
      lyQty,
      lyChangeCashPct: lyCash > 0 ? ((salesCash - lyCash) / lyCash) * 100 : null,
    },
    openOrders: {
      clients: openClients,
      cash: openCash,
      qty: openQty,
    },
    returnsMtd: { cash: returnsCash, qty: returnsQty },
    openDebt,
    ordersLast7Days: ordersParts.length ? mergeOrdersLast7Days(ordersParts) : emptyOrdersLast7(),
    receipts,
  }
}

export interface BuildSmReceiptsArgs {
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
  companies: LogicalCompany[]
  /** Suite / window agent set. null/[] = every agent present under allowed companies. */
  agents?: string[] | null
}

/**
 * Receipts for the suite: suite agents ∩ allowed companies.
 * Does **not** use hardcoded RECEIPTS_TEAM_AGENTS.
 */
export function buildSmReceipts(args: BuildSmReceiptsArgs): SmReceiptsMetrics {
  const byCompany = args.receiptsMonthlyByAgent ?? {}
  const allowed = new Set(args.companies.map(String))
  const restrictAgents =
    Array.isArray(args.agents) && args.agents.length > 0 ? new Set(args.agents.map(String)) : null

  const byAgent: Record<string, Record<string, number>> = {}

  for (const [company, agentMaps] of Object.entries(byCompany)) {
    if (!allowed.has(company)) continue
    for (const [agent, months] of Object.entries(agentMaps || {})) {
      if (restrictAgents && !restrictAgents.has(agent)) continue
      if (!byAgent[agent]) byAgent[agent] = {}
      for (const [ym, v] of Object.entries(months || {})) {
        byAgent[agent][ym] = (byAgent[agent][ym] || 0) + (Number(v) || 0)
      }
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

/** Debt rows for a suite window: access companies ∩ optional agent scope. */
export function buildSmDebtRows(args: {
  debtRows: DebtRow[]
  companies: LogicalCompany[]
  agents?: string[] | null
}): DebtRow[] {
  const scoped = narrowByAgents(args.debtRows, args.agents)
  return args.companies.flatMap(co => debtRowsForCompany(scoped, co))
}

/** Top 10 open-order SKUs across allowed companies for the window agents. */
export function buildSmOpenOrdersTop10(args: {
  rows: SalesRow[]
  companies: LogicalCompany[]
  agents?: string[] | null
}): Top10Item[] {
  const scoped = narrowByAgents(args.rows, args.agents)
  const matched: SalesRow[] = []
  for (const coId of args.companies) {
    const def = companyDef(coId)
    if (!def) continue
    const tag = resolveOpenOrdersTag(scoped, def.openOrdersTag)
    matched.push(...scoped.filter(r => r.company === tag))
  }
  return computeTop10BySku(matched)
}

/** Top 10 returns SKUs (MTD) across allowed companies for the window agents. */
export function buildSmReturnsTop10(args: {
  rows: SalesRow[]
  companies: LogicalCompany[]
  agents?: string[] | null
  dateCtx?: OversiteDateContext
}): Top10Item[] {
  const dateCtx = args.dateCtx ?? getOversiteDateContext()
  const scoped = narrowByAgents(args.rows, args.agents)
  const matched: SalesRow[] = []
  for (const coId of args.companies) {
    const def = companyDef(coId)
    if (!def) continue
    matched.push(
      ...scoped.filter(
        r =>
          r.company === def.returnsTag &&
          Number(r.year) === dateCtx.curYear &&
          Number(r.month) === dateCtx.curMonth,
      ),
    )
  }
  return computeTop10BySku(matched, 10, 'low-first')
}
