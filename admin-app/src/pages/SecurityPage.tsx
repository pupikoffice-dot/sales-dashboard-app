import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/utils'
import { ShieldOff, ShieldCheck, Smartphone } from 'lucide-react'
import type { AgentDevice, UserProfile } from '../lib/types'

interface DeviceWithAgent extends AgentDevice {
  agent: UserProfile
}

export function SecurityPage() {
  const qc = useQueryClient()

  const { data: devices = [], isLoading } = useQuery<DeviceWithAgent[]>({
    queryKey: ['agent-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_devices')
        .select('*, agent:user_profiles!agent_id(id, name, email, role)')
        .order('last_seen_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })

  const revokeDevice = useMutation({
    mutationFn: async ({ id, revoke }: { id: string; revoke: boolean }) => {
      const { error } = await supabase
        .from('agent_devices')
        .update({
          revoked: revoke,
          revoked_at: revoke ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-devices'] }),
  })

  const active   = devices.filter(d => !d.revoked)
  const revoked  = devices.filter(d => d.revoked)

  function timeSince(iso: string) {
    const ms   = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60_000)
    if (mins < 60)   return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)    return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="text-sm text-gray-500 mt-1">
          {active.length} active devices · {revoked.length} revoked
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Smartphone size={16} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Registered Devices</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No devices registered yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Device</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Android</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">App Version</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Seen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {devices.map(d => (
                <tr key={d.id} className={`hover:bg-gray-50/50 ${d.revoked ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{d.agent?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{d.agent?.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.device_model ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{d.android_version ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.app_version ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(d.registered_at)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <span title={formatDateTime(d.last_seen_at)}>{timeSince(d.last_seen_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {d.revoked ? (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                        <ShieldOff size={11} /> Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-600 text-xs font-medium px-2 py-0.5 rounded-full">
                        <ShieldCheck size={11} /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => revokeDevice.mutate({ id: d.id, revoke: !d.revoked })}
                      className={`text-xs font-medium px-3 py-1 rounded border transition-colors ${
                        d.revoked
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : 'border-red-300 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      {d.revoked ? 'Restore' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">How device revocation works</p>
        <p>When a device is revoked, it will receive a "Device blocked" error on its next API call (within 1 hour of the JWT expiry window). The agent will need to contact an admin to restore access or log in from a new device.</p>
      </div>
    </div>
  )
}
