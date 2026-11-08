import type { DashboardModuleId } from '../types/dashboard'

export type ModuleSection = 'main' | 'operations' | 'rnd'
export type NavSection = ModuleSection

export interface ModuleDef {
  id: DashboardModuleId
  label: string
  path: string
  section: ModuleSection
  /** A page inside a section menu rather than a top-level module. */
  subpage?: boolean
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
  // Pages inside a section menu. Each is its own grant in dashboard_user_access.modules (migration 20261108120000), so the
  // user editor can allow Item card and refuse Yearly data. `subpage`: no "default module" option, not a top-level button.
  { id: 'stock_brand', label: 'Stock by brand', path: '/stock-brand', section: 'operations', subpage: true },
  { id: 'stock_history', label: 'Stock history', path: '/stock-history', section: 'operations', subpage: true },
  { id: 'items_index', label: 'Items', path: '/items', section: 'operations', subpage: true },
  { id: 'rnd_monthly', label: 'Monthly data', path: '/rnd/monthly', section: 'rnd', subpage: true },
  { id: 'rnd_yearly', label: 'Multi-year data', path: '/rnd/yearly', section: 'rnd', subpage: true },
  { id: 'rnd_year', label: 'Yearly data', path: '/rnd/year', section: 'rnd', subpage: true },
  { id: 'rnd_client_card', label: 'Client card', path: '/rnd/client', section: 'rnd', subpage: true },
  { id: 'rnd_item_card', label: 'Item card', path: '/rnd/item', section: 'rnd', subpage: true },
]

/**
 * Sidebar buttons that are not grantable modules (they do not appear as permission checkboxes).
 *  - follows: legacy; every page is now its own module id, so this is no longer used
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
  { id: 'stock_brand', label: 'Stock by brand', path: '/stock-brand', section: 'operations' },
  { id: 'stock_history', label: 'Stock history', path: '/stock-history', section: 'operations' },
  { id: 'items_index', label: 'Items', path: '/items', section: 'operations', hideKey: 'date.items' },
  { id: 'rnd_monthly', label: 'Monthly data', path: '/rnd/monthly', section: 'rnd' },
  { id: 'rnd_yearly', label: 'Multi-year data', path: '/rnd/yearly', section: 'rnd' },
  { id: 'rnd_year', label: 'Yearly data', path: '/rnd/year', section: 'rnd' },
  { id: 'rnd_client_card', label: 'Client card', path: '/rnd/client', section: 'rnd' },
  { id: 'rnd_item_card', label: 'Item card', path: '/rnd/item', section: 'rnd' },
]

export function pathForModule(id: DashboardModuleId): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.path ?? '/oversite'
}
