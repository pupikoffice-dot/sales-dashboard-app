import { useEffect, useMemo, useRef, useState } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import {
  buildClientHistoryBySku,
  buildClientSectionHtml,
} from '../../lib/clientItemsBreakdownHtml'
import { sumRows } from '../../lib/salesMetrics'
import type { LogicalCompany, SalesRow } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'

const HTML_BATCH_SIZE = 4

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
  const [sectionHtml, setSectionHtml] = useState<string[]>([])
  const [builtCount, setBuiltCount] = useState(0)

  const bySkuByClient = useMemo(
    () => buildClientHistoryBySku(companyRows).bySkuByClient,
    [companyRows],
  )

  const clientEntriesKey = useMemo(
    () => clientEntries.map(([cid]) => cid).join('\u0001'),
    [clientEntries],
  )

  useEffect(() => {
    let cancelled = false
    let index = 0
    setSectionHtml([])
    setBuiltCount(0)

    const runBatch = () => {
      if (cancelled) return
      const end = Math.min(index + HTML_BATCH_SIZE, clientEntries.length)
      const batch: string[] = []
      for (; index < end; index++) {
        const [cid, cl] = clientEntries[index]
        const { cash, qty } = sumRows(cl.rows)
        const historyBySku = bySkuByClient.get(cid) ?? new Map<string, SalesRow[]>()
        batch.push(
          buildClientSectionHtml(
            cid,
            cl.name,
            cl.rows,
            historyBySku,
            filters,
            company,
            wmsStock,
            cash,
            qty,
            defaultCollapsed,
          ),
        )
      }
      setSectionHtml(prev => [...prev, ...batch])
      setBuiltCount(index)
      if (index < clientEntries.length) {
        window.setTimeout(runBatch, 0)
      }
    }

    window.setTimeout(runBatch, 0)
    return () => {
      cancelled = true
    }
  }, [
    clientEntries,
    clientEntriesKey,
    bySkuByClient,
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
  }, [sectionHtml.length, clearGlobalCollapse])

  useEffect(() => {
    const root = containerRef.current
    if (!root || globalCollapsed == null) return
    root.querySelectorAll('.section').forEach(sec => {
      sec.classList.toggle('collapsed', globalCollapsed)
    })
  }, [globalCollapsed, sectionHtml.length])

  const building = builtCount < clientEntries.length

  return (
    <>
      {building && (
        <div className="report-progress-hint" style={{ padding: '8px 12px', opacity: 0.75 }}>
          Building sections… ({builtCount}/{clientEntries.length})
        </div>
      )}
      <div ref={containerRef} className="sales-html-sections">
        {sectionHtml.map((html, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
    </>
  )
}
