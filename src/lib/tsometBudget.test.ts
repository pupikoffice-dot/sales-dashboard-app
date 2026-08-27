import { describe, expect, it } from 'vitest'
import { buildTsometBudgetRows, isOpenBudgetLow, sumTsometBudgetRows } from './tsometBudget'
import type { SalesRow } from '../types/dashboard'

const budget = [
  {
    store_number: '10',
    store_name: 'Store A',
    budget_cash: 1000,
    erp_number: '5001',
    agent_number: '24',
  },
  {
    store_number: '20',
    store_name: 'Store B',
    budget_cash: 500,
    erp_number: '5002',
    agent_number: '30',
  },
]

const sales = [
  { store_number: '10', qty: 5, cash: 200, report_date: '2026-08-15' },
]

function order(clientID: string, cash: number): SalesRow {
  return { company: 'orders-mt', clientID, cash, date: '2026-08-10' }
}

describe('buildTsometBudgetRows', () => {
  it('filters by window agents', () => {
    const { rows } = buildTsometBudgetRows({
      budget,
      sales,
      ordersMtdRows: [],
      agents: ['24'],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].storeNumber).toBe('10')
  })

  it('sums Orders MTD cash by ERP and computes open budget', () => {
    const { rows } = buildTsometBudgetRows({
      budget,
      sales,
      ordersMtdRows: [order('5001', 100), order('5001', 50), order('5002', 10)],
      agents: ['24'],
    })
    expect(rows[0].ordersMtdCash).toBe(150)
    expect(rows[0].openBudget).toBe(850)
  })

  it('looks up sales cash by store number and exposes report date', () => {
    const { rows, reportDate } = buildTsometBudgetRows({
      budget,
      sales,
      ordersMtdRows: [],
      agents: null,
    })
    expect(rows.find(r => r.storeNumber === '10')?.salesCash).toBe(200)
    expect(rows.find(r => r.storeNumber === '20')?.salesCash).toBe(0)
    expect(reportDate).toBe('2026-08-15')
  })

  it('shows all stores when agents is null', () => {
    const { rows } = buildTsometBudgetRows({
      budget,
      sales: [],
      ordersMtdRows: [],
      agents: null,
    })
    expect(rows).toHaveLength(2)
  })
})

describe('isOpenBudgetLow', () => {
  it('flags when open budget is under 20% of budget', () => {
    expect(isOpenBudgetLow({ budgetCash: 1000, openBudget: 199 })).toBe(true)
    expect(isOpenBudgetLow({ budgetCash: 1000, openBudget: 200 })).toBe(false)
    expect(isOpenBudgetLow({ budgetCash: 1000, openBudget: 500 })).toBe(false)
  })

  it('does not flag when budget is zero', () => {
    expect(isOpenBudgetLow({ budgetCash: 0, openBudget: 0 })).toBe(false)
  })
})

describe('sumTsometBudgetRows', () => {
  it('sums numeric columns', () => {
    const { rows } = buildTsometBudgetRows({
      budget,
      sales: [],
      ordersMtdRows: [],
      agents: null,
    })
    const totals = sumTsometBudgetRows(rows)
    expect(totals.budgetCash).toBe(1500)
    expect(totals.openBudget).toBe(1500)
  })
})
