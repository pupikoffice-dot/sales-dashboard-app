import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { DebtAgentMatrix, DebtSummary } from '../../lib/debtMetrics'

interface OversiteDebtSummaryProps {
  summary: DebtSummary | null
  agentMatrix: DebtAgentMatrix | null
  onOpenReport: () => void
}

export function OversiteDebtSummary({ summary, agentMatrix, onOpenReport }: OversiteDebtSummaryProps) {
  const { t } = useLocale()
  if (!summary) {
    return (
      <p className="ov-empty">
        No debt in loaded data — re-run the Excel export with Debtpupik / Debtmt sheets.
      </p>
    )
  }

  return (
    <div className="ov-debt-summary">
      {/* Per-agent breakdown: one row per agent, one column per month */}
      {agentMatrix && agentMatrix.agents.length > 0 && (
        <div className="tw ov-debt-agent-matrix">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>{t('oversite.debtAgent')}</th>
                <th>{t('oversite.debtOldDebt')}</th>
                {agentMatrix.monthLabels.map(label => (
                  <th key={label}>{label}</th>
                ))}
                <th>{t('oversite.debtTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {agentMatrix.agents.map(a => (
                <tr key={a.agent || '__none'}>
                  <td>{a.agent || '—'}</td>
                  <td className="cr">{fmt(a.oldDebt)}</td>
                  {a.monthAmounts.map((v, i) => (
                    <td key={agentMatrix.monthLabels[i]} className="cr">
                      {fmt(v)}
                    </td>
                  ))}
                  <td className="cr" style={{ fontWeight: 700 }}>
                    {fmt(a.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('oversite.debtTotal')}</td>
                <td className="cr">{fmt(summary.oldDebt)}</td>
                {agentMatrix.monthLabels.map(label => (
                  <td key={label} className="cr">
                    {fmt(summary.monthTotals.find(m => m.label === label)?.amount ?? 0)}
                  </td>
                ))}
                <td className="cr" style={{ fontWeight: 700 }}>
                  {fmt(summary.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="ov-debt-row" style={{ borderTop: '1px solid var(--bdr)', marginTop: 6, paddingTop: 6 }}>
        <span className="ov-debt-lbl" style={{ fontWeight: 700 }}>
          Total
        </span>
        <span className="ov-debt-val" style={{ fontWeight: 700 }}>
          {fmt(summary.grandTotal)}
        </span>
      </div>
      <button type="button" className="ov-debt-btn" onClick={onOpenReport}>
        📋 Full Report
      </button>
    </div>
  )
}
