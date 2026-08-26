import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildMissedClients, type HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { smOpenOrdersTag } from '../smMetrics'
import { BiCubeShell } from './BiCubeShell'

export function BiMissedClientsCube({
  rows,
  company,
  agents,
  habit,
  curYear,
  curMonth,
}: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  habit: HabitConfig
  curYear: number
  curMonth: number
}) {
  const { t } = useLocale()
  const openOrdersTag = smOpenOrdersTag(company)
  const result = useMemo(
    () =>
      buildMissedClients({
        rows,
        company,
        agents,
        habit,
        curYear,
        curMonth,
        openOrdersTag,
      }),
    [rows, company, agents, habit, curYear, curMonth, openOrdersTag],
  )

  return (
    <BiCubeShell title={t('bi.missedClients.title')} helpText={t('bi.missedClients.help')}>
      {!result.ok ? (
        <p className="bi-cube-empty">{t('bi.insufficientHistory')}</p>
      ) : result.items.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.missedClients.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
            <thead>
              <tr>
                <th>{t('bi.col.clientId')}</th>
                <th>{t('bi.col.clientName')}</th>
                <th className="bi-num">{t('bi.col.cash')}</th>
                <th className="bi-num">{t('bi.col.habit')}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(it => (
                <tr key={it.clientId}>
                  <td className="bi-mono">{it.clientId}</td>
                  <td>{it.clientName}</td>
                  <td className="bi-num">{fmt(it.cash)}</td>
                  <td className="bi-num">{t('bi.habitHit', { x: it.monthsHit, y: it.monthsWindow })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BiCubeShell>
  )
}
