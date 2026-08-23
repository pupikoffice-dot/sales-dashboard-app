import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildMissedClients, type HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
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
  const result = useMemo(
    () =>
      buildMissedClients({
        rows,
        company,
        agents,
        habit,
        curYear,
        curMonth,
      }),
    [rows, company, agents, habit, curYear, curMonth],
  )

  return (
    <BiCubeShell title={t('bi.missedClients.title')}>
      {!result.ok ? (
        <p className="bi-cube-empty">{t('bi.insufficientHistory')}</p>
      ) : result.items.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.missedClients.empty')}</p>
      ) : (
        <ul className="bi-cube-list">
          {result.items.map(it => (
            <li key={it.clientId} className="bi-cube-row">
              <span className="bi-cube-row-main" title={it.clientId}>
                {it.clientName}
              </span>
              <span className="bi-cube-row-meta">
                {fmt(it.cash)} · {t('bi.habitHit', { x: it.monthsHit, y: it.monthsWindow })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BiCubeShell>
  )
}
