import type { LogicalCompany } from '../types/dashboard'

const COMPANY_MAP: Record<string, LogicalCompany> = {
  pupik: 'pupik',
  mt: 'mt',
  grow: 'grow',
  gold: 'gold',
  'orders-pupik': 'pupik',
  'orders-mt': 'mt',
  'orders-grow': 'grow',
  'orders-gold': 'gold',
  openorders: 'pupik',
  'openorders-mt': 'mt',
  'openorders-grow': 'grow',
  'openorders-gold': 'gold',
  'delivery720-pupik': 'pupik',
  'delivery720-mt': 'mt',
  'delivery720-grow': 'grow',
  'delivery720-gold': 'gold',
  'returns-pupik': 'pupik',
  'returns-mt': 'mt',
  'returns-grow': 'grow',
  'returns-gold': 'gold',
}

export function resolveLogicalCompany(company: string): LogicalCompany | null {
  return COMPANY_MAP[company] ?? null
}
