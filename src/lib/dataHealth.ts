import type { MessageKey } from '../i18n/types'
import type { LogicalCompany, SalesRow } from '../types/dashboard'

export interface DataHealthResult {
  ok: boolean
  messageKey: MessageKey | null
}

export function checkOrdersDataHealth(
  rows: SalesRow[],
  companies: LogicalCompany[],
): DataHealthResult {
  const hasPupik = companies.includes('pupik')
  const hasMt = companies.includes('mt')

  let ordersPupik = 0
  let ordersMt = 0
  let openPupik = 0
  let openMt = 0

  for (const r of rows) {
    switch (r.company) {
      case 'orders-pupik':
        ordersPupik++
        break
      case 'orders-mt':
        ordersMt++
        break
      case 'openorders':
        openPupik++
        break
      case 'openorders-mt':
        openMt++
        break
      default:
        break
    }
  }

  if (hasPupik && ordersPupik < 1000 && openPupik > 2000) {
    return { ok: false, messageKey: 'health.ordersTagSwapPupik' }
  }

  if (hasMt && ordersMt < 1000 && openMt > 500) {
    return { ok: false, messageKey: 'health.ordersTagSwapMt' }
  }

  if (hasPupik && hasMt && openPupik === 0 && openMt === 0 && ordersPupik > 0) {
    return { ok: false, messageKey: 'health.openOrdersBothMissing' }
  }

  if (hasPupik && openPupik === 0 && ordersPupik > 0) {
    return { ok: false, messageKey: 'health.openOrdersPupikMissing' }
  }

  if (hasMt && ordersMt > 1000 && openMt === 0) {
    return { ok: false, messageKey: 'health.openOrdersMtMissing' }
  }

  return { ok: true, messageKey: null }
}
