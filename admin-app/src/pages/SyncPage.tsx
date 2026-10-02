import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/utils'
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { SyncLog } from '../lib/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export function SyncPage() {
  const qc = useQueryClient()
  const { data: logs = [], isLoading, refetch } = useQuery<SyncLog[]>({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    refetchInterval: 10_000,
  })

  const triggerSync = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/trigger-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: SUPABASE_ANON,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`HTTP ${res.status}: ${err}`)
      }
      return res.json()
    },
    onSuccess: () => {
      refetch()
      qc.invalidateQueries({ queryKey: ['dashboard-clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard-sync'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const statusIcon = (s: string) => {
    if (s === 'success') return <CheckCircle size={16} className="text-green-500" />
    if (s === 'failed')  return <XCircle size={16} className="text-red-500" />
    return <Clock size={16} className="text-orange-400 animate-spin" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Google Drive → Supabase synchronization</p>
        </div>
        <button
          onClick={() => triggerSync.mutate()}
          disabled={triggerSync.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          <RefreshCw size={16} className={triggerSync.isPending ? 'animate-spin' : ''} />
          {triggerSync.isPending ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {triggerSync.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {(triggerSync.error as Error).message}
        </div>
      )}

      {triggerSync.data && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          Sync triggered. Rows updated: {triggerSync.data.rows_updated ?? 'pending…'}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Sync History</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No sync runs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Finished</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rows</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Triggered By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(log.status)}
                      <span className="capitalize">{log.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(log.started_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(log.finished_at)}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{log.rows_updated ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">
                      {log.triggered_by}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-600 text-xs max-w-xs truncate">{log.error_message ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
