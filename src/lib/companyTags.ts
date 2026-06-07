import type { LogicalCompany } from '../types/dashboard'

const COMPANY_MAP: Record<string, LogicalCompany> = {
  pupik: 'pupik',
  mt: 'mt',
  grow: 'grow',
  'orders-pupik': 'pupik',
  'orders-mt': 'mt',
  openorders: 'pupik',
  'openorders-mt': 'mt',
  'openorders-grow': 'grow',
  'returns-pupik': 'pupik',
  'returns-mt': 'mt',
}

export function resolveLogicalCompany(company: string): LogicalCompany | null {
  return COMPANY_MAP[company] ?? null
}
