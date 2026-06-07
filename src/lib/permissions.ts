import { resolveLogicalCompany } from './companyTags'
import type { DashboardAccess, DashboardModuleId, SalesRow } from '../types/dashboard'

export function canShowModule(access: DashboardAccess | null, moduleId: DashboardModuleId): boolean {
  if (!access?.active) return false
  return access.modules.includes(moduleId)
}

export function companyInScope(access: DashboardAccess, company: string): boolean {
  const logical = resolveLogicalCompany(company)
  if (!logical) return false
  return access.companies.includes(logical)
}

export function filterRows(access: DashboardAccess, rows: SalesRow[]): SalesRow[] {
  const agents = access.agents
  const hasAgentFilter = Array.isArray(agents) && agents.length > 0
  const agentSet = hasAgentFilter ? new Set(agents.map(a => String(a))) : null

  return rows.filter(r => {
    if (!companyInScope(access, r.company)) return false
    if (agentSet) {
      const a = r.agent != null ? String(r.agent) : ''
      if (!agentSet.has(a)) return false
    }
    return true
  })
}
