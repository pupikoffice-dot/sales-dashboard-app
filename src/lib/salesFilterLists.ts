import type { CatType, DateMode } from '../context/DashboardFiltersContext'
import { filterRowsByCompany } from './permissions'
import type { DashboardAccess } from '../types/dashboard'
import type { LogicalCompany, SalesRow } from '../types/dashboard'

export interface ListOption {
  id: string
  label: string
}

export function effectiveCompany(
  company: LogicalCompany | null,
  dateMode: DateMode,
): string | null {
  if (!company) return null
  if (dateMode !== 'openorders') return company
  if (company === 'mt') return 'openorders-mt'
  if (company === 'grow') return 'openorders-grow'
  return 'openorders'
}

/** All rows for the selected company tag — used to populate filter lists (legacy: S.raw, not agent-scoped). */
export function rowsForFilterLists(
  access: DashboardAccess,
  allRows: SalesRow[],
  company: LogicalCompany | null,
  dateMode: DateMode,
): SalesRow[] {
  const tag = effectiveCompany(company, dateMode)
  if (!tag || !company) return []
  return filterRowsByCompany(access, allRows).filter(r => r.company === tag)
}

export function buildClientOptions(rows: SalesRow[]): ListOption[] {
  const clients: Record<string, string> = {}
  rows.forEach(r => {
    if (!r.clientID) return
    if (!clients[r.clientID]) clients[r.clientID] = r.clientName || r.clientID
  })
  return Object.entries(clients)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, label]) => ({ id, label }))
}

export function buildCategoryOptions(rows: SalesRow[], catType: CatType): ListOption[] {
  const cats = new Set<string>()
  rows.forEach(r => {
    const v = (catType === 'tablet' ? r.tabletCat : r.groupCat) || '(No Category)'
    cats.add(String(v))
  })
  return [...cats].sort().map(c => ({ id: c, label: c }))
}

export function buildItemOptions(
  rows: SalesRow[],
  catType: CatType,
  selectedCategories: Set<string>,
): ListOption[] {
  const items: Record<string, string> = {}
  rows.forEach(r => {
    const cat = (catType === 'tablet' ? r.tabletCat : r.groupCat) || '(No Category)'
    if (!selectedCategories.has(String(cat))) return
    const sku = r.itemSKU || '(No SKU)'
    if (!items[sku]) items[sku] = r.itemName || sku
  })
  return Object.entries(items)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, label]) => ({ id, label }))
}
