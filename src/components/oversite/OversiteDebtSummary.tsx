import { fmt } from '../../lib/format'
import type { DebtSummary } from '../../lib/debtMetrics'

interface OversiteDebtSummaryProps {
  summary: DebtSummary | null
  onOpenReport: () => void
}

export function OversiteDebtSummary({ summary, onOpenReport }: OversiteDebtSummaryProps) {
  if (!summary) {
    return (
      <p className="ov-empty">
        No debt in loaded data — re-run the Excel export with Debtpupik / Debtmt sheets.
      </p>
    )
  }

  return (
    <div className="ov-debt-summary">
      <div className="ov-debt-row">
        <span className="ov-debt-lbl">Old Debt</span>
        <span className="ov-debt-val">{fmt(summary.oldDebt)}</span>
      </div>
      {summary.monthTotals.map(m => (
        <div key={m.label} className="ov-debt-row">
          <span className="ov-debt-lbl">{m.label}</span>
          <span className="ov-debt-val">{fmt(m.amount)}</span>
        </div>
      ))}
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
