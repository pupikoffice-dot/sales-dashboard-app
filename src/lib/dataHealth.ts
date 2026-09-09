import type { MessageKey } from '../i18n/types'
import type { LogicalCompany, SalesRow } from '../types/dashboard'

export interface DataHealthResult {
  ok: boolean
  messageKey: MessageKey | null
}

/**
 * Detects broken Excel exports / tag swaps in the live sales payload.
 *
 * The "open orders missing from export" checks only run for company-wide
 * access (agents null/empty). Agent-scoped users can legitimately have zero
 * open orders of their own even when the 721 sheet is fine — for example Or
 * switched to the Monkeytime account (agents 54/1/57/56) while the only two
 * MT open-order rows in the DB belonged to agent 55.
 */
export function checkOrdersDataHealth(
  rows: SalesRow[],
  companies: LogicalCompany[],
  agents: string[] | null = null,
): DataHealthResult {
  const hasPupik = companies.includes('pupik')
  const hasMt = companies.includes('mt')
  const companyWide = !Array.isArray(agents) || agents.length === 0

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

  if (hasPupik && ordersPupik === 0 && ordersMt > 1000) {
    return { ok: false, messageKey: 'health.ordersPupikMissing' }
  }

  if (hasPupik && ordersPupik < 1000 && openPupik > 2000) {
    return { ok: false, messageKey: 'health.ordersTagSwapPupik' }
  }

  if (hasMt && ordersMt < 1000 && openMt > 500) {
    return { ok: false, messageKey: 'health.ordersTagSwapMt' }
  }

  // Export-completeness alarms: only meaningful when the caller sees the whole
  // company. An agent with no open orders of their own is a normal state.
  if (companyWide) {
    if (hasPupik && hasMt && openPupik === 0 && openMt === 0 && ordersPupik > 0) {
      return { ok: false, messageKey: 'health.openOrdersBothMissing' }
    }

    if (hasPupik && openPupik === 0 && ordersPupik > 0) {
      return { ok: false, messageKey: 'health.openOrdersPupikMissing' }
    }

    if (hasMt && ordersMt > 1000 && openMt === 0) {
      return { ok: false, messageKey: 'health.openOrdersMtMissing' }
    }
  }

  return { ok: true, messageKey: null }
}
