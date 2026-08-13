import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import {
  buildClientHistoryIndexes,
  buildClientSectionHtml,
  type ClientHistoryIndexes,
} from '../../lib/clientItemsBreakdownHtml'
import { getDualMonthCols } from '../../lib/salesDateFilter'
import { canShowClientProfit } from '../../lib/permissions'
import { attachAllTableColumnFilters } from '../../lib/tableColumnFilters'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../../types/dashboard'
import type { WmsStockMap } from '../../lib/wmsData'

/** Max ms of section-building per frame before yielding back to the browser.
 *  Kept under a 60fps frame so the page stays scrollable while a wide report
 *  (hundreds of client sections) is still rendering. */
const BUILD_BUDGET_MS = 12

interface LargeClientsItemsReportProps {
  clientEntries: [string, { name: string; rows: SalesRow[] }][]
  companyRows: SalesRow[]
  filters: DashboardFiltersState
  company: LogicalCompany
  wmsStock: WmsStockMap
  itemPrice?: SkuValueMap
  defaultCollapsed: boolean
}

export function LargeClientsItemsReport({
  clientEntries,
  companyRows,
  filters,
  company,
  wmsStock,
  itemPrice,
  defaultCollapsed,
}: LargeClientsItemsReportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  // Read through refs inside the build loop. The build now spans many frames,
  // so any dependency that changes identity on an unrelated re-render would
  // cancel and restart it from zero — a report that never finishes. Keeping
  // these out of the dependency list makes the build immune to that.
  const wmsStockRef = useRef(wmsStock)
  wmsStockRef.current = wmsStock
  const itemPriceRef = useRef(itemPrice)
  itemPriceRef.current = itemPrice
  const historyRef = useRef<ClientHistoryIndexes | null>(null)
  const entriesRef = useRef(clientEntries)
  entriesRef.current = clientEntries
  const { access } = useDashboardAccess()
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const showClientProfit = canShowClientProfit(access, isSuperAdmin)
  const { t } = useLocale()
  // Translated once here and passed into the HTML generator (which has no React
  // context). It is an effect dependency so switching language rebuilds the report.
  const monthMicroLabel = t('legend.monthHeaderMicro')

  const { globalCollapsed, clearGlobalCollapse, setGlobalCollapsed } = useSalesReportUi()
  const [building, setBuilding] = useState(true)
  const [builtCount, setBuiltCount] = useState(0)

  const clientEntriesKey = useMemo(
    () => clientEntries.map(([cid]) => cid).join('\u0001'),
    [clientEntries],
  )

  const clientIdSet = useMemo(() => new Set(clientEntries.map(([cid]) => cid)), [clientEntriesKey])

  const historyIndexes = useMemo(
    () => buildClientHistoryIndexes(companyRows, clientIdSet),
    [companyRows, clientIdSet],
  )
  historyRef.current = historyIndexes
  // Cheap signature of the history input — used as the effect dependency
  // instead of the object itself, so a re-created (but equivalent) index does
  // not restart a build already in progress.
  const historyKey = `${companyRows.length}:${clientIdSet.size}`

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        dateMode: filters.dateMode,
        months: [...filters.selectedMonths].sort(),
      }),
    [filters.dateMode, filters.selectedMonths],
  )

  // Build and insert in BATCHES, not one blocking pass.
  //
  // A wide report (e.g. Pupik + Jan-Mar = 342 client sections x 8,215 rows x 3
  // month columns) is ~250k DOM nodes. Building that as a single string and
  // assigning it in one innerHTML blocks the main thread long enough that the
  // tab looks frozen rather than slow. Yielding between batches keeps the page
  // responsive and lets us show real progress.
  useEffect(() => {
    let cancelled = false
    setBuilding(true)
    setBuiltCount(0)
    if (containerRef.current) containerRef.current.innerHTML = ''

    const dualMonthCols =
      filtersRef.current.dateMode === 'months'
        ? getDualMonthCols(filtersRef.current.selectedMonths)
        : undefined

    let i = 0
    let handle = 0

    function step() {
      if (cancelled || !containerRef.current) return
      const start = performance.now()
      const entries = entriesRef.current
      const history = historyRef.current
      let html = ''
      // Work for a slice of a frame, then yield — keeps long reports interactive
      // on phones instead of locking up.
      while (i < entries.length && performance.now() - start < BUILD_BUDGET_MS) {
        const [cid, cl] = entries[i]
        let cash = 0
        let qty = 0
        for (const r of cl.rows) {
          cash += r.cash || 0
          qty += r.qty || 0
        }
        html += buildClientSectionHtml(
          cid,
          cl.name,
          cl.rows,
          history?.monthIndexBySkuByClient.get(cid) ?? new Map(),
          filtersRef.current,
          company,
          wmsStockRef.current,
          cash,
          qty,
          defaultCollapsed,
          dualMonthCols,
          itemPriceRef.current,
          showClientProfit,
          monthMicroLabel,
        )
        i++
      }
      containerRef.current.insertAdjacentHTML('beforeend', html)
      setBuiltCount(i)

      if (i < entries.length) {
        handle = window.requestAnimationFrame(step)
        return
      }

      setBuilding(false)
      if (defaultCollapsed) setGlobalCollapsed(true)
      window.requestAnimationFrame(() => {
        if (containerRef.current) attachAllTableColumnFilters(containerRef.current)
      })
    }

    handle = window.requestAnimationFrame(step)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(handle)
    }
    // Deliberately STABLE dependencies only (keys/primitives, not objects).
    // The build spans many animation frames, so depending on object identities
    // — clientEntries, historyIndexes, wmsStock, itemPrice — meant any
    // unrelated re-render cancelled and restarted it, leaving the report stuck
    // at "Building report… (0/N)". Those values are read through refs instead.
  }, [
    clientEntriesKey,
    historyKey,
    filterKey,
    company,
    showClientProfit,
    monthMicroLabel,
    defaultCollapsed,
    setGlobalCollapsed,
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

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root || globalCollapsed == null || building) return
    root.querySelectorAll('.section').forEach(sec => {
      if (globalCollapsed) sec.classList.add('collapsed')
      else sec.classList.remove('collapsed')
    })
  }, [globalCollapsed, building])

  return (
    <>
      {building && (
        <div className="report-progress-hint" style={{ padding: '8px 12px', opacity: 0.75 }}>
          {t('sales.buildingReport')} ({builtCount}/{clientEntries.length})
        </div>
      )}
      <div ref={containerRef} className="sales-html-sections" />
    </>
  )
}
