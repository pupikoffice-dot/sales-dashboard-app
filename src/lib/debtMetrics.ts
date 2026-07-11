import type { DashboardAccess, DebtRow } from '../types/dashboard'
import type { LogicalCompany } from '../types/dashboard'

export const DEBT_REPORT_MIN_TOTAL = 100

const ACCUMULATED_BALANCE_RE = /יתרה\s*מצטברת/i
const DEBT_HEADER_CLIENT_RE = /חשבון|client|cust|לקוח/i

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Excel serial dates exported as raw numbers (e.g. 46048) → "Jan 2026". */
export function formatDebtMonthLabel(label: string): string {
  const s = String(label || '').trim()
  if (!s || ACCUMULATED_BALANCE_RE.test(s)) return s
  const n = Number(s)
  if (!Number.isFinite(n) || n < 40000 || n > 60000) return s
  const d = new Date((n - 25569) * 86400000)
  if (Number.isNaN(d.getTime())) return s
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function isDebtDataRow(row: Record<string, unknown>): boolean {
  const clientID = String(row.clientID || '').trim()
  if (!clientID) return false
  if (DEBT_HEADER_CLIENT_RE.test(clientID)) return false
  return /^\d+$/.test(clientID)
}

export function normalizeDebtRows(raw: unknown): DebtRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(r => isDebtDataRow(r as Record<string, unknown>))
    .map(r => {
      const row = r as Record<string, unknown>
      const months = Array.isArray(row.months)
        ? row.months.map(m => {
            const month = m as Record<string, unknown>
            const rawLabel = String(month.label || '')
            return {
              label: formatDebtMonthLabel(rawLabel),
              amount: Number(month.amount) || 0,
            }
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

/** "Mon YYYY" → sortable number (e.g. "Feb 2026" → 202602); unknown → null. */
function monthLabelKey(label: string): number | null {
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(String(label || '').trim())
  if (!m) return null
  const mi = MONTH_SHORT.indexOf(m[1])
  if (mi < 0) return null
  return Number(m[2]) * 100 + (mi + 1)
}

/** Chronological ascending (oldest month first → current month last);
    unparseable labels keep their relative order at the end. */
export function sortDebtMonthLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ka = monthLabelKey(a)
    const kb = monthLabelKey(b)
    if (ka === null && kb === null) return 0
    if (ka === null) return 1
    if (kb === null) return -1
    return ka - kb
  })
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
  const monthTotals = sortDebtMonthLabels(Object.keys(mTotals)).map(label => ({
    label,
    amount: mTotals[label],
  }))
  const grand = totOld + monthTotals.reduce((a, v) => a + v.amount, 0)
  return { oldDebt: totOld, monthTotals, grandTotal: grand }
}

export interface DebtAgentRow {
  agent: string
  oldDebt: number
  monthAmounts: number[]
  total: number
}

export interface DebtAgentMatrix {
  monthLabels: string[]
  agents: DebtAgentRow[]
}

/** Per-agent old-debt + per-month sums, matching the summary's month order. */
export function computeDebtAgentMatrix(debtData: DebtRow[]): DebtAgentMatrix | null {
  if (!debtData.length) return null
  const seen = new Set<string>()
  debtData.forEach(r => {
    debtMonths(r.months).forEach(m => {
      if (m.label) seen.add(m.label)
    })
  })
  const labelSet = sortDebtMonthLabels([...seen])
  const byAgent = new Map<string, DebtAgentRow>()
  debtData.forEach(r => {
    const agent = String(r.agent || '')
    let e = byAgent.get(agent)
    if (!e) {
      e = { agent, oldDebt: 0, monthAmounts: labelSet.map(() => 0), total: 0 }
      byAgent.set(agent, e)
    }
    e.oldDebt += r.oldDebt || 0
    debtMonths(r.months).forEach(m => {
      const i = labelSet.indexOf(m.label)
      if (i >= 0) e.monthAmounts[i] += m.amount || 0
    })
    e.total += debtRowTotal(r)
  })
  const agents = [...byAgent.values()].sort((a, b) =>
    a.agent.localeCompare(b.agent, undefined, { numeric: true }),
  )
  return { monthLabels: labelSet, agents }
}

export function debtReportRows(debtData: DebtRow[]): DebtRow[] {
  return debtData
    .filter(r => debtRowTotal(r) >= DEBT_REPORT_MIN_TOTAL)
    .sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''))
}

export function companyDebtLabel(company: LogicalCompany): string {
  return company === 'pupik' ? 'Pupik' : company === 'mt' ? 'Monkeytime' : company
}
