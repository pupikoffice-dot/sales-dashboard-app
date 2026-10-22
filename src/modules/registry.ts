import type { DashboardModuleId } from '../types/dashboard'

export type ModuleSection = 'main' | 'operations' | 'rnd'
export type NavSection = ModuleSection

export interface ModuleDef {
  id: DashboardModuleId
  label: string
  path: string
  section: ModuleSection
}

export const MODULE_REGISTRY: ModuleDef[] = [
  { id: 'oversite', label: 'Oversite', path: '/oversite', section: 'main' },
  { id: 'sales_performance', label: 'Sales', path: '/sales', section: 'main' },
  { id: 'orders_mtd', label: 'Orders MTD', path: '/orders', section: 'main' },
  { id: 'open_orders', label: 'Open Orders', path: '/open-orders', section: 'main' },
  { id: 'returns', label: 'Returns', path: '/returns', section: 'main' },
  { id: 'debt', label: 'Debt', path: '/debt', section: 'main' },
  { id: 'stock_alerts', label: 'Stock Alerts', path: '/stock-alerts', section: 'main' },
  { id: 'export', label: 'Export', path: '/export', section: 'main' },
  { id: 'ops_deliveries', label: 'Deliveries', path: '/operations/deliveries', section: 'operations' },
  { id: 'stock', label: 'Stock', path: '/stock', section: 'operations' },
  // grants the whole R&D section (its pages are NAV_EXTRAS that follow this module); nothing is stored for it in dashboard_modules
  { id: 'rnd', label: 'R&D section', path: '/rnd/monthly', section: 'rnd' },
]

/**
 * Sidebar buttons that are not grantable modules (they do not appear as permission checkboxes).
 *  - follows: shown to anyone who has that module
 *  - hideKey: legacy Filter-panel hide key that still hides it (kept so existing per-user settings keep working)
 *  - superAdminOnly: super admin only (honours "View as")
 */
export interface NavExtra {
  id: string
  label: string
  path: string
  section: NavSection
  follows?: DashboardModuleId
  hideKey?: string
  superAdminOnly?: boolean
}

export const NAV_EXTRAS: NavExtra[] = [
  { id: 'stock_brand', label: 'Stock by brand', path: '/stock-brand', section: 'operations', follows: 'stock' },
  { id: 'stock_history', label: 'Stock history', path: '/stock-history', section: 'operations', follows: 'stock' },
  { id: 'items_index', label: 'Items', path: '/items', section: 'operations', hideKey: 'date.items' },
  { id: 'rnd_monthly', label: 'Monthly data', path: '/rnd/monthly', section: 'rnd', follows: 'rnd' },
]

export function pathForModule(id: DashboardModuleId): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.path ?? '/oversite'
}
