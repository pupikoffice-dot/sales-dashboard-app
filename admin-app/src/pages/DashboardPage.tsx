import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDateTime } from '../lib/utils'
import { Users, RefreshCw, MessageSquare, ShoppingCart, Package, Smartphone, UserCheck } from 'lucide-react'

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-ambient p-5 flex items-center gap-4">
      <div className={`rounded-full p-3 ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { role } = useAuth()

  const statsOpts = { staleTime: 0, refetchOnMount: 'always' as const }

  const { data: userCount } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: async () => {
      const { count } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('active', true)
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: clientCount } = useQuery({
    queryKey: ['dashboard-clients'],
    queryFn: async () => {
      const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true)
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: lastSync } = useQuery({
    queryKey: ['dashboard-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('finished_at, status, rows_updated')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    ...statsOpts,
  })

  const thisMonth = new Date()
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString()
  const { data: queryCount } = useQuery({
    queryKey: ['dashboard-queries'],
    queryFn: async () => {
      const { count } = await supabase
        .from('query_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart)
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: salesCount } = useQuery({
    queryKey: ['dashboard-sales'],
    queryFn: async () => {
      const { count } = await supabase.from('sales_lines').select('id', { count: 'exact', head: true })
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: inventoryCount } = useQuery({
    queryKey: ['dashboard-inventory'],
    queryFn: async () => {
      const { count } = await supabase.from('inventory').select('sku', { count: 'exact', head: true }).gt('qty_on_hand', 0)
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: agentCount } = useQuery({
    queryKey: ['dashboard-agents'],
    queryFn: async () => {
      const { count } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('active', true).eq('role', 'agent')
      return count ?? 0
    },
    ...statsOpts,
  })

  const { data: deviceCount } = useQuery({
    queryKey: ['dashboard-devices'],
    queryFn: async () => {
      const { count } = await supabase.from('agent_devices').select('id', { count: 'exact', head: true }).eq('revoked', false)
      return count ?? 0
    },
    ...statsOpts,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your sales team system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Clients" value={(clientCount ?? 0).toLocaleString()} icon={<UserCheck size={20} className="text-green-600" />} color="bg-green-50" />
        <StatCard label="Sales Lines (DB)" value={(salesCount ?? 0).toLocaleString()} icon={<ShoppingCart size={20} className="text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Items In Stock" value={(inventoryCount ?? 0).toLocaleString()} icon={<Package size={20} className="text-indigo-600" />} color="bg-indigo-50" />
        <StatCard label="Queries This Month" value={queryCount ?? '…'} icon={<MessageSquare size={20} className="text-purple-600" />} color="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Agents" value={agentCount ?? '…'} icon={<Users size={20} className="text-sky-600" />} color="bg-sky-50" />
        <StatCard label="Active Devices" value={deviceCount ?? '…'} icon={<Smartphone size={20} className="text-teal-600" />} color="bg-teal-50" />
        <StatCard label="Total Users" value={userCount ?? '…'} icon={<Users size={20} className="text-gray-500" />} color="bg-gray-100" />
        <StatCard
          label="Last Sync"
          value={
            !lastSync
              ? 'Never'
              : lastSync.finished_at
                ? formatDateTime(lastSync.finished_at)
                : 'In progress'
          }
          icon={<RefreshCw size={20} className={lastSync?.status === 'success' ? 'text-green-600' : 'text-orange-500'} />}
          color={lastSync?.status === 'success' ? 'bg-green-50' : 'bg-orange-50'}
        />
      </div>

      {role && ['super_admin', 'admin'].includes(role) && lastSync && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-ambient p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Last Sync Details</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Status: <span className={lastSync.status === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{lastSync.status}</span></p>
            <p>Rows updated: {lastSync.rows_updated ?? 'N/A'}</p>
            <p>Completed: {formatDateTime(lastSync.finished_at)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
