import type { SalesRow } from '../types/dashboard'

export interface TsometBudgetStore {
  store_number: string
  store_name: string
  budget_cash: number
  erp_number: string
  agent_number: string
}

export interface TsometSalesStore {
  store_number: string
  qty: number
  cash: number
  report_date: string | null
}

export interface TsometBudgetRow {
  erpNumber: string
  storeNumber: string
  storeName: string
  budgetCash: number
  ordersMtdCash: number
  openBudget: number
  salesCash: number
}

export interface BuildTsometBudgetRowsArgs {
  budget: TsometBudgetStore[]
  sales: TsometSalesStore[]
  /** Orders MTD rows already filtered to orders tag + month window. */
  ordersMtdRows: SalesRow[]
  /** Window agents; null/empty = no agent filter (show all budget stores). */
  agents: string[] | null
}

function normId(v: unknown): string {
  return String(v ?? '').trim()
}

/**
 * Build Tsomet Budget table rows.
 * - Rows from budget, filtered by designated agent (col E).
 * - Orders MTD cash matched by ERP (clientID === erp_number).
 * - Sales cash looked up by store number (display only).
 * - openBudget = budget − orders MTD.
 */
export function buildTsometBudgetRows(args: BuildTsometBudgetRowsArgs): {
  rows: TsometBudgetRow[]
  reportDate: string | null
} {
  const agentSet =
    args.agents && args.agents.length > 0
      ? new Set(args.agents.map(a => normId(a)))
      : null

  const salesByStore = new Map<string, TsometSalesStore>()
  let reportDate: string | null = null
  for (const s of args.sales) {
    const key = normId(s.store_number)
    if (!key) continue
    salesByStore.set(key, s)
    if (!reportDate && s.report_date) reportDate = s.report_date
  }

  const ordersCashByErp = new Map<string, number>()
  for (const r of args.ordersMtdRows) {
    const erp = normId(r.clientID)
    if (!erp) continue
    ordersCashByErp.set(erp, (ordersCashByErp.get(erp) ?? 0) + (Number(r.cash) || 0))
  }

  const rows: TsometBudgetRow[] = []
  for (const b of args.budget) {
    const agent = normId(b.agent_number)
    if (agentSet && !agentSet.has(agent)) continue

    const storeNumber = normId(b.store_number)
    const erpNumber = normId(b.erp_number)
    const budgetCash = Number(b.budget_cash) || 0
    const ordersMtdCash = erpNumber ? (ordersCashByErp.get(erpNumber) ?? 0) : 0
    const sales = salesByStore.get(storeNumber)
    const salesCash = sales ? Number(sales.cash) || 0 : 0

    rows.push({
      erpNumber,
      storeNumber,
      storeName: String(b.store_name ?? ''),
      budgetCash,
      ordersMtdCash,
      openBudget: budgetCash - ordersMtdCash,
      salesCash,
    })
  }

  rows.sort(
    (a, b) =>
      a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true }) ||
      a.erpNumber.localeCompare(b.erpNumber, undefined, { numeric: true }),
  )

  return { rows, reportDate }
}

export interface TsometBudgetTotals {
  budgetCash: number
  ordersMtdCash: number
  openBudget: number
  salesCash: number
}

export function sumTsometBudgetRows(rows: TsometBudgetRow[]): TsometBudgetTotals {
  return rows.reduce(
    (acc, r) => ({
      budgetCash: acc.budgetCash + r.budgetCash,
      ordersMtdCash: acc.ordersMtdCash + r.ordersMtdCash,
      openBudget: acc.openBudget + r.openBudget,
      salesCash: acc.salesCash + r.salesCash,
    }),
    { budgetCash: 0, ordersMtdCash: 0, openBudget: 0, salesCash: 0 },
  )
}

/** Agent-scoped Tsomet open-budget aggregate for KPI cubes. */
export function computeTsometOpenBudgetTotals(args: BuildTsometBudgetRowsArgs): TsometBudgetTotals {
  return sumTsometBudgetRows(buildTsometBudgetRows(args).rows)
}

/** Open budget under 20% of store budget → warn (red). */
export function isOpenBudgetLow(row: Pick<TsometBudgetRow, 'budgetCash' | 'openBudget'>): boolean {
  if (!(row.budgetCash > 0)) return false
  return row.openBudget < row.budgetCash * 0.2
}
