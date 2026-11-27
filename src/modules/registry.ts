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
  /** The group tab this page sits under in the sidebar. A user needs the group AND the page to see it. */
  group?: string
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
  // Group tab "Cards": its own grant, shown in the user editor right above the pages inside it. Both must be ticked.
  { id: 'rnd_grp_cards', label: 'Cards (group tab)', path: '/rnd/client', section: 'rnd', subpage: true },
  { id: 'rnd_client_card', label: 'Client card', path: '/rnd/client', section: 'rnd', subpage: true, group: 'rnd_grp_cards' },
  { id: 'rnd_item_card', label: 'Item card', path: '/rnd/item', section: 'rnd', subpage: true, group: 'rnd_grp_cards' },
  // Group tab "Import": Order recommendation + Import stock cover. Same rule as Cards: group AND page must be granted.
  { id: 'rnd_grp_import', label: 'Import (group tab)', path: '/rnd/order-reco', section: 'rnd', subpage: true },
  { id: 'rnd_order_reco', label: 'Order recommendation', path: '/rnd/order-reco', section: 'rnd', subpage: true, group: 'rnd_grp_import' },
  { id: 'rnd_import_cover', label: 'Import stock cover', path: '/rnd/import-cover', section: 'rnd', subpage: true, group: 'rnd_grp_import' },
  { id: 'rnd_sales_specifics', label: 'Sales specifics', path: '/rnd/sales-specifics', section: 'rnd', subpage: true },
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
  /** The group tab this button sits under (see NAV_GROUPS). */
  group?: string
}

export const NAV_EXTRAS: NavExtra[] = [
  { id: 'stock_brand', label: 'Stock by brand', path: '/stock-brand', section: 'operations' },
  { id: 'stock_history', label: 'Stock history', path: '/stock-history', section: 'operations' },
  { id: 'items_index', label: 'Items', path: '/items', section: 'operations', hideKey: 'date.items' },
  { id: 'rnd_monthly', label: 'Monthly data', path: '/rnd/monthly', section: 'rnd' },
  { id: 'rnd_yearly', label: 'Multi-year data', path: '/rnd/yearly', section: 'rnd' },
  { id: 'rnd_year', label: 'Yearly data', path: '/rnd/year', section: 'rnd' },
  { id: 'rnd_client_card', label: 'Client card', path: '/rnd/client', section: 'rnd', group: 'rnd_grp_cards' },
  { id: 'rnd_item_card', label: 'Item card', path: '/rnd/item', section: 'rnd', group: 'rnd_grp_cards' },
  { id: 'rnd_order_reco', label: 'Order recommendation', path: '/rnd/order-reco', section: 'rnd', group: 'rnd_grp_import' },
  { id: 'rnd_import_cover', label: 'Import stock cover', path: '/rnd/import-cover', section: 'rnd', group: 'rnd_grp_import' },
  { id: 'rnd_sales_specifics', label: 'Sales specifics', path: '/rnd/sales-specifics', section: 'rnd' },
  // R&D > Expenses (ERP report 801): super admin only for now, so they are not grantable modules.
  { id: 'exp_group', label: 'Expenses — group', path: '/expenses/group', section: 'rnd', superAdminOnly: true, group: 'grp_expenses' },
  { id: 'exp_company', label: 'Expenses — company', path: '/expenses/company', section: 'rnd', superAdminOnly: true, group: 'grp_expenses' },
  { id: 'exp_cards', label: 'Expense cards', path: '/expenses/cards', section: 'rnd', superAdminOnly: true, group: 'grp_expenses' },
]

/**
 * Group tabs of the sidebar: one button that opens a dropdown of its pages. A group is shown when at least one of its pages is
 * visible to the user; for a grantable group (rnd_grp_cards) the page's own grant is only honoured when the group is granted too.
 */
export interface NavGroup { id: string; section: NavSection }
export const NAV_GROUPS: NavGroup[] = [
  { id: 'grp_expenses', section: 'rnd' }, // super admin only: all its pages are
  { id: 'rnd_grp_cards', section: 'rnd' },
  { id: 'rnd_grp_import', section: 'rnd' },
]

/** page id -> the grantable group that must also be granted. */
export const GROUP_OF_PAGE: Record<string, string> = Object.fromEntries(
  MODULE_REGISTRY.filter(m => m.group).map(m => [m.id, m.group as string]),
)

export function pathForModule(id: DashboardModuleId): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.path ?? '/oversite'
}
