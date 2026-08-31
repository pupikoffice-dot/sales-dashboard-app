import type { OversightMode } from '../types/uiModules'

/** Roles that keep sidebar navigation even on the Sales Agent suite. */
const NAV_VISIBLE_ROLES = new Set(['super_admin', 'admin', 'manager', 'cco'])

/**
 * Hide sidebar nav only for field agents on the Sales Agent suite.
 * Real super admins, admins, sales managers, and CCO always keep navigation.
 */
export function shouldHideNavForSalesAgentSuite(opts: {
  isRealSuperAdmin: boolean
  role: string | null | undefined
  oversightMode: OversightMode & { isLoading: boolean }
}): boolean {
  if (opts.isRealSuperAdmin) return false
  const { oversightMode } = opts
  if (oversightMode.isLoading) return false
  if (oversightMode.mode !== 'suite' || oversightMode.suiteId !== 'sales_agent') return false
  const role = opts.role
  // Hide once suite is confirmed unless a privileged role is explicitly known.
  if (role && NAV_VISIBLE_ROLES.has(role)) return false
  return true
}
