import type { DashboardModuleId } from '../types/dashboard'

export type ModuleSection = 'main' | 'operations'

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
  { id: 'stock', label: 'Stock', path: '/stock', section: 'main' },
  { id: 'export', label: 'Export', path: '/export', section: 'main' },
  { id: 'ops_deliveries', label: 'Deliveries', path: '/operations/deliveries', section: 'operations' },
]

export function pathForModule(id: DashboardModuleId): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.path ?? '/oversite'
}
