export type LogicalCompany = 'pupik' | 'mt' | 'grow' | 'gold'

export type DashboardModuleId =
  | 'oversite'
  | 'sales_performance'
  | 'orders_mtd'
  | 'open_orders'
  | 'returns'
  | 'debt'
  | 'stock_alerts'
  | 'stock'
  | 'export'

export interface DashboardAccess {
  userId: string
  modules: DashboardModuleId[]
  companies: LogicalCompany[]
  agents: string[] | null
  defaultModule: DashboardModuleId
  active: boolean
  showItemCost: boolean
  showClientProfit: boolean
  /** Which individual Oversight sections this user can see. Empty = none (opt-in). */
  oversiteModules: string[]
}

export interface SalesRow {
  company: string
  date?: string
  year?: number
  month?: number
  agent?: string
  clientID?: string
  clientName?: string
  docType?: string
  docNum?: string
  itemSKU?: string
  itemName?: string
  tabletCat?: string
  groupCat?: string
  qty?: number
  cash?: number
  [key: string]: unknown
}

export interface DebtMonth {
  label: string
  amount: number
}

export interface DebtRow {
  company: string
  agent: string
  clientID: string
  clientName: string
  oldDebt: number
  months: DebtMonth[]
}

export interface WmsRow {
  company: string
  itemSKU: string
  qtyInStock: number
  itemName?: string
}

export interface CostRow {
  company: string
  itemSKU: string
  cost: number
}

export interface PriceRow {
  company: string
  itemSKU: string
  price: number
}

export type SkuValueMap = Record<string, Record<string, number>>

/** Per-segment last-sync time per company: syncTimes[company][segment] = ISO8601. */
export type SyncTimes = Record<string, Record<string, string>>

export interface DashboardData {
  generated?: string
  totalRows?: number
  rows: SalesRow[]
  debtRows?: DebtRow[]
  debtLastUpdate?: string
  /** Debt DATA date per company (Debt clients.xlsm tab!B1), DD/MM/YYYY. */
  debtFileDates?: Record<string, string>
  /** Receipts (008): gross monthly sums per company keyed 'YYYY-MM'. Super-admin only. */
  receiptsMonthly?: Record<string, Record<string, number>>
  /** Receipts per agent: company -> agent -> 'YYYY-MM' -> gross sum. Super-admin only. */
  receiptsMonthlyByAgent?: Record<string, Record<string, Record<string, number>>>
  wmsRows?: WmsRow[]
  costRows?: CostRow[]
  priceRows?: PriceRow[]
  syncTimes?: SyncTimes
}
