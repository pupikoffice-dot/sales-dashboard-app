import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BarChart2 } from 'lucide-react'

interface AgentUsage {
  agent_id: string
  name: string
  email: string
  query_count: number
  last_query: string | null
}

export function UsagePage() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  const { data: usage = [], isLoading } = useQuery<AgentUsage[]>({
    queryKey: ['usage', monthStart],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('query_logs')
        .select('agent_id, created_at')
        .gte('created_at', monthStart)

      if (error) throw error

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('role', 'agent')

      const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string; email: string }) => [p.id, p]))
      const counts: Record<string, { count: number; last: string | null }> = {}

      for (const log of (logs ?? [])) {
        if (!counts[log.agent_id]) counts[log.agent_id] = { count: 0, last: null }
        counts[log.agent_id].count++
        if (!counts[log.agent_id].last || log.created_at > counts[log.agent_id].last!) {
          counts[log.agent_id].last = log.created_at
        }
      }

      return Object.entries(counts).map(([agentId, { count, last }]) => ({
        agent_id: agentId,
        name:     profileMap[agentId]?.name ?? 'Unknown',
        email:    profileMap[agentId]?.email ?? '',
        query_count: count,
        last_query: last,
      })).sort((a, b) => b.query_count - a.query_count)
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value')
      return Object.fromEntries((data ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))
    },
  })

  const limit  = parseInt((settings as Record<string, string>)?.['queries_per_agent_limit'] ?? '500', 10)
  const model  = (settings as Record<string, string>)?.['ai_model'] ?? 'gemini-2.5-flash'
  const totalQueries = usage.reduce((sum, u) => sum + u.query_count, 0)

  const costPer1k: Record<string, number> = {
    'gemini-2.5-flash':      0.0001,
    'gemini-2.5-flash-lite': 0.00005,
    'gemini-2.5-pro':        0.002,
    'gemini-2.0-flash':      0.0001,
    'gemini-1.5-pro':        0.00125,
    'claude-haiku-4-5': 0.0008,
    'claude-sonnet-4-5':0.003,
    'gpt-4o-mini':      0.00015,
    'gpt-4o':           0.005,
  }
  const ratePerQuery    = (costPer1k[model] ?? 0.001) * 0.5
  const estimatedCost   = (totalQueries * ratePerQuery).toFixed(2)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage</h1>
        <p className="text-sm text-gray-500 mt-1">{monthLabel} — {totalQueries} total queries · est. ${estimatedCost}</p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading…</div>
      ) : usage.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-ambient p-8 text-center text-gray-400">
          <BarChart2 size={32} className="mx-auto mb-2 opacity-40" />
          No queries this month
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-ambient overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Queries</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Est. Cost</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Query</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usage.map(u => {
                const pct = Math.min(100, Math.round((u.query_count / limit) * 100))
                return (
                  <tr key={u.agent_id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {u.query_count} / {limit}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">${(u.query_count * ratePerQuery).toFixed(3)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.last_query ? new Date(u.last_query).toLocaleString('he-IL') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
