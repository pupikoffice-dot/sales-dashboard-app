/**
 * Individual Oversight sections that can be shown/hidden per user (distinct
 * from the page-level DashboardModuleId — this is granular visibility inside
 * the Oversight page itself). IDs match OversiteSegment in
 * oversiteSourceFiles.ts for the sections that map 1:1 to a top-level
 * OversiteSection (Delivery Notes is a sub-block of Sales MTD, not its own
 * toggle).
 */
export type OversiteModuleId =
  | 'ordersToday'
  | 'ordersMtd'
  | 'openOrders'
  | 'salesMtd'
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
  { id: 'topItems', label: 'Top 10 Items' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'returns', label: 'Returns MTD' },
  { id: 'debt', label: 'Open Debt' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'stockAlerts', label: 'Stock Alerts' },
]

export const ALL_OVERSITE_MODULE_IDS: OversiteModuleId[] = OVERSITE_MODULE_REGISTRY.map(m => m.id)
