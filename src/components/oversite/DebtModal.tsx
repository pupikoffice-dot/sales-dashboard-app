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
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal">
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Client Name</th>
                  <th>Agent</th>
                  <th>Old Debt</th>
                  {mLabels.map(l => (
                    <th key={l}>{l}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map(r => {
                  const months = debtMonths(r.months)
                  const rowTot = debtRowTotal(r)
                  return (
                    <tr key={`${r.clientID}-${r.agent}`}>
                      <td>{r.clientID}</td>
                      <td>{r.clientName}</td>
                      <td>{r.agent}</td>
                      <td className="cr">{fmt(r.oldDebt)}</td>
                      {months.map(m => (
                        <td key={`${r.clientID}-${m.label}`} className="cr">
                          {fmt(m.amount)}
                        </td>
                      ))}
                      <td className="cr" style={{ fontWeight: 700 }}>
                        {fmt(rowTot)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="cr">{fmt(footer.totOld)}</td>
                  {footer.totM.map((v, i) => (
                    <td key={mLabels[i]} className="cr">
                      {fmt(v)}
                    </td>
                  ))}
                  <td className="cr" style={{ fontWeight: 700 }}>
                    {fmt(footer.totGrand)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
