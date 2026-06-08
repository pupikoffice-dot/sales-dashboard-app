import type { DashboardFiltersState } from '../context/DashboardFiltersContext'

export function canApplyFilters(f: DashboardFiltersState): boolean {
  if (!f.company) return false
  if (f.dateMode === 'stock') return true
  if (f.dateMode === 'openorders') {
    return (
      (f.view === 'clients' && !!f.clientMode) ||
      (f.view === 'items' && !!f.catType && !!f.itemMode)
    )
  }
  const dateOk =
    f.dateMode === 'range' ? !!(f.dateFrom && f.dateTo) : f.selectedMonths.size > 0
  if (!dateOk) return false
  return (
    (f.view === 'clients' && !!f.clientMode) ||
    (f.view === 'items' && !!f.catType && !!f.itemMode)
  )
}
