import { useLayoutEffect } from 'react'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { SalesPage } from './SalesPage'

/** Open Orders (721) — undelivered backlog via Sales report + openorders date mode. */
export function OpenOrdersPage() {
  const f = useDashboardFilters()

  useLayoutEffect(() => {
    if (f.dateMode !== 'openorders') f.setDateMode('openorders')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync mode when entering this route
  }, [])

  return <SalesPage />
}
