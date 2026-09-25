import type { DashboardAccess } from '../types/dashboard'
import type { OversiteModuleId } from './oversiteModules'

/** Per-user Oversight section visibility (classic sections + Sales MTD add-ons). */
export function canShowOversiteModule(
  access: DashboardAccess | null,
  moduleId: OversiteModuleId,
  isSuperAdmin = false,
): boolean {
  if (!access?.active) return false
  if (isSuperAdmin) return true
  const mods = access.oversiteModules ?? []
  if (!mods.includes(moduleId)) return false
  // Delivery notes (720) is an add-on inside the Sales MTD card — requires both grants.
  if (moduleId === 'deliveryNotes') return mods.includes('salesMtd')
  return true
}
