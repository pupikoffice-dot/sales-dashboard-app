import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import type { DashboardAccess, DashboardModuleId, LogicalCompany } from '../types/dashboard'

const ALL_MODULES: DashboardModuleId[] = [
  'oversite', 'sales_performance', 'orders_mtd', 'open_orders', 'returns',
  'debt', 'stock_alerts', 'stock', 'export',
]

const ALL_COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow']

interface DashboardAccessContextValue {
  access: DashboardAccess | null
  loading: boolean
  refresh: () => Promise<void>
}

const DashboardAccessContext = createContext<DashboardAccessContextValue | null>(null)

const LOGICAL_COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow']

function normalizeCompanies(raw: unknown): LogicalCompany[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(c => String(c).toLowerCase())
    .filter((c): c is LogicalCompany => LOGICAL_COMPANIES.includes(c as LogicalCompany))
}

function normalizeAccess(row: Record<string, unknown>, userId: string): DashboardAccess {
  return {
    userId,
    modules: (row.modules as DashboardModuleId[]) ?? [],
    companies: normalizeCompanies(row.companies),
    agents: row.agents == null ? null : (row.agents as string[]),
    defaultModule: (row.default_module as DashboardModuleId) ?? 'oversite',
    active: row.active !== false,
  }
}

export function DashboardAccessProvider({ children }: { children: ReactNode }) {
  const { session, isSuperAdmin } = useAuth()
  const [access, setAccess] = useState<DashboardAccess | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!session) {
      setAccess(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('get_dashboard_access', { p_user_id: session.user.id })
    if (error || !data) {
      if (isSuperAdmin) {
        setAccess({
          userId: session.user.id,
          modules: ALL_MODULES,
          companies: ALL_COMPANIES,
          agents: null,
          defaultModule: 'oversite',
          active: true,
        })
      } else {
        setAccess(null)
      }
    } else {
      setAccess(normalizeAccess(data as Record<string, unknown>, session.user.id))
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [session?.user.id, isSuperAdmin])

  return (
    <DashboardAccessContext.Provider value={{ access, loading, refresh }}>
      {children}
    </DashboardAccessContext.Provider>
  )
}

export function useDashboardAccess() {
  const ctx = useContext(DashboardAccessContext)
  if (!ctx) throw new Error('useDashboardAccess outside provider')
  return ctx
}
