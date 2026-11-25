import { describe, expect, it } from 'vitest'
import { companiesWithoutRevenue, defaultThrough, pctChange, pctOfRevenue, summarize, type ExpenseData } from './calc'

const data: ExpenseData = {
  categories: [
    { code: 'payroll', label: 'Payroll' }, { code: 'intercompany', label: 'Intercompany' }, { code: 'unclassified', label: 'Unclassified' },
  ],
  loads: [],
  cards: [
    { co: 'pupik', card: '1', name: 'salary', cat: 'payroll', src: 'auto' },
    { co: 'pupik', card: '2', name: 'participation mt', cat: 'intercompany', src: 'auto' },
    { co: 'mt', card: '2', name: 'services from pupik', cat: 'intercompany', src: 'auto' },
    { co: 'mt', card: '3', name: 'salary', cat: 'payroll', src: 'owner' },
  ],
  lines: [
    { co: 'pupik', y: 2026, card: '1', m: { '1': 100, '2': 50, '3': 25 } },
    { co: 'pupik', y: 2026, card: '2', m: { '1': -40 } },   // credit
    { co: 'mt', y: 2026, card: '2', m: { '1': 40 } },       // the same money as an expense
    { co: 'mt', y: 2026, card: '3', m: { '1': 10, '2': -5 } },
    { co: 'pupik', y: 2025, card: '1', m: { '1': 80 } },
  ],
}

describe('expenses summary', () => {
  it('company view keeps the intercompany lines as booked', () => {
    const s = summarize(data, { kind: 'company', co: 'pupik' }, 2026, 12)
    expect(s.total[0]).toBe(60)               // 100 - 40
    expect(s.totalYtd).toBe(135)              // 100+50+25-40
    expect(s.intercompany.ytd).toBe(-40)
  })
  it('group view removes intercompany so it is not counted twice, and shows the leftover', () => {
    const s = summarize(data, { kind: 'group' }, 2026, 12)
    expect(s.total[0]).toBe(110)              // 100 + 10, no intercompany
    expect(s.categories.find(c => c.code === 'payroll')?.ytd).toBe(180)
    expect(s.intercompany.ytd).toBe(0)        // -40 + 40
    expect(s.cards.filter(c => c.excluded).length).toBe(2)
  })
  it('through month limits the year-to-date but not the monthly columns', () => {
    const s = summarize(data, { kind: 'company', co: 'pupik' }, 2026, 2)
    expect(s.totalYtd).toBe(110)              // Jan 60 + Feb 50
    expect(s.total[2]).toBe(25)
  })
  it('revenue follows the scope and the through month; % of revenue needs revenue', () => {
    const withRev: ExpenseData = { ...data, revenue: [
      { co: 'pupik', y: 2026, m: { '1': 1000, '2': 500 } }, { co: 'mt', y: 2026, m: { '1': 1000 } },
    ] }
    expect(summarize(withRev, { kind: 'group' }, 2026, 12).revenueYtd).toBe(2500)
    expect(summarize(withRev, { kind: 'company', co: 'pupik' }, 2026, 1).revenueYtd).toBe(1000)
    expect(pctOfRevenue(110, 1000)).toBeCloseTo(11)
    expect(pctOfRevenue(5, 0)).toBeNull()
    expect(companiesWithoutRevenue({ ...withRev, lines: [...withRev.lines, { co: 'baloo', y: 2026, card: '9', m: { '1': 1 } }] }, 2026)).toEqual(['baloo'])
  })
  it('percent change needs a base', () => {
    expect(pctChange(110, 100)).toBeCloseTo(10)
    expect(pctChange(5, 0)).toBeNull()
  })
  it('default through month: a past year is complete, the current year stops at the last finished month', () => {
    const today = new Date(2026, 10, 24) // 24 Nov 2026
    expect(defaultThrough({ ...data, lines: [{ co: 'pupik', y: 2026, card: '1', m: { '11': 5, '10': 7 } }] }, 2026, today)).toBe(10)
    expect(defaultThrough(data, 2025, today)).toBe(12)
  })
})
