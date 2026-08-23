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
        <ul className="bi-cube-list">
          {items.map(it => (
            <li key={it.sku} className="bi-cube-row">
              <span className="bi-cube-row-main" title={it.sku}>
                {it.name}
              </span>
              <span className="bi-cube-row-meta">
                {fmt(it.othersCash)} · {t('bi.qty', { qty: it.othersQty })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BiCubeShell>
  )
}
