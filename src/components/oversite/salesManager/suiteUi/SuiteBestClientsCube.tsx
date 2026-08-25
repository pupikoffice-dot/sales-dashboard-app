import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildBestClients } from '../../../../lib/suiteUiMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'

export function SuiteBestClientsCube({
  rows,
  company,
  agents,
  curYear,
  curMonth,
}: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  curYear: number
  curMonth: number
}) {
  const { t } = useLocale()
  const items = useMemo(
    () => buildBestClients({ rows, company, agents, curYear, curMonth }),
    [rows, company, agents, curYear, curMonth],
  )

  return (
    <div className="sm-cube bi-cube">
      <div className="sm-cube-title bi-cube-title">
        <span>{t('suiteUi.bestClients.title')}</span>
      </div>
      {items.length === 0 ? (
        <p className="bi-cube-empty">{t('suiteUi.bestClients.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
            <thead>
              <tr>
                <th>{t('bi.col.clientId')}</th>
                <th>{t('bi.col.clientName')}</th>
                <th className="bi-num">{t('bi.col.cash')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.clientId}>
                  <td className="bi-mono">{it.clientId}</td>
                  <td>{it.clientName}</td>
                  <td className="bi-num">{fmt(it.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
