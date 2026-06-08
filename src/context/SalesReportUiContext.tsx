import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ChartModal, type ChartModalConfig } from '../components/sales/ChartModal'
import { useLocale } from './LocaleContext'
import { useTableSortDelegation } from '../hooks/useTableSortDelegation'

interface SalesReportUiValue {
  searchQuery: string
  setSearchQuery: (q: string) => void
  globalCollapsed: boolean | null
  toggleCollapseAll: () => void
  clearGlobalCollapse: () => void
  collapseAllLabel: string
  hasSections: boolean
  reportChart: ChartModalConfig | null
  setReportChart: (config: ChartModalConfig | null) => void
  openChart: (config: ChartModalConfig) => void
}

const SalesReportUiContext = createContext<SalesReportUiValue | null>(null)

export function SalesReportUiProvider({
  children,
  hasSections = false,
}: {
  children: ReactNode
  hasSections?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null)
  const [reportChart, setReportChart] = useState<ChartModalConfig | null>(null)
  const [activeChart, setActiveChart] = useState<ChartModalConfig | null>(null)
  const { t } = useLocale()

  useTableSortDelegation('sales-report')

  const collapseAllLabel =
    globalCollapsed === true ? `⊞ ${t('sales.expandAll')}` : `⊟ ${t('sales.minimizeAll')}`

  const openChart = useCallback((config: ChartModalConfig) => {
    setActiveChart(config)
  }, [])

  const closeChart = useCallback(() => {
    setActiveChart(null)
  }, [])

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      globalCollapsed,
      toggleCollapseAll: () => setGlobalCollapsed(prev => (prev === true ? false : true)),
      clearGlobalCollapse: () => setGlobalCollapsed(null),
      collapseAllLabel,
      hasSections,
      reportChart,
      setReportChart,
      openChart,
    }),
    [searchQuery, globalCollapsed, collapseAllLabel, hasSections, reportChart, openChart],
  )

  return (
    <SalesReportUiContext.Provider value={value}>
      {children}
      <ChartModal config={activeChart} onClose={closeChart} />
    </SalesReportUiContext.Provider>
  )
}

export function useSalesReportUi() {
  const ctx = useContext(SalesReportUiContext)
  if (!ctx) throw new Error('useSalesReportUi outside SalesReportUiProvider')
  return ctx
}
