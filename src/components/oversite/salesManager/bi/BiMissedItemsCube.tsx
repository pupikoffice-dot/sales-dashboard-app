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
    <BiCubeShell title={t('bi.missedItems.title')} helpText={t('bi.missedItems.help')}>
      {!result.ok ? (
        <p className="bi-cube-empty">{t('bi.insufficientHistory')}</p>
      ) : result.items.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.missedItems.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
            <thead>
              <tr>
                <th>{t('bi.col.sku')}</th>
                <th>{t('bi.col.itemName')}</th>
                <th className="bi-num">{t('bi.col.cash')}</th>
                <th className="bi-num">{t('bi.col.habit')}</th>
                <th className="bi-num">{t('bi.col.stock')}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(it => (
                <tr key={it.sku}>
                  <td className="bi-mono">{it.sku}</td>
                  <td>{it.name}</td>
                  <td className="bi-num">{fmt(it.cash)}</td>
                  <td className="bi-num">{t('bi.habitHit', { x: it.monthsHit, y: it.monthsWindow })}</td>
                  <td className="bi-num">{it.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BiCubeShell>
  )
}
