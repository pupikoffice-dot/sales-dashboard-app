import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ThumbsUp, ThumbsDown, MessageSquare, Minus } from 'lucide-react'

interface QueryLog {
  id: number
  created_at: string
  message: string | null
  reply: string | null
  client_id: string | null
  voice_mode: boolean
  rating: 1 | -1 | null
  agent_name: string | null
  provider: string
  model: string
}

export function QueriesPage() {
  const [filter, setFilter] = useState<'all' | 'thumbsup' | 'thumbsdown' | 'unrated'>('all')
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['query-logs', filter],
    queryFn: async () => {
      let q = supabase
        .from('query_logs')
        .select(`id, created_at, message, reply, client_id, voice_mode, rating, provider, model,
          user_profiles!agent_id ( name )`)
        .order('created_at', { ascending: false })
        .limit(200)

      if (filter === 'thumbsup')   q = q.eq('rating', 1)
      if (filter === 'thumbsdown') q = q.eq('rating', -1)
      if (filter === 'unrated')    q = q.is('rating', null)

      const { data } = await q
      return (data ?? []).map((r: any) => ({
        ...r,
        agent_name: r.user_profiles?.name ?? '—',
      })) as QueryLog[]
    },
  })

  const thumbsUp   = logs.filter(l => l.rating === 1).length
  const thumbsDown = logs.filter(l => l.rating === -1).length
  const unrated    = logs.filter(l => l.rating === null).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Query Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">All agent questions and AI responses — use ratings to identify what needs improvement</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total queries', value: logs.length, color: 'text-gray-900' },
          { label: '👍 Good', value: thumbsUp, color: 'text-green-600' },
          { label: '👎 Needs work', value: thumbsDown, color: 'text-red-600' },
          { label: 'Unrated', value: unrated, color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'thumbsup', 'thumbsdown', 'unrated'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#001a4d] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'thumbsup' ? '👍 Good' : f === 'thumbsdown' ? '👎 Needs work' : 'Unrated'}
          </button>
        ))}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare size={36} strokeWidth={1.5} className="mx-auto mb-3" />
          <p>No queries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Header row */}
              <button
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                {/* Rating icon */}
                <div className="shrink-0 mt-0.5">
                  {log.rating === 1  && <ThumbsUp  size={15} className="text-green-500" />}
                  {log.rating === -1 && <ThumbsDown size={15} className="text-red-500" />}
                  {log.rating === null && <Minus size={15} className="text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {log.message ?? '—'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>{log.agent_name}</span>
                    {log.client_id && <span>client: {log.client_id}</span>}
                    {log.voice_mode && <span>🎤 voice</span>}
                    <span>{new Date(log.created_at).toLocaleString('he-IL')}</span>
                    <span className="font-mono">{log.model}</span>
                  </div>
                </div>

                <span className="shrink-0 text-gray-300 text-xs mt-0.5">{expanded === log.id ? '▲' : '▼'}</span>
              </button>

              {/* Expanded reply */}
              {expanded === log.id && log.reply && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">AI Response:</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-3 max-h-80 overflow-y-auto">
                    {log.reply}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
