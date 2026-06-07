import { fmt } from '../../lib/format'
import type { DebtSummary } from '../../lib/debtMetrics'

interface OversiteDebtSummaryProps {
  summary: DebtSummary | null
  onOpenReport: () => void
}

export function OversiteDebtSummary({ summary, onOpenReport }: OversiteDebtSummaryProps) {
  if (!summary) {
    return (
      <p className="text-sm italic text-slate-500">
        No debt in loaded data — re-run the Excel export with Debtpupik / Debtmt sheets.
      </p>
    )
  }

  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-500">Old Debt</span>
        <span className="font-semibold tabular-nums text-amber-700">{fmt(summary.oldDebt)}</span>
      </div>
      {summary.monthTotals.map(m => (
        <div key={m.label} className="flex justify-between">
          <span className="text-slate-500">{m.label}</span>
          <span className="font-semibold tabular-nums text-amber-700">{fmt(m.amount)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
        <span className="font-bold text-slate-700">Total</span>
        <span className="font-bold tabular-nums text-amber-700">{fmt(summary.grandTotal)}</span>
      </div>
      <button
        type="button"
        onClick={onOpenReport}
        className="mt-3 w-full rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-400 hover:text-amber-950"
      >
        📋 Full Report
      </button>
    </div>
  )
}
