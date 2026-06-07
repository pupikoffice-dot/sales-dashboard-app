import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MODULE_REGISTRY } from '../../modules/registry'
import type { DashboardModuleId, LogicalCompany } from '../../types/dashboard'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  active: boolean
}

interface AccessRow {
  user_id: string
  modules: string[]
  companies: string[]
  agents: string[] | null
  default_module: string
  active: boolean
}

const COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow']

export function UsersPage() {
  const qc = useQueryClient()
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_profiles').select('id,email,name,role,active').order('name')
      if (error) throw error
      return (data ?? []) as UserRow[]
    },
  })

  const [editId, setEditId] = useState<string | null>(null)

  if (isLoading) return <p className="status-msg">Loading users…</p>

  return (
    <div>
      <div className="ov-header">
        <h2>Dashboard Users</h2>
        <p className="ov-sub">Assign modules, companies, and agents per user.</p>
      </div>
      <div className="tw" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <button type="button" className="ov-toggle-btn" style={{ marginTop: 0, width: 'auto' }} onClick={() => setEditId(u.id)}>
                    Edit access
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editId && (
        <EditAccessModal
          userId={editId}
          userName={users?.find(u => u.id === editId)?.name ?? ''}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null)
            qc.invalidateQueries({ queryKey: ['admin-users'] })
          }}
        />
      )}
    </div>
  )
}

function EditAccessModal({
  userId,
  userName,
  onClose,
  onSaved,
}: {
  userId: string
  userName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [modules, setModules] = useState<DashboardModuleId[]>([])
  const [companies, setCompanies] = useState<LogicalCompany[]>([])
  const [agentsText, setAgentsText] = useState('')
  const [defaultModule, setDefaultModule] = useState<DashboardModuleId>('oversite')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('dashboard_user_access').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as AccessRow
          setModules((row.modules ?? []) as DashboardModuleId[])
          setCompanies((row.companies ?? []) as LogicalCompany[])
          setAgentsText(row.agents?.join(', ') ?? '')
          setDefaultModule((row.default_module as DashboardModuleId) ?? 'oversite')
        } else {
          setModules(['oversite'])
          setCompanies(['pupik'])
        }
      })
  }, [userId])

  function toggleModule(id: DashboardModuleId) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  function toggleCompany(c: LogicalCompany) {
    setCompanies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function save() {
    setSaving(true)
    setError(null)
    const agents = agentsText.trim()
      ? agentsText.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
      : null
    const { error: err } = await supabase.from('dashboard_user_access').upsert({
      user_id: userId,
      modules,
      companies,
      agents,
      default_module: defaultModule,
      active: true,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold">Access — {userName}</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Modules</div>
          <div className="space-y-1">
            {MODULE_REGISTRY.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={modules.includes(m.id)} onChange={() => toggleModule(m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Companies</div>
          <div className="flex gap-4">
            {COMPANIES.map(c => (
              <label key={c} className="flex items-center gap-2 text-sm capitalize">
                <input type="checkbox" checked={companies.includes(c)} onChange={() => toggleCompany(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500">Agents (comma-separated, empty = all)</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={agentsText}
            onChange={e => setAgentsText(e.target.value)}
            placeholder="24, 25, 27"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500">Default module</label>
          <select
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={defaultModule}
            onChange={e => setDefaultModule(e.target.value as DashboardModuleId)}
          >
            {MODULE_REGISTRY.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
