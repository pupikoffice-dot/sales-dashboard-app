import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildMissedItems, type HabitConfig } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiCubeShell } from './BiCubeShell'

export function BiMissedItemsCube({
  rows,
  company,
  agents,
  habit,
  curYear,
  curMonth,
  stockBySku,
}: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  habit: HabitConfig
  curYear: number
  curMonth: number
  stockBySku: Record<string, number>
}) {
  const { t } = useLocale()
  const result = useMemo(
    () =>
      buildMissedItems({
        rows,
        company,
        agents,
        habit,
        curYear,
        curMonth,
        stockBySku,
      }),
    [rows, company, agents, habit, curYear, curMonth, stockBySku],
  )

  return (
    <BiCubeShell title={t('bi.missedItems.title')}>
      {!result.ok ? (
        <p className="bi-cube-empty">{t('bi.insufficientHistory')}</p>
      ) : result.items.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.missedItems.empty')}</p>
      ) : (
        <ul className="bi-cube-list">
          {result.items.map(it => (
            <li key={it.sku} className="bi-cube-row">
              <span className="bi-cube-row-main" title={it.sku}>
                {it.name}
              </span>
              <span className="bi-cube-row-meta">
                {fmt(it.cash)} · {t('bi.habitHit', { x: it.monthsHit, y: it.monthsWindow })} ·{' '}
                {t('bi.stock', { qty: it.stock })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BiCubeShell>
  )
}
