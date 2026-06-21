import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { useColumnSort } from '../../hooks/useColumnSort'
import { fmt } from '../../lib/format'
import { applySort } from '../../lib/tableSort'
import {
  DEBT_REPORT_MIN_TOTAL,
  companyDebtLabel,
  debtMonths,
  debtReportRows,
  debtRowTotal,
} from '../../lib/debtMetrics'
import type { DebtRow, LogicalCompany } from '../../types/dashboard'
import { FilterCheckList } from '../sidebar/FilterCheckList'

interface DebtModalProps {
  company: LogicalCompany
  debtData: DebtRow[]
  debtLastUpdate?: string
  onClose: () => void
}

interface AgentFooter {
  totOld: number
  totM: number[]
  totGrand: number
}

function monthAmount(row: DebtRow, label: string): number {
  const m = debtMonths(row.months).find(x => x.label === label)
  return m?.amount || 0
}

function computeAgentFooter(rows: DebtRow[], mLabels: string[]): AgentFooter {
  let totOld = 0
  let totGrand = 0
  const totM = mLabels.map(() => 0)
  rows.forEach(r => {
    const rowTot = debtRowTotal(r)
    totOld += r.oldDebt || 0
    totGrand += rowTot
    mLabels.forEach((label, i) => {
      totM[i] = (totM[i] || 0) + monthAmount(r, label)
    })
  })
  return { totOld, totM, totGrand }
}

function sortDebtRows(
  rows: DebtRow[],
  sortCol: number | null,
  sortAsc: boolean,
  mLabels: string[],
): DebtRow[] {
  return applySort(rows, sortCol, sortAsc, (row, col) => {
    if (col === 0) return row.clientID
    if (col === 1) return row.clientName || ''
    if (col === 2) return row.oldDebt || 0
    if (col === mLabels.length + 3) return debtRowTotal(row)
    const monthIdx = col - 3
    return monthAmount(row, mLabels[monthIdx] || '')
  })
}

function sortIconChar(dir: 'asc' | 'desc' | null): string {
  if (dir === 'asc') return ' ↑'
  if (dir === 'desc') return ' ↓'
  return ' ↕'
}

export function DebtModal({ company, debtData, debtLastUpdate, onClose }: DebtModalProps) {
  const { t } = useLocale()
  const reportRows = debtReportRows(debtData)
  const mLabels = reportRows.length ? debtMonths(reportRows[0].months).map(m => m.label) : []
  const { sortCol, sortAsc, onSort, sortIcon } = useColumnSort()
  const [showAgentFilter, setShowAgentFilter] = useState(false)

  const agents = useMemo(() => {
    const ids = new Set<string>()
    reportRows.forEach(r => ids.add(r.agent || ''))
    return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [reportRows])

  const agentKey = agents.join('\u0001')

  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => new Set(agents))

  useEffect(() => {
    setSelectedAgents(new Set(agents))
  }, [agentKey])

  const agentOptions = useMemo(
    () =>
      agents.map(id => ({
        id,
        label: id ? `${t('oversite.debtAgent')} ${id}` : t('oversite.debtAgentUnassigned'),
      })),
    [agents, t],
  )

  const groupedByAgent = useMemo(() => {
    const map = new Map<string, DebtRow[]>()
    for (const row of reportRows) {
      const agent = row.agent || ''
      if (!selectedAgents.has(agent)) continue
      const bucket = map.get(agent)
      if (bucket) bucket.push(row)
      else map.set(agent, [row])
    }
    return [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
  }, [reportRows, selectedAgents])

  const visibleRows = useMemo(
    () => groupedByAgent.flatMap(([, rows]) => rows),
    [groupedByAgent],
  )

  const grandFooter = useMemo(
    () => computeAgentFooter(visibleRows, mLabels),
    [visibleRows, mLabels],
  )

  const filterActive = selectedAgents.size < agents.length

  if (!reportRows.length) return null

  const title = `${t('oversite.debtReportTitle', { company: companyDebtLabel(company), min: DEBT_REPORT_MIN_TOTAL })}${
    debtLastUpdate ? ` · ${t('oversite.lastUpdate')}: ${debtLastUpdate}` : ''
  }`

  function renderSortTh(col: number, label: string, align: 'left' | 'right' = 'right') {
    const dir = sortIcon(col)
    return (
      <th
        className="sortable"
        style={align === 'left' ? { textAlign: 'left' } : undefined}
        onClick={() => onSort(col)}
        title={t('oversite.debtSortColumn')}
      >
        {label}
        <span className="si">{sortIconChar(dir)}</span>
      </th>
    )
  }

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal">
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          <button
            type="button"
            className={`ov-toggle-btn debt-agent-filter-btn${filterActive ? ' active' : ''}`}
            onClick={() => setShowAgentFilter(v => !v)}
          >
            👤 {t('oversite.debtAgents')}
            {filterActive ? ` (${selectedAgents.size}/${agents.length})` : ''}{' '}
            {showAgentFilter ? '▴' : '▾'}
          </button>
          {showAgentFilter && (
            <div className="debt-agent-filter">
              <FilterCheckList
                items={agentOptions}
                selected={selectedAgents}
                onToggle={id => {
                  setSelectedAgents(prev => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }}
                onSelectVisible={ids => setSelectedAgents(new Set(ids))}
                onClear={() => setSelectedAgents(new Set())}
                searchPlaceholder={t('oversite.debtSearchAgents')}
                maxHeight={160}
              />
            </div>
          )}

          {!groupedByAgent.length ? (
            <p className="ov-empty">{t('oversite.debtNoAgentsSelected')}</p>
          ) : (
            <>
              {groupedByAgent.map(([agent, rows]) => {
                const sorted = sortDebtRows(rows, sortCol, sortAsc, mLabels)
                const footer = computeAgentFooter(sorted, mLabels)
                const agentLabel = agent
                  ? `${t('oversite.debtAgent')} ${agent}`
                  : t('oversite.debtAgentUnassigned')

                return (
                  <section key={agent || '__none'} className="debt-agent-section">
                    <h4 className="debt-agent-hdr">
                      {agentLabel}
                      <span className="debt-agent-meta">
                        {sorted.length} {t('oversite.debtClients')} · {fmt(footer.totGrand)}
                      </span>
                    </h4>
                    <div className="tw">
                      <table>
                        <thead>
                          <tr>
                            {renderSortTh(0, t('oversite.debtClientId'), 'left')}
                            {renderSortTh(1, t('oversite.debtClientName'), 'left')}
                            {renderSortTh(2, t('oversite.debtOldDebt'))}
                            {mLabels.map((label, i) => (
                              <th key={label} onClick={() => onSort(i + 3)} className="sortable">
                                {label}
                                <span className="si">{sortIconChar(sortIcon(i + 3))}</span>
                              </th>
                            ))}
                            {renderSortTh(mLabels.length + 3, t('oversite.debtTotal'))}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map(r => {
                            const rowTot = debtRowTotal(r)
                            return (
                              <tr key={`${r.clientID}-${r.agent}`}>
                                <td>{r.clientID}</td>
                                <td>{r.clientName}</td>
                                <td className="cr">{fmt(r.oldDebt)}</td>
                                {mLabels.map(label => (
                                  <td key={`${r.clientID}-${label}`} className="cr">
                                    {fmt(monthAmount(r, label))}
                                  </td>
                                ))}
                                <td className="cr" style={{ fontWeight: 700 }}>
                                  {fmt(rowTot)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}>{t('oversite.debtSubtotal')}</td>
                            <td className="cr">{fmt(footer.totOld)}</td>
                            {footer.totM.map((v, i) => (
                              <td key={mLabels[i]} className="cr">
                                {fmt(v)}
                              </td>
                            ))}
                            <td className="cr" style={{ fontWeight: 700 }}>
                              {fmt(footer.totGrand)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                )
              })}

              {groupedByAgent.length > 1 && (
                <div className="tw debt-grand-total">
                  <table>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>{t('oversite.debtGrandTotal')}</td>
                        <td className="cr">{fmt(grandFooter.totOld)}</td>
                        {grandFooter.totM.map((v, i) => (
                          <td key={mLabels[i]} className="cr">
                            {fmt(v)}
                          </td>
                        ))}
                        <td className="cr" style={{ fontWeight: 700 }}>
                          {fmt(grandFooter.totGrand)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
