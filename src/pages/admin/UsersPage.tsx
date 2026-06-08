import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { callUserManagement } from '../../lib/userManagement'
import { displayLoginId, isEmailLogin, isInternalAuthEmail } from '../../lib/loginIdentifier'
import { MODULE_REGISTRY } from '../../modules/registry'
import type { DashboardModuleId, LogicalCompany } from '../../types/dashboard'

interface UserRow {
  id: string
  email: string
  username: string | null
  name: string
  role: string
  active: boolean
  password_display: string | null
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
  const [showCreate, setShowCreate] = useState(false)
  const [newLogin, setNewLogin] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [visiblePwds, setVisiblePwds] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [pwdEditId, setPwdEditId] = useState<string | null>(null)
  const [pwdEditValue, setPwdEditValue] = useState('')

  const { data: users, isLoading, error: loadError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id,email,username,name,role,active,password_display')
        .order('name')
      if (error) throw error
      return (data ?? []) as UserRow[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      callUserManagement({
        action: 'create',
        login: newLogin.trim(),
        password: newPassword,
        name: newName.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreate(false)
      setNewLogin('')
      setNewName('')
      setNewPassword('')
      setCreateError(null)
    },
    onError: (e: Error) => setCreateError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => callUserManagement({ action: 'delete', id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      callUserManagement({ action: 'update-password', id, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setPwdEditId(null)
      setPwdEditValue('')
    },
  })

  function togglePwd(user: UserRow) {
    if (!user.password_display) {
      setPwdEditId(user.id)
      setPwdEditValue('')
      return
    }
    setVisiblePwds(prev => {
      const next = new Set(prev)
      if (next.has(user.id)) next.delete(user.id)
      else next.add(user.id)
      return next
    })
  }

  function handleDelete(user: UserRow) {
    if (user.role === 'super_admin') return
    if (!confirm(`Delete user "${user.name}" (${displayLoginId(user)})?\nThis cannot be undone.`)) return
    deleteMutation.mutate(user.id)
  }

  if (isLoading) return <p className="status-msg">Loading users…</p>
  if (loadError) return <p className="status-msg error">{(loadError as Error).message}</p>

  return (
    <div>
      <div className="ov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h2>Dashboard Users</h2>
          <p className="ov-sub">Add users, set passwords, and assign modules, companies, and agents.</p>
        </div>
        <button
          type="button"
          className="ov-toggle-btn"
          style={{ marginTop: 0, width: 'auto', flexShrink: 0 }}
          onClick={() => { setShowCreate(true); setCreateError(null) }}
        >
          + Add user
        </button>
      </div>

      {showCreate && (
        <div className="tw" style={{ marginTop: 16, maxWidth: 480 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>New user</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '.8rem' }}>
              Login (email or username) *
              <input
                className="sbar-search"
                style={{ display: 'block', width: '100%', marginTop: 4, borderRadius: 6 }}
                type="text"
                value={newLogin}
                onChange={e => setNewLogin(e.target.value)}
                placeholder="user@company.com or jsmith"
                autoComplete="off"
              />
            </label>
            <label style={{ fontSize: '.8rem' }}>
              Display name
              <input
                className="sbar-search"
                style={{ display: 'block', width: '100%', marginTop: 4, borderRadius: 6 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={isEmailLogin(newLogin) ? 'Optional' : 'Optional — defaults to username'}
              />
            </label>
            <label style={{ fontSize: '.8rem' }}>
              Password *
              <input
                className="sbar-search"
                style={{ display: 'block', width: '100%', marginTop: 4, borderRadius: 6 }}
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Set login password"
              />
            </label>
            {createError && <p className="status-msg error" style={{ margin: 0 }}>{createError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ov-toggle-btn"
                style={{ marginTop: 0, width: 'auto' }}
                disabled={createMutation.isPending || !newLogin.trim() || !newPassword}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating…' : 'Create user'}
              </button>
              <button type="button" className="sbar-minimize-btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tw" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Login</th>
              <th>Role</th>
              <th>Password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  {u.role === 'super_admin' && (
                    <span style={{ marginLeft: 6, fontSize: '.65rem', color: 'var(--amber)' }}>SUPER</span>
                  )}
                </td>
                <td>
                  {displayLoginId(u)}
                  {u.username && isInternalAuthEmail(u.email) && (
                    <span style={{ display: 'block', fontSize: '.65rem', color: 'var(--muted)' }}>username login</span>
                  )}
                </td>
                <td>{u.role}</td>
                <td>
                  {pwdEditId === u.id ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        className="col-filter"
                        style={{ width: 120 }}
                        type="text"
                        value={pwdEditValue}
                        onChange={e => setPwdEditValue(e.target.value)}
                        placeholder="New password"
                      />
                      <button
                        type="button"
                        className="col-filter-mode"
                        style={{ fontSize: '.55rem' }}
                        disabled={passwordMutation.isPending || !pwdEditValue}
                        onClick={() => passwordMutation.mutate({ id: u.id, password: pwdEditValue })}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="sbar-minimize-btn"
                        style={{ padding: '2px 6px', fontSize: '.6rem' }}
                        onClick={() => { setPwdEditId(null); setPwdEditValue('') }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '.75rem', color: u.password_display ? undefined : 'var(--muted)' }}>
                        {visiblePwds.has(u.id)
                          ? (u.password_display ?? 'not saved')
                          : (u.password_display ? '••••••••' : '—')}
                      </span>
                      <button
                        type="button"
                        className="sbar-minimize-btn"
                        style={{ padding: '2px 8px', fontSize: '.65rem' }}
                        onClick={() => togglePwd(u)}
                        title={u.password_display ? undefined : 'Password was never saved — enter it with Set'}
                      >
                        {visiblePwds.has(u.id) ? 'Hide' : (u.password_display ? 'Show' : 'Set pwd')}
                      </button>
                      <button
                        type="button"
                        className="sbar-minimize-btn"
                        style={{ padding: '2px 8px', fontSize: '.65rem' }}
                        onClick={() => { setPwdEditId(u.id); setPwdEditValue(u.password_display ?? '') }}
                      >
                        Set
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="ov-toggle-btn"
                    style={{ marginTop: 0, width: 'auto', marginRight: 6 }}
                    onClick={() => setEditId(u.id)}
                  >
                    Edit access
                  </button>
                  {u.role !== 'super_admin' && (
                    <button
                      type="button"
                      className="sbar-minimize-btn"
                      style={{ color: 'var(--red)' }}
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(u)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>No users yet.</td>
              </tr>
            )}
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
