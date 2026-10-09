import type { DashboardAccess } from '../types/dashboard'
import { isSuperAdminOversiteModule, type OversiteModuleId } from './oversiteModules'

/** Per-user Oversight section visibility (classic sections + Sales MTD add-ons). */
export function canShowOversiteModule(
  access: DashboardAccess | null,
  moduleId: OversiteModuleId,
  isSuperAdmin = false,
): boolean {
  if (!access?.active) return false
  // Summary totals stay with the super admin even when a user grant lists them.
  if (isSuperAdminOversiteModule(moduleId)) return isSuperAdmin
  if (isSuperAdmin) return true
  const mods = access.oversiteModules ?? []
  if (!mods.includes(moduleId)) return false
  return true
}
