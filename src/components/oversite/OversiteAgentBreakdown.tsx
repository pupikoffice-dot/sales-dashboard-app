import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { AgentBreakdownRow } from '../../lib/oversiteMetrics'

/** Compact per-agent totals table shown under the Orders Today / Orders MTD KPI tiles. */
export function OversiteAgentBreakdown({ rows }: { rows: AgentBreakdownRow[] }) {
  const { t } = useLocale()
  if (!rows.length) return null
  return (
    <div className="tw ov-agent-breakdown">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('oversite.debtAgent')}</th>
            <th>{t('oversite.clients')}</th>
            <th>{t('oversite.qty')}</th>
            <th>{t('oversite.cash')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.agent || '__none'}>
              <td>{r.agent || '—'}</td>
              <td className="cr">{fmt(r.clients)}</td>
              <td className="cr">{fmt(r.qty)}</td>
              <td className="cr">{fmt(r.cash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
