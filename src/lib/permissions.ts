import { resolveLogicalCompany } from './companyTags'
import type { DashboardAccess, DashboardModuleId, SalesRow } from '../types/dashboard'

/** Visible in sidebar and routable only for super_admin. */
export const SUPER_ADMIN_ONLY_MODULES: DashboardModuleId[] = [
  'sales_performance',
  'orders_mtd',
  'open_orders',
  'returns',
  'debt',
  'stock_alerts',
  'stock',
  'export',
]

export function canShowModule(
  access: DashboardAccess | null,
  moduleId: DashboardModuleId,
  isSuperAdmin = false,
): boolean {
  if (!access?.active) return false
  if (isSuperAdmin) return true
  if (SUPER_ADMIN_ONLY_MODULES.includes(moduleId)) return false
  return access.modules.includes(moduleId)
}

export function companyInScope(access: DashboardAccess, company: string): boolean {
  const logical = resolveLogicalCompany(company)
  if (!logical) return false
  return access.companies.includes(logical)
}

/** Company scope only — used for Oversite / 721 / 722 (legacy uses full company data, not per-agent). */
export function filterRowsByCompany(access: DashboardAccess, rows: SalesRow[]): SalesRow[] {
  return rows.filter(r => companyInScope(access, r.company))
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
