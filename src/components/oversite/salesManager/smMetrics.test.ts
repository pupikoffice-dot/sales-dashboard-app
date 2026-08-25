import { describe, expect, it } from 'vitest'
import type { DebtRow, LogicalCompany, SalesRow } from '../../../types/dashboard'
import { getOversiteDateContext } from '../../../lib/oversiteMetrics'
import {
  buildSmSuiteKpis,
  buildSmVsAgentSeries,
  buildSmVsAgentSeriesFromKpis,
  partitionSalesRowsByTag,
} from './smMetrics'

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
  it('computes sales MTD for one company only (never combines)', () => {
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

    const pupik = buildSmSuiteKpis({
      rows,
      debtRows: [],
      company: 'pupik',
      agents: ['24'],
      dateCtx,
    })
    const mt = buildSmSuiteKpis({
      rows,
      debtRows: [],
      company: 'mt',
      agents: ['24'],
      dateCtx,
    })

    expect(pupik.salesMtd.cash).toBe(100)
    expect(pupik.salesMtd.qty).toBe(1)
    expect(mt.salesMtd.cash).toBe(50)
    expect(mt.salesMtd.qty).toBe(2)
  })

  it('does not use sidebar filter company — caller passes the access company block', () => {
    const sidebarSelectedCompany: LogicalCompany = 'pupik' // decoy
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

    // UI stacks companies; each call is one access company, never sidebar selection.
    const kpis = buildSmSuiteKpis({
      rows,
      debtRows: [],
      company: 'mt',
      agents: null,
      dateCtx,
    })

    expect(kpis.salesMtd.cash).toBe(40)
  })

  it('scopes open orders, returns, and debt to one company', () => {
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

    const pupik = buildSmSuiteKpis({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24'],
      dateCtx,
    })

    expect(pupik.openOrders.cash).toBe(20)
    expect(pupik.openOrders.qty).toBe(1)
    expect(pupik.openOrders.clients).toBe(1)
    expect(pupik.returnsMtd.cash).toBe(-5)
    expect(pupik.returnsMtd.qty).toBe(-1)
    expect(pupik.openDebt?.grandTotal).toBe(100)
  })

  it('builds orders last-7-workdays for one company only', () => {
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
      company: 'pupik',
      agents: ['24'],
      dateCtx,
    })

    const todayCol = kpis.ordersLast7Days.days.find(d => d.date === '2026-08-20')
    expect(todayCol?.total).toBe(70)
    expect(todayCol?.byAgent['24']).toBe(70)
    expect(todayCol?.byAgent['99']).toBeUndefined()
  })

  it('scopes receipts to one company ∩ suite agents', () => {
    const receiptsMonthlyByAgent = {
      pupik: {
        '24': { '2026-08': 118 },
        '25': { '2026-08': 236 },
        '27': { '2026-08': 999 },
      },
      mt: {
        '24': { '2026-08': 118 },
        '54': { '2026-08': 500 },
      },
    }

    const kpis = buildSmSuiteKpis({
      rows: [],
      debtRows: [],
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
      receiptsMonthlyByAgent,
    })

    expect(kpis.receipts.monthly['2026-08']).toBe(118 + 236)
    expect(kpis.receipts.agents.sort()).toEqual(['24', '25'])
    expect(kpis.receipts.byAgent['27']).toBeUndefined()
    expect(kpis.receipts.byAgent['54']).toBeUndefined()
    expect(kpis.receipts.byAgent['24']['2026-08']).toBe(118)
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
      company: 'pupik',
      agents: [],
      dateCtx,
    })

    expect(kpis.salesMtd.cash).toBe(30)
  })
})

describe('buildSmVsAgentSeries', () => {
  it('builds per-agent sales and debt for one company only', () => {
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
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        cash: 40,
        qty: 1,
        clientID: '2',
      }),
      salesRow({
        company: 'mt',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 999,
        qty: 1,
        clientID: '3',
      }),
    ]
    const debtRows: DebtRow[] = [
      debtRow({ company: 'pupik', agent: '24', clientID: '10', oldDebt: 50 }),
      debtRow({ company: 'pupik', agent: '25', clientID: '11', oldDebt: 20 }),
      debtRow({ company: 'mt', agent: '24', clientID: '12', oldDebt: 700 }),
    ]

    const series = buildSmVsAgentSeries({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
      targets: { '24': 200, '25': 100 },
      goalsReady: true,
    })

    expect(series.company).toBe('pupik')
    expect(series.agents).toHaveLength(2)
    expect(series.agents[0]).toMatchObject({
      agentId: '24',
      salesMtdCash: 100,
      goalCash: 200,
      openDebtCash: 50,
    })
    expect(series.agents[1]).toMatchObject({
      agentId: '25',
      salesMtdCash: 40,
      goalCash: 100,
      openDebtCash: 20,
    })
    expect(series.ordersLast7Days).toBeDefined()
  })
})

describe('oversight speed — golden (same numbers)', () => {
  it('partitioned buildSmSuiteKpis matches shared partition + FromKpis Vs', () => {
    const rows: SalesRow[] = [
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 100,
        qty: 2,
        clientID: '1',
      }),
      salesRow({
        company: 'pupik',
        year: 2025,
        month: 8,
        agent: '24',
        cash: 80,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'openorders',
        agent: '24',
        cash: 15,
        qty: 1,
        clientID: '9',
      }),
      salesRow({
        company: 'returns-pupik',
        year: 2026,
        month: 8,
        agent: '24',
        cash: -5,
        qty: -1,
        clientID: '1',
      }),
      salesRow({
        company: 'orders-pupik',
        date: '2026-08-19',
        agent: '24',
        cash: 12,
        qty: 1,
        clientID: '1',
      }),
      salesRow({
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        cash: 40,
        qty: 1,
        clientID: '2',
      }),
      salesRow({
        company: 'mt',
        year: 2026,
        month: 8,
        agent: '24',
        cash: 999,
        qty: 1,
        clientID: '3',
      }),
    ]
    const debtRows: DebtRow[] = [
      debtRow({ company: 'pupik', agent: '24', clientID: '10', oldDebt: 50 }),
      debtRow({ company: 'pupik', agent: '25', clientID: '11', oldDebt: 20 }),
    ]

    const partition = partitionSalesRowsByTag(rows)
    const allKpis = buildSmSuiteKpis({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
      rowPartition: partition,
    })
    const allKpisNoPart = buildSmSuiteKpis({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
    })
    expect(allKpis).toEqual(allKpisNoPart)

    const agentWindows = ['24', '25'].map(agentId => ({
      agentId,
      kpis: buildSmSuiteKpis({
        rows,
        debtRows,
        company: 'pupik',
        agents: [agentId],
        dateCtx,
        rowPartition: partition,
      }),
      goalCash: agentId === '24' ? 200 : 100,
    }))

    const fromKpis = buildSmVsAgentSeriesFromKpis({
      company: 'pupik',
      agentWindows,
      allKpis,
    })
    const fromScratch = buildSmVsAgentSeries({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
      targets: { '24': 200, '25': 100 },
      goalsReady: true,
    })
    expect(fromKpis).toEqual(fromScratch)

    expect(allKpis.salesMtd.cash).toBe(140)
    expect(allKpis.salesMtd.lyCash).toBe(80)
    expect(allKpis.openOrders.cash).toBe(15)
    expect(allKpis.returnsMtd.cash).toBe(-5)
  })

  it('buildSmVsAgentSeriesFromKpis matches buildSmVsAgentSeries on synthetic rows', () => {
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
        company: 'pupik',
        year: 2026,
        month: 8,
        agent: '25',
        cash: 40,
        qty: 1,
        clientID: '2',
      }),
    ]
    const debtRows: DebtRow[] = [
      debtRow({ company: 'pupik', agent: '24', clientID: '10', oldDebt: 50 }),
      debtRow({ company: 'pupik', agent: '25', clientID: '11', oldDebt: 20 }),
    ]
    const partition = partitionSalesRowsByTag(rows)
    const allKpis = buildSmSuiteKpis({
      rows,
      debtRows,
      company: 'pupik',
      agents: ['24', '25'],
      dateCtx,
      rowPartition: partition,
    })
    const agentWindows = ['24', '25'].map(agentId => ({
      agentId,
      kpis: buildSmSuiteKpis({
        rows,
        debtRows,
        company: 'pupik',
        agents: [agentId],
        dateCtx,
        rowPartition: partition,
      }),
      goalCash: null as number | null,
    }))
    expect(
      buildSmVsAgentSeriesFromKpis({ company: 'pupik', agentWindows, allKpis }),
    ).toEqual(
      buildSmVsAgentSeries({
        rows,
        debtRows,
        company: 'pupik',
        agents: ['24', '25'],
        dateCtx,
        goalsReady: false,
      }),
    )
  })
})
