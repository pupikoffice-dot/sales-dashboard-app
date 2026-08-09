import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import { filterByDate } from './salesDateFilter'
import { effectiveCompany } from './salesFilterLists'
import type { DashboardAccess } from '../types/dashboard'
import type { SalesRow } from '../types/dashboard'

function applyAgentFilter(rows: SalesRow[], access: DashboardAccess | null): SalesRow[] {
  if (!access) return rows
  const agents = access.agents
  if (!Array.isArray(agents) || agents.length === 0) return rows
  const agentSet = new Set(agents.map(a => String(a)))
  return rows.filter(r => {
    const a = r.agent != null ? String(r.agent) : ''
    return agentSet.has(a)
  })
}

export function getReportRows(
  allRows: SalesRow[],
  filters: DashboardFiltersState,
  access?: DashboardAccess | null,
): SalesRow[] {
  const effCo = effectiveCompany(filters.company, filters.dateMode)
  if (!effCo || filters.dateMode === 'stock') return []

  let rows = applyAgentFilter(
    allRows.filter(r => r.company === effCo),
    access ?? null,
  )

  if (filters.dateMode !== 'openorders') {
    rows = filterByDate(rows, filters)
  }

  if (filters.view === 'clients') {
    if (!filters.selectedClientIds.size) return []
    return rows.filter(r => r.clientID && filters.selectedClientIds.has(r.clientID))
  }

  if (filters.view === 'items') {
    if (!filters.selectedCategories.size || !filters.selectedItemSkus.size) return []
    return rows.filter(r => {
      const cat =
        (filters.catType === 'tablet' ? r.tabletCat : r.groupCat) || '(No Category)'
      return (
        filters.selectedCategories.has(String(cat)) &&
        filters.selectedItemSkus.has(r.itemSKU || '(No SKU)')
      )
    })
  }

  if (filters.view === 'suppliers') {
    if (!filters.selectedSuppliers.size) return []
    return rows.filter(r => filters.selectedSuppliers.has(String(r.supplier || '(No supplier)')))
  }

  return rows
}
