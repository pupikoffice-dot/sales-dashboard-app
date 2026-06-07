import { useMemo } from 'react'
import { fmt } from '../../lib/format'
import {
  DEBT_REPORT_MIN_TOTAL,
  companyDebtLabel,
  debtMonths,
  debtReportRows,
  debtRowTotal,
} from '../../lib/debtMetrics'
import type { DebtRow, LogicalCompany } from '../../types/dashboard'

interface DebtModalProps {
  company: LogicalCompany
  debtData: DebtRow[]
  debtLastUpdate?: string
  onClose: () => void
}

export function DebtModal({ company, debtData, debtLastUpdate, onClose }: DebtModalProps) {
  const reportRows = debtReportRows(debtData)
  const mLabels = reportRows.length ? debtMonths(reportRows[0].months).map(m => m.label) : []

  const footer = useMemo(() => {
    let totOld = 0
    let totGrand = 0
    const totM = mLabels.map(() => 0)
    reportRows.forEach(r => {
      const months = debtMonths(r.months)
      const rowTot = debtRowTotal(r)
      totOld += r.oldDebt || 0
      totGrand += rowTot
      months.forEach((m, i) => {
        totM[i] = (totM[i] || 0) + (m.amount || 0)
      })
    })
    return { totOld, totGrand, totM }
  }, [reportRows, mLabels])

  if (!reportRows.length) return null

  const title = `💳 Open Debt — ${companyDebtLabel(company)} (Total ≥ ${DEBT_REPORT_MIN_TOTAL})${
    debtLastUpdate ? ` · Last Update: ${debtLastUpdate}` : ''
  }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Client ID</th>
                <th className="py-2 pr-2">Client Name</th>
                <th className="py-2 pr-2">Agent</th>
                <th className="py-2 pr-2 text-right">Old Debt</th>
                {mLabels.map(l => (
                  <th key={l} className="py-2 pr-2 text-right">
                    {l}
                  </th>
                ))}
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map(r => {
                const months = debtMonths(r.months)
                const rowTot = debtRowTotal(r)
                return (
                  <tr key={`${r.clientID}-${r.agent}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{r.clientID}</td>
                    <td className="py-1.5 pr-2">{r.clientName}</td>
                    <td className="py-1.5 pr-2">{r.agent}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-amber-700">{fmt(r.oldDebt)}</td>
                    {months.map(m => (
                      <td key={`${r.clientID}-${m.label}`} className="py-1.5 pr-2 text-right tabular-nums text-amber-700">
                        {fmt(m.amount)}
                      </td>
                    ))}
                    <td className="py-1.5 text-right font-semibold tabular-nums text-amber-700">{fmt(rowTot)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 font-semibold">
                <td colSpan={3} className="py-2">
                  Total
                </td>
                <td className="py-2 pr-2 text-right tabular-nums text-amber-700">{fmt(footer.totOld)}</td>
                {footer.totM.map((v, i) => (
                  <td key={mLabels[i]} className="py-2 pr-2 text-right tabular-nums text-amber-700">
                    {fmt(v)}
                  </td>
                ))}
                <td className="py-2 text-right tabular-nums text-amber-700">{fmt(footer.totGrand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
