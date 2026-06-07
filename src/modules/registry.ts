import type { DashboardModuleId } from '../types/dashboard'

export interface ModuleDef {
  id: DashboardModuleId
  label: string
  path: string
}

export const MODULE_REGISTRY: ModuleDef[] = [
  { id: 'oversite', label: 'Oversite', path: '/oversite' },
  { id: 'sales_performance', label: 'Sales', path: '/sales' },
  { id: 'orders_mtd', label: 'Orders MTD', path: '/orders' },
  { id: 'open_orders', label: 'Open Orders', path: '/open-orders' },
  { id: 'returns', label: 'Returns', path: '/returns' },
  { id: 'debt', label: 'Debt', path: '/debt' },
  { id: 'stock_alerts', label: 'Stock Alerts', path: '/stock-alerts' },
  { id: 'stock', label: 'Stock', path: '/stock' },
  { id: 'export', label: 'Export', path: '/export' },
]

export function pathForModule(id: DashboardModuleId): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.path ?? '/oversite'
}
