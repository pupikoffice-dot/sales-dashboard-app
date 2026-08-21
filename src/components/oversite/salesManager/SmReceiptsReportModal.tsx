import { useMemo } from 'react'
import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import type { SmReceiptsMetrics } from './smMetrics'

/** Receipts amounts arrive gross (008 report, incl. 18% VAT). */
const VAT_RATE = 1.18
const MONTHS_SHOWN = 12
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function rollingMonths(): Array<{ ym: string; label: string; isCurrent: boolean }> {
  const now = new Date()
  const out = []
  for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      isCurrent: i === 0,
    })
  }
  return out
}

export interface SmReceiptsReportModalProps {
  title: string
  receipts: SmReceiptsMetrics
  onClose: () => void
}

/** Full receipts report: rolling 12 months × agents (net of VAT). */
export function SmReceiptsReportModal({ title, receipts, onClose }: SmReceiptsReportModalProps) {
  const { t } = useLocale()
  const agents = receipts.agents
  const months = useMemo(() => rollingMonths(), [])

  const rows = useMemo(
    () =>
      months.map(m => {
        const byAgent: Record<string, number> = {}
        let total = 0
        for (const a of agents) {
          const net = ((receipts.byAgent[a] || {})[m.ym] || 0) / VAT_RATE
          byAgent[a] = net
          total += net
        }
        return { ...m, byAgent, total }
      }),
    [months, agents, receipts.byAgent],
  )

  const agentTotals = useMemo(
    () =>
      agents.map(a => {
        const total = rows.reduce((s, r) => s + (r.byAgent[a] || 0), 0)
        return { agent: a, total, avg: total / MONTHS_SHOWN }
      }),
    [agents, rows],
  )

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandAvg = grandTotal / MONTHS_SHOWN
  const hasData = Object.keys(receipts.monthly).length > 0

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal sm-receipts-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          <p className="sm-report-hint">{t('oversite.receiptsNetNote')}</p>
          {!hasData ? (
            <p className="ov-empty">{t('sm.cube.receiptsEmpty')}</p>
          ) : (
            <div className="tw">
              <table className="ov-orders-table sm-receipts-table">
                <thead>
                  <tr>
                    <th>{t('oversite.month')}</th>
                    {agents.map(a => (
                      <th key={a} className="cm">
                        {t('oversite.debtAgent')} {a}
                      </th>
                    ))}
                    <th className="cm">{t('oversite.orderTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.ym} className={r.isCurrent ? 'sm-receipts-row--current' : undefined}>
                      <td>{r.label}</td>
                      {agents.map(a => (
                        <td key={a} className="cm">
                          {r.byAgent[a] > 0 ? fmt(r.byAgent[a]) : '—'}
                        </td>
                      ))}
                      <td className="cm">
                        <b>{r.total > 0 ? fmt(r.total) : '—'}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
                      <b>{t('oversite.receiptsTotal12')}</b>
                    </td>
                    {agentTotals.map(at => (
                      <td key={at.agent} className="cm">
                        <b>{fmt(at.total)}</b>
                      </td>
                    ))}
                    <td className="cm">
                      <b>{fmt(grandTotal)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>{t('oversite.receiptsAvg')}</b>
                    </td>
                    {agentTotals.map(at => (
                      <td key={at.agent} className="cm">
                        <b>{fmt(at.avg)}</b>
                      </td>
                    ))}
                    <td className="cm">
                      <b>{fmt(grandAvg)}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
