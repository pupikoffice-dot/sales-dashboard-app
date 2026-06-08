import { useEffect } from 'react'
import type { ChartModalConfig } from '../components/sales/ChartModal'
import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import { useSalesReportUi } from '../context/SalesReportUiContext'
import { buildClientPie, buildItemPie, buildMonthlyBarFromRows } from '../lib/pieData'
import type { SalesRow } from '../types/dashboard'

export function useReportChart(
  filters: DashboardFiltersState,
  rows: SalesRow[],
  config: { pieTitle: string; barTitle?: string; kind: 'client' | 'item' },
) {
  const { setReportChart } = useSalesReportUi()

  useEffect(() => {
    let chart: ChartModalConfig | null = null

    if (filters.dateMode === 'months') {
      const { labels, cashVals, qtyVals } = buildMonthlyBarFromRows(rows, filters.selectedMonths)
      chart = {
        kind: 'bar',
        months: labels,
        cashVals,
        qtyVals,
        title: config.barTitle || config.pieTitle,
        showToggle: true,
      }
    } else if (config.kind === 'client') {
      chart = { kind: 'pie', entries: buildClientPie(rows), title: config.pieTitle }
    } else {
      chart = { kind: 'pie', entries: buildItemPie(rows), title: config.pieTitle }
    }

    setReportChart(chart)
    return () => setReportChart(null)
  }, [filters.dateMode, filters.selectedMonths, rows, config.pieTitle, config.barTitle, config.kind, setReportChart])
}
