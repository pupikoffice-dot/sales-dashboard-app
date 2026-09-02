import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'

import { downloadCSV, tableToCSV } from '../../lib/csvExport'
import { downloadSplitCashQtyTable } from '../../lib/spreadsheetExport'

import {
  extractMonthBarFromCashTable,
  extractMonthBarFromDualTable,
  extractPieFromTable,
  getTableChartTitle,
  isCashSummaryBarTable,
  isMonthlyDualTable,
} from '../../lib/tablePieExtract'

interface TableWithExportProps {
  children: ReactNode
  exportId?: string
  exportName?: string
  barChart?: boolean
}

export function TableWithExport({
  children,
  exportId = '',
  exportName = '',
  barChart = false,
}: TableWithExportProps) {
  const { t } = useLocale()
  const ref = useRef<HTMLDivElement>(null)
  const { openChart } = useSalesReportUi()
  const [hasChart, setHasChart] = useState(barChart)
  const [splitExport, setSplitExport] = useState(false)

  useEffect(() => {
    const table = ref.current?.querySelector('table')
    if (!table) return
    if (barChart) {
      setHasChart(true)
      return
    }
    setHasChart(!!table.querySelector('th[data-pie-cash]') || table.classList.contains('tw-dual-months'))
    setSplitExport(
      table.classList.contains('tw-dual-months') ||
        (!!table.querySelector('th[data-pie-cash]') && !!table.querySelector('th[data-pie-qty]')),
    )
  }, [children, barChart])

  function handleExport() {
    const table = ref.current?.querySelector('table')
    if (!table) return
    const baseName = exportName.replace(/\s+/g, '_') || `export_${new Date().toISOString().slice(0, 10)}`
    if (downloadSplitCashQtyTable(table, exportId, exportName, baseName)) return
    downloadCSV(tableToCSV(table, exportId, exportName), `${baseName}.csv`)
  }

  function handleChart() {
    const wrapper = ref.current
    const table = wrapper?.querySelector('table')
    if (!table || !wrapper) return
    const title = getTableChartTitle(wrapper, exportName)

    if (isMonthlyDualTable(table)) {
      const { months, cashVals, qtyVals } = extractMonthBarFromDualTable(table)
      openChart({ kind: 'bar', months, cashVals, qtyVals, title })
      return
    }

    if (isCashSummaryBarTable(table, wrapper)) {
      const { months, cashVals, qtyVals } = extractMonthBarFromCashTable(table)
      openChart({ kind: 'bar', months, cashVals, qtyVals, title })
      return
    }

    const entries = extractPieFromTable(table)
    if (!entries.length) {
      window.alert('No chartable cash values in this table.')
      return
    }

    openChart({ kind: 'pie', entries, title })
  }

  return (
    <>
      <div className="dl-bar">
        <button type="button" className="dl-btn" onClick={handleExport}>
          📥 {splitExport ? t('sales.exportExcel') : t('sales.exportCsv')}
        </button>
        {hasChart && (
          <button type="button" className="dl-btn" onClick={handleChart}>
            📊 Chart
          </button>
        )}
      </div>
      <div ref={ref} data-bar-chart={barChart ? '1' : undefined}>
        {children}
      </div>
    </>
  )
}
