import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildBestSoldItems } from '../../../../lib/suiteUiMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'

export function SuiteBestSoldItemsCube({
  rows,
  company,
  agents,
  curYear,
  curMonth,
  mtdPrefiltered = false,
}: {
  rows: SalesRow[]
  company: LogicalCompany
  agents: string[] | null
  curYear: number
  curMonth: number
  mtdPrefiltered?: boolean
}) {
  const { t } = useLocale()
  const items = useMemo(
    () => buildBestSoldItems({ rows, company, agents, curYear, curMonth, mtdPrefiltered }),
    [rows, company, agents, curYear, curMonth, mtdPrefiltered],
  )

  return (
    <div className="sm-cube bi-cube">
      <div className="sm-cube-title bi-cube-title">
        <span>{t('suiteUi.bestSoldItems.title')}</span>
      </div>
      {items.length === 0 ? (
        <p className="bi-cube-empty">{t('suiteUi.bestSoldItems.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
            <thead>
              <tr>
                <th>{t('bi.col.sku')}</th>
                <th>{t('bi.col.itemName')}</th>
                <th className="bi-num">{t('bi.col.qty')}</th>
                <th className="bi-num">{t('bi.col.cash')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.sku}>
                  <td className="bi-mono">{it.sku}</td>
                  <td>{it.name}</td>
                  <td className="bi-num">{it.qty}</td>
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
