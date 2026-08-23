import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { fmt } from '../../../../lib/format'
import { buildItemsSoldByOthers } from '../../../../lib/biMetrics'
import type { LogicalCompany, SalesRow } from '../../../../types/dashboard'
import { BiCubeShell } from './BiCubeShell'

export function BiItemsSoldByOthersCube({
  rows,
  company,
  agentId,
  suiteAgents,
  curYear,
  curMonth,
}: {
  rows: SalesRow[]
  company: LogicalCompany
  agentId: string
  suiteAgents: string[]
  curYear: number
  curMonth: number
}) {
  const { t } = useLocale()
  const items = useMemo(
    () =>
      buildItemsSoldByOthers({
        rows,
        company,
        agentId,
        suiteAgents,
        curYear,
        curMonth,
      }),
    [rows, company, agentId, suiteAgents, curYear, curMonth],
  )

  return (
    <BiCubeShell title={t('bi.itemsSoldByOthers.title')}>
      {items.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.itemsSoldByOthers.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
            <thead>
              <tr>
                <th>{t('bi.col.sku')}</th>
                <th>{t('bi.col.itemName')}</th>
                <th className="bi-num">{t('bi.col.cash')}</th>
                <th className="bi-num">{t('bi.col.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.sku}>
                  <td className="bi-mono">{it.sku}</td>
                  <td>{it.name}</td>
                  <td className="bi-num">{fmt(it.othersCash)}</td>
                  <td className="bi-num">{it.othersQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BiCubeShell>
  )
}
