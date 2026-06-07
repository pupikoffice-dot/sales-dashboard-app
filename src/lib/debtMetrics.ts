import type { DashboardAccess, DebtRow } from '../types/dashboard'
import type { LogicalCompany } from '../types/dashboard'

export const DEBT_REPORT_MIN_TOTAL = 100

const ACCUMULATED_BALANCE_RE = /יתרה\s*מצטברת/i

export function normalizeDebtRows(raw: unknown): DebtRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => {
    const row = r as Record<string, unknown>
    const months = Array.isArray(row.months)
      ? row.months.map(m => {
          const month = m as Record<string, unknown>
          return { label: String(month.label || ''), amount: Number(month.amount) || 0 }
        })
      : []
    return {
      company: String(row.company || '').toLowerCase(),
      agent: String(row.agent || ''),
      clientID: String(row.clientID || ''),
      clientName: String(row.clientName || ''),
      oldDebt: Number(row.oldDebt) || 0,
      months,
    }
  })
}

export function debtMonths(months: DebtRow['months']) {
  return (months || []).filter(m => !ACCUMULATED_BALANCE_RE.test(m.label || ''))
}

export function debtRowTotal(row: DebtRow): number {
  return row.oldDebt + debtMonths(row.months).reduce((s, m) => s + (m.amount || 0), 0)
}

export function debtRowsForCompany(debtRows: DebtRow[], company: LogicalCompany): DebtRow[] {
  return debtRows.filter(
    r => r.company === company && r.agent !== '*' && Number(r.clientID) > 0,
  )
}

export function filterDebtRows(access: DashboardAccess, debtRows: DebtRow[]): DebtRow[] {
  const agents = access.agents
  const hasAgentFilter = Array.isArray(agents) && agents.length > 0
  const agentSet = hasAgentFilter ? new Set(agents.map(a => String(a))) : null

  return debtRows.filter(r => {
    if (!access.companies.includes(r.company as LogicalCompany)) return false
    if (agentSet) {
      const a = r.agent != null ? String(r.agent) : ''
      if (!agentSet.has(a)) return false
    }
    return true
  })
}

export interface DebtSummary {
  oldDebt: number
  monthTotals: { label: string; amount: number }[]
  grandTotal: number
}

export function computeDebtSummary(debtData: DebtRow[]): DebtSummary | null {
  if (!debtData.length) return null
  const mTotals: Record<string, number> = {}
  let totOld = 0
  debtData.forEach(r => {
    totOld += r.oldDebt || 0
    debtMonths(r.months).forEach(m => {
      if (!m.label) return
      mTotals[m.label] = (mTotals[m.label] || 0) + (m.amount || 0)
    })
  })
  const monthTotals = Object.entries(mTotals).map(([label, amount]) => ({ label, amount }))
  const grand = totOld + monthTotals.reduce((a, v) => a + v.amount, 0)
  return { oldDebt: totOld, monthTotals, grandTotal: grand }
}

export function debtReportRows(debtData: DebtRow[]): DebtRow[] {
  return debtData
    .filter(r => debtRowTotal(r) >= DEBT_REPORT_MIN_TOTAL)
    .sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''))
}

export function companyDebtLabel(company: LogicalCompany): string {
  return company === 'pupik' ? 'Pupik' : company === 'mt' ? 'Monkeytime' : company
}
