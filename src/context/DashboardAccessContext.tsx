import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { usePreview } from './PreviewContext'
import { supabase } from '../lib/supabase'
import type { DashboardAccess, DashboardModuleId, LogicalCompany } from '../types/dashboard'
import { ALL_OVERSITE_MODULE_IDS } from '../lib/oversiteModules'

const ALL_MODULES: DashboardModuleId[] = [
  'oversite', 'sales_performance', 'orders_mtd', 'open_orders', 'returns',
  'debt', 'stock_alerts', 'stock', 'export',
]

const ALL_COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

interface DashboardAccessContextValue {
  access: DashboardAccess | null
  loading: boolean
  refresh: () => Promise<void>
}

const DashboardAccessContext = createContext<DashboardAccessContextValue | null>(null)

const LOGICAL_COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

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
    showItemCost: row.show_item_cost === true,
    showClientProfit: row.show_client_profit === true,
    oversiteModules: Array.isArray(row.oversite_modules) ? (row.oversite_modules as string[]) : [],
  }
}

export function DashboardAccessProvider({ children }: { children: ReactNode }) {
  const { session, isSuperAdmin } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  const [access, setAccess] = useState<DashboardAccess | null>(null)
  const [loading, setLoading] = useState(true)
  // Guards against out-of-order responses when the preview target changes
  // faster than the network replies.
  const reqToken = useRef(0)

  async function refresh() {
    if (!session) {
      setAccess(null)
      setLoading(false)
      return
    }
    const token = ++reqToken.current
    setLoading(true)

    // While previewing, load the TARGET user's access row with a direct table
    // select. That path is authorized server-side by the RLS policy
    // `dashboard_access_select_own` (user_id = auth.uid() OR is_super_admin()),
    // so a non-super-admin physically cannot read another user's row — the
    // guarantee is in Postgres rather than in this UI.
    if (isPreviewing && previewUser) {
      const { data, error } = await supabase
        .from('dashboard_user_access')
        .select('*')
        .eq('user_id', previewUser.id)
        .maybeSingle()
      if (token !== reqToken.current) return
      // No row (or unreadable) => that user genuinely has no access configured.
      // Never fall back to the super-admin defaults here: that would show the
      // admin their own full access while claiming to be the previewed user.
      setAccess(
        error || !data
          ? null
          : normalizeAccess(data as Record<string, unknown>, previewUser.id),
      )
      setLoading(false)
      return
    }

    const { data, error } = await supabase.rpc('get_dashboard_access', { p_user_id: session.user.id })
    if (token !== reqToken.current) return
    if (error || !data) {
      if (isSuperAdmin) {
        setAccess({
          userId: session.user.id,
          modules: ALL_MODULES,
          companies: ALL_COMPANIES,
          agents: null,
          defaultModule: 'oversite',
          active: true,
          showItemCost: true,
          showClientProfit: true,
          oversiteModules: ALL_OVERSITE_MODULE_IDS,
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
  }, [session?.user.id, isSuperAdmin, isPreviewing, previewUser?.id])

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
