import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/utils'
import { Smartphone, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import type { AgentDevice, UserProfile } from '../lib/types'

interface DeviceWithAgent extends AgentDevice {
  agent: UserProfile
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}

export function DevicesPage() {
  const { data: devices = [], isLoading } = useQuery<DeviceWithAgent[]>({
    queryKey: ['devices-page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_devices')
        .select('*, agent:user_profiles!agent_id(id, name, email, role)')
        .eq('revoked', false)
        .order('last_seen_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })

  const { data: latestVersion = '' } = useQuery<string>({
    queryKey: ['latest-app-version'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_latest_version')
        .single()
      return data?.value ?? ''
    },
  })

  function timeSince(iso: string) {
    const ms   = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60_000)
    if (mins < 2)    return 'just now'
    if (mins < 60)   return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)    return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function versionStatus(appVersion: string | null) {
    if (!appVersion || !latestVersion) return 'unknown'
    const cmp = compareVersions(appVersion, latestVersion)
    if (cmp >= 0) return 'current'
    return 'outdated'
  }

  const upToDate = devices.filter(d => versionStatus(d.app_version) === 'current')
  const outdated  = devices.filter(d => versionStatus(d.app_version) === 'outdated')
  const unknown   = devices.filter(d => versionStatus(d.app_version) === 'unknown')

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tablets</h1>
          <p className="text-sm text-gray-500 mt-1">
            {devices.length} active device{devices.length !== 1 ? 's' : ''} · latest version: <span className="font-mono font-semibold text-gray-700">{latestVersion || '…'}</span>
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 size={14} /> {upToDate.length} up to date</span>
          <span className="flex items-center gap-1.5 text-amber-600"><AlertCircle size={14} /> {outdated.length} outdated</span>
          {unknown.length > 0 && <span className="flex items-center gap-1.5 text-gray-400"><Clock size={14} /> {unknown.length} unknown</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Smartphone size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Active Devices</h2>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : devices.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No devices registered yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Device</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Android</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">App Version</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Seen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {devices.map(d => {
                const status = versionStatus(d.app_version)
                return (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.agent?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{d.agent?.role ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.device_model ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{d.android_version ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-800">{d.app_version ?? '—'}</span>
                        {status === 'current' && (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Latest
                          </span>
                        )}
                        {status === 'outdated' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            <AlertCircle size={10} /> Update available
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <span title={formatDateTime(d.last_seen_at)}>{timeSince(d.last_seen_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(d.registered_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
