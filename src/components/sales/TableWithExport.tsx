import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useSalesReportUi } from '../../context/SalesReportUiContext'

import { downloadCSV, tableToCSV } from '../../lib/csvExport'

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

  const ref = useRef<HTMLDivElement>(null)

  const { openChart } = useSalesReportUi()

  const [hasChart, setHasChart] = useState(barChart)



  useEffect(() => {

    const table = ref.current?.querySelector('table')

    if (!table) return

    if (barChart) {

      setHasChart(true)

      return

    }

    setHasChart(!!table.querySelector('th[data-pie-cash]') || table.classList.contains('tw-dual-months'))

  }, [children, barChart])



  function handleExport() {

    const table = ref.current?.querySelector('table')

    if (!table) return

    downloadCSV(tableToCSV(table, exportId, exportName))

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

          📥 Export CSV

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


