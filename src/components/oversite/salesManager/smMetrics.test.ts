import { describe, expect, it } from 'vitest'
import type { DebtRow, LogicalCompany, SalesRow } from '../../../types/dashboard'
import { getOversiteDateContext } from '../../../lib/oversiteMetrics'
import { buildSmSuiteKpis } from './smMetrics'

function salesRow(partial: Partial<SalesRow> & Pick<SalesRow, 'company'>): SalesRow {
  return {
    cash: 0,
    qty: 0,
    agent: '',
    clientID: '',
    ...partial,
  }
}

function debtRow(partial: Partial<DebtRow> & Pick<DebtRow, 'company' | 'agent' | 'clientID'>): DebtRow {
  return {
    clientName: 'Client',
    oldDebt: 0,
    months: [],
    ...partial,
  }
}

const dateCtx = getOversiteDateContext(new Date(2026, 7, 20)) // Aug 2026

describe('buildSmSuiteKpis', () => {
  it('aggregates sales MTD across all allowed companies for scoped agents', () => {
    const rows: SalesRow[] = [
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 100,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'mt',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 50,
        qty: 2,
        clientID: '2',
      }),
      // Out of agent scope — must be ignored when agents=['24']
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '99',
        cash: 999,
        qty: 9,
        clientID: '3',
      }),
    ]

    const kpis = buildSmSuiteKpis({
      rows,
      debtRows: [],
      companies: ['pupik', 'mt'],
      agents: ['24'],
      dateCtx,
    })

    expect(kpis.salesMtd.cash).toBe(150)
    expect(kpis.salesMtd.qty).toBe(3)
  })

  it('does not read sidebar filter company when building suite KPIs', () => {
    const sidebarSelectedCompany: LogicalCompany = 'pupik' // decoy — must never drive suite KPIs
    void sidebarSelectedCompany

    const rows: SalesRow[] = [
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 10,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'mt',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 40,
        qty: 1,
        clientID: '2',
      }),
    ]

    // Suite always receives access.companies (all allowed), never sidebar selection.
    const kpis = buildSmSuiteKpis({
      rows,
      debtRows: [],
      companies: ['pupik', 'mt'],
      agents: null,
      dateCtx,
    })

    expect(kpis.salesMtd.cash).toBe(50)
  })

  it('aggregates open orders, returns, and debt across allowed companies', () => {
    const rows: SalesRow[] = [
      salesRow({ company: 'openorders', agent: '24', cash: 20, qty: 1, clientID: 'c1' }),
      salesRow({ company: 'openorders-mt', agent: '24', cash: 30, qty: 2, clientID: 'c2' }),
      salesRow({
        company: 'returns-pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: -5,
        qty: -1,
        clientID: 'c1',
      }),
      salesRow({
        company: 'returns-mt',
        year: 2026,
        month: 8,
        agent: '24',
        cash: -15,
        qty: -2,
        clientID: 'c2',
      }),
    ]
    const debtRows: DebtRow[] = [
      debtRow({ company: 'pupik', agent: '24', clientID: '10', oldDebt: 100 }),
      debtRow({ company: 'mt', agent: '24', clientID: '20', oldDebt: 200 }),
      debtRow({ company: 'pupik', agent: '99', clientID: '30', oldDebt: 999 }),
    ]

    const kpis = buildSmSuiteKpis({
      rows,
      debtRows,
      companies: ['pupik', 'mt'],
      agents: ['24'],
      dateCtx,
    })

    expect(kpis.openOrders.cash).toBe(50)
    expect(kpis.openOrders.qty).toBe(3)
    expect(kpis.openOrders.clients).toBe(2)
    expect(kpis.returnsMtd.cash).toBe(-20)
    expect(kpis.returnsMtd.qty).toBe(-3)
    expect(kpis.openDebt?.grandTotal).toBe(300)
  })

  it('builds orders last-7-workdays across companies for scoped agents', () => {
    const rows: SalesRow[] = [
      salesRow({
        company: 'orders-pupik',
        date: '2026-08-20',
        agent: '24',
        cash: 70,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'orders-mt',
        date: '2026-08-20',
        agent: '24',
        cash: 30,
        qty: 1,
        clientID: '2',
      }),
      salesRow({
        company: 'orders-pupik',
        date: '2026-08-20',
        agent: '99',
        cash: 500,
        qty: 1,
        clientID: '3',
      }),
    ]

    const kpis = buildSmSuiteKpis({
      rows,
      debtRows: [],
      companies: ['pupik', 'mt'],
      agents: ['24'],
      dateCtx,
    })

    const todayCol = kpis.ordersLast7Days.days.find(d => d.date === '2026-08-20')
    expect(todayCol?.total).toBe(100)
    expect(todayCol?.byAgent['24']).toBe(100)
    expect(todayCol?.byAgent['99']).toBeUndefined()
  })

  it('scopes receipts to suite agents ∩ allowed companies, not RECEIPTS_TEAM_AGENTS', () => {
    const receiptsMonthlyByAgent = {
      pupik: {
        '24': { '2026-08': 118 }, // gross incl VAT
        '25': { '2026-08': 236 },
        '27': { '2026-08': 999 }, // classic team agent — must NOT auto-include
      },
      mt: {
        '24': { '2026-08': 118 },
        '54': { '2026-08': 500 }, // classic mt team — out of suite agent set
      },
    }

    const kpis = buildSmSuiteKpis({
      rows: [],
      debtRows: [],
      companies: ['pupik', 'mt'],
      agents: ['24', '25'],
      dateCtx,
      receiptsMonthlyByAgent,
    })

    // Net of VAT is a UI concern; builders expose gross monthly sums.
    expect(kpis.receipts.monthly['2026-08']).toBe(118 + 236 + 118)
    expect(kpis.receipts.agents.sort()).toEqual(['24', '25'])
    expect(kpis.receipts.byAgent['27']).toBeUndefined()
    expect(kpis.receipts.byAgent['54']).toBeUndefined()
    expect(kpis.receipts.byAgent['24']['2026-08']).toBe(236) // pupik+mt for agent 24
  })

  it('empty agents means all agents already present in scoped rows', () => {
    const rows: SalesRow[] = [
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 10,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        cash: 20,
        qty: 1,
        clientID: '2',
      }),
    ]

    const kpis = buildSmSuiteKpis({
      rows,
      debtRows: [],
      companies: ['pupik'],
      agents: [],
      dateCtx,
    })

    expect(kpis.salesMtd.cash).toBe(30)
  })
})
