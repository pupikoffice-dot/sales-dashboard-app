/**
 * Individual Oversight sections that can be shown/hidden per user (distinct
 * from the page-level DashboardModuleId — this is granular visibility inside
 * the Oversight page itself). IDs match OversiteSegment in
 * oversiteSourceFiles.ts for the sections that map 1:1 to a top-level
 * Most map 1:1 to an OversiteSection. `deliveryNotes` is an add-on inside the
 * Sales MTD card (720 bar segment + collapsible), not a separate column card.
 */
export type OversiteModuleId =
  | 'ordersToday'
  | 'ordersMtd'
  | 'openOrders'
  | 'salesMtd'
  | 'deliveryNotes'
  | 'topItems'
  | 'suppliers'
  | 'returns'
  | 'debt'
  | 'receipts'
  | 'stockAlerts'

export interface OversiteModuleDef {
  id: OversiteModuleId
  label: string
}

export const OVERSITE_MODULE_REGISTRY: OversiteModuleDef[] = [
  { id: 'ordersToday', label: 'Orders Today' },
  { id: 'ordersMtd', label: 'Orders MTD' },
  { id: 'openOrders', label: 'Open Orders' },
  { id: 'salesMtd', label: 'Sales MTD' },
  { id: 'deliveryNotes', label: 'Delivery notes (720) in Sales MTD' },
  { id: 'topItems', label: 'Top 10 Items' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'returns', label: 'Returns MTD' },
  { id: 'debt', label: 'Open Debt' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'stockAlerts', label: 'Stock Alerts' },
]

/**
 * Summary totals. Visible to the super admin only — a user grant cannot turn them on.
 * Delivery notes sit inside the Sales MTD total, so they follow the same rule.
 */
export const SUPER_ADMIN_OVERSITE_MODULE_IDS: readonly OversiteModuleId[] = [
  'salesMtd',
  'ordersToday',
  'ordersMtd',
  'openOrders',
  'debt',
  'returns',
  'deliveryNotes',
]

export function isSuperAdminOversiteModule(id: string): boolean {
  return (SUPER_ADMIN_OVERSITE_MODULE_IDS as readonly string[]).includes(id)
}

export const ALL_OVERSITE_MODULE_IDS: OversiteModuleId[] = OVERSITE_MODULE_REGISTRY.map(m => m.id)
