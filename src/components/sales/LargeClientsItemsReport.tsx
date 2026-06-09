import { useEffect, useMemo, useRef, useState } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import {
  buildAllClientSectionsHtml,
  buildClientHistoryIndexes,
} from '../../lib/clientItemsBreakdownHtml'
import { attachAllTableColumnFilters } from '../../lib/tableColumnFilters'
import type { LogicalCompany, SalesRow } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'

interface LargeClientsItemsReportProps {
  clientEntries: [string, { name: string; rows: SalesRow[] }][]
  companyRows: SalesRow[]
  filters: DashboardFiltersState
  company: LogicalCompany
  wmsStock: WmsStockMap
  defaultCollapsed: boolean
}

export function LargeClientsItemsReport({
  clientEntries,
  companyRows,
  filters,
  company,
  wmsStock,
  defaultCollapsed,
}: LargeClientsItemsReportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { globalCollapsed, clearGlobalCollapse } = useSalesReportUi()
  const [building, setBuilding] = useState(true)

  const clientEntriesKey = useMemo(
    () => clientEntries.map(([cid]) => cid).join('\u0001'),
    [clientEntries],
  )

  const clientIdSet = useMemo(() => new Set(clientEntries.map(([cid]) => cid)), [clientEntriesKey])

  const historyIndexes = useMemo(
    () => buildClientHistoryIndexes(companyRows, clientIdSet),
    [companyRows, clientIdSet],
  )

  // Legacy-style: build entire report HTML in one pass, single DOM insert.
  useEffect(() => {
    let cancelled = false
    setBuilding(true)
    if (containerRef.current) containerRef.current.innerHTML = ''

    const id = window.setTimeout(() => {
      if (cancelled) return
      const html = buildAllClientSectionsHtml(
        clientEntries,
        historyIndexes,
        filters,
        company,
        wmsStock,
        defaultCollapsed,
      )
      if (cancelled || !containerRef.current) return
      containerRef.current.innerHTML = html
      setBuilding(false)
      requestAnimationFrame(() => {
        if (containerRef.current) attachAllTableColumnFilters(containerRef.current)
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [
    clientEntries,
    clientEntriesKey,
    historyIndexes,
    filters,
    company,
    wmsStock,
    defaultCollapsed,
  ])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    function onTitleClick(e: MouseEvent) {
      const title = (e.target as Element).closest('.section-title')
      if (!title || !root!.contains(title)) return
      clearGlobalCollapse()
      title.closest('.section')?.classList.toggle('collapsed')
    }

    root.addEventListener('click', onTitleClick)
    return () => root.removeEventListener('click', onTitleClick)
  }, [building, clearGlobalCollapse])

  useEffect(() => {
    const root = containerRef.current
    if (!root || globalCollapsed == null || building) return
    root.querySelectorAll('.section').forEach(sec => {
      sec.classList.toggle('collapsed', globalCollapsed)
    })
  }, [globalCollapsed, building])

  return (
    <>
      {building && (
        <div className="report-progress-hint" style={{ padding: '8px 12px', opacity: 0.75 }}>
          Building report…
        </div>
      )}
      <div ref={containerRef} className="sales-html-sections" />
    </>
  )
}
