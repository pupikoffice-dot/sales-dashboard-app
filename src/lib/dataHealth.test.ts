import { describe, expect, it } from 'vitest'
import { checkOrdersDataHealth } from './dataHealth'
import type { SalesRow } from '../types/dashboard'

const row = (company: string): SalesRow => ({ company }) as SalesRow

describe('checkOrdersDataHealth', () => {
  it('flags missing MT open orders for company-wide access', () => {
    const rows = Array.from({ length: 1001 }, () => row('orders-mt'))
    const result = checkOrdersDataHealth(rows, ['mt'], null)
    expect(result).toEqual({ ok: false, messageKey: 'health.openOrdersMtMissing' })
  })

  it('does not flag missing MT open orders for an agent-scoped user', () => {
    // Agent team can have plenty of 722 orders and zero open 721 of their own —
    // that is not an export failure.
    const rows = Array.from({ length: 1001 }, () => row('orders-mt'))
    const result = checkOrdersDataHealth(rows, ['mt'], ['57', '54'])
    expect(result).toEqual({ ok: true, messageKey: null })
  })

  it('still flags a Pupik/MT tag swap for agent-scoped users', () => {
    const rows = [
      ...Array.from({ length: 100 }, () => row('orders-mt')),
      ...Array.from({ length: 600 }, () => row('openorders-mt')),
    ]
    const result = checkOrdersDataHealth(rows, ['mt'], ['57'])
    expect(result).toEqual({ ok: false, messageKey: 'health.ordersTagSwapMt' })
  })
})
