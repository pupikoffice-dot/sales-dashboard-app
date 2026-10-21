import { resolveLogicalCompany } from './companyTags'
import type { DashboardAccess, DashboardModuleId, SalesRow } from '../types/dashboard'

export function canShowModule(
  access: DashboardAccess | null,
  moduleId: DashboardModuleId,
  isSuperAdmin = false,
): boolean {
  if (!access?.active) return false
  if (isSuperAdmin) return true
  return access.modules.includes(moduleId)
}

export function companyInScope(access: DashboardAccess, company: string): boolean {
  const logical = resolveLogicalCompany(company)
  if (!logical) return false
  return access.companies.includes(logical)
}

/** Year of a sales row: its year field, else the first four characters of its date. */
export function rowYear(r: { year?: unknown; date?: unknown }): number | null {
  const y = Number(r.year)
  if (Number.isInteger(y) && y > 1999) return y
  const d = Number(String(r.date ?? '').slice(0, 4))
  return Number.isInteger(d) && d > 1999 ? d : null
}

export function filterRows(access: DashboardAccess, rows: SalesRow[]): SalesRow[] {
  const hiddenYears = new Set((access.hiddenYears ?? []).map(Number))
  const agents = access.agents
  const hasAgentFilter = Array.isArray(agents) && agents.length > 0
  const agentSet = hasAgentFilter ? new Set(agents.map(a => String(a))) : null

  return rows.filter(r => {
    if (!companyInScope(access, r.company)) return false
    if (hiddenYears.size) {
      const y = rowYear(r)
      if (y != null && hiddenYears.has(y)) return false
    }
    if (agentSet) {
      const a = r.agent != null ? String(r.agent) : ''
      if (!agentSet.has(a)) return false
    }
    return true
  })
}

export function canShowItemCost(access: DashboardAccess | null, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true
  return access?.active === true && access.showItemCost === true
}

export function canShowClientProfit(access: DashboardAccess | null, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true
  return access?.active === true && access.showClientProfit === true
}
