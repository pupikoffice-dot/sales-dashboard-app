/** Minimal row shape used by shared sales logic (React + legacy). */
export interface SalesRow {
  company?: string
  clientID?: string
  clientName?: string
  itemSKU?: string
  itemName?: string
  cash?: number
  qty?: number
  year?: number
  month?: number
  date?: string
  tabletCat?: string
  groupCat?: string
}

export interface DateFilterInput {
  dateMode: 'range' | 'months' | 'openorders' | 'stock'
  dateFrom: string
  dateTo: string
  selectedMonths: Set<string>
}
