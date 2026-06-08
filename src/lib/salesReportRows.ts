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
    if (!filters.selectedClientIds.size) {
      return rows.filter(r => r.clientID)
    }
    return rows.filter(r => r.clientID && filters.selectedClientIds.has(r.clientID))
  }

  if (filters.view === 'items') {
    return rows.filter(r => {
      const cat =
        (filters.catType === 'tablet' ? r.tabletCat : r.groupCat) || '(No Category)'
      const catOk =
        !filters.selectedCategories.size ||
        filters.selectedCategories.has(String(cat))
      const skuOk =
        !filters.selectedItemSkus.size ||
        filters.selectedItemSkus.has(r.itemSKU || '(No SKU)')
      return catOk && skuOk
    })
  }

  return rows
}
