import { useLayoutEffect } from 'react'
import { flushSync } from 'react-dom'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { SalesPage } from './SalesPage'

/** Open Orders (721) — undelivered backlog via Sales report + openorders date mode. */
export function OpenOrdersPage() {
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()

  useLayoutEffect(() => {
    flushSync(() => {
      if (f.dateMode !== 'openorders') f.setDateMode('openorders')
      if (!f.company && access?.companies.length) f.setCompany(access.companies[0])
      if (!f.view) f.setView('clients')
      if (!f.clientMode) f.setClientMode('items')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on route entry
  }, [])

  useLayoutEffect(() => {
    if (f.dateMode !== 'openorders' || !f.company || f.view !== 'clients' || !f.clientMode) return
    if (!f.applied && f.canApply) f.apply()
  }, [f.dateMode, f.company, f.view, f.clientMode, f.canApply, f.applied, f.apply])

  return <SalesPage />
}
