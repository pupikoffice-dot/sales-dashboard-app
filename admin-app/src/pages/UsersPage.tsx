import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import { Plus, Eye, EyeOff, UserCheck, UserX, Trash2, Pencil } from 'lucide-react'
import type { UserProfile, UserRole } from '../lib/types'

const ROLE_RANK: Record<UserRole, number> = { agent: 0, manager: 1, admin: 2, super_admin: 3 }

/** ERP companies for RLS; Goldbug (gold) optional for agents who only use pupik / mt / grow in the app. */
const COMPANY_OPTIONS = ['pupik', 'mt', 'grow', 'gold'] as const

function toggleCompanySelection(
  c: string,
  selected: string[],
  setSelected: (s: string[]) => void,
) {
  if (selected.includes(c)) {
    const next = selected.filter(x => x !== c)
    if (next.length > 0) setSelected(next)
  } else {
    setSelected([...selected, c])
  }
}

const CREATABLE_ROLES: Record<UserRole, UserRole[]> = {
  super_admin: ['admin', 'manager', 'agent'],
  admin:       ['manager', 'agent'],
  manager:     ['agent'],
  agent:       [],
}

async function invokeUserManagement(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('user-management', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const j = await error.context.json().catch(() => null) as { error?: string; message?: string } | null
      if (j?.error) throw new Error(j.error)
      if (j?.message && typeof j.message === 'string') throw new Error(j.message)
    }
    throw new Error(error.message || 'Edge function failed')
  }
  const payload = data as { error?: string; success?: boolean } | null
  if (payload && typeof payload.error === 'string') throw new Error(payload.error)
  return payload
}

export function UsersPage() {
  const { role: myRole, session } = useAuth()
  const myId = session?.user?.id
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]         = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newRole, setNewRole]         = useState<UserRole>('agent')
  const [visiblePws, setVisiblePws]   = useState<Set<string>>(new Set())
  const [createError, setCreateError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [editUser, setEditUser]       = useState<UserProfile | null>(null)
  const [editName, setEditName]       = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail]     = useState('')
  const [editRole, setEditRole]       = useState<UserRole>('agent')
  const [editActive, setEditActive]   = useState(true)
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [editError, setEditError]     = useState('')
  const [newCompanyScope, setNewCompanyScope] = useState<string[]>(['pupik', 'mt', 'grow'])
  const [newAgentErpId, setNewAgentErpId] = useState('')
  const [editCompanyScope, setEditCompanyScope] = useState<string[]>([])
  const [editAgentErpId, setEditAgentErpId] = useState('')

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('role')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const createUser = useMutation({
    mutationFn: async () => {
      setCreateError('')
      await invokeUserManagement({
        action: 'create',
        email: newEmail.trim(),
        username: newUsername.trim().toLowerCase() || null,
        password: newPassword,
        name: newName.trim(),
        role: newRole,
        allowed_companies: newCompanyScope,
        ...(newRole === 'agent' || newRole === 'manager'
          ? { agent_erp_id: newAgentErpId.trim() || null }
          : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setNewName(''); setNewUsername(''); setNewEmail(''); setNewPassword(''); setNewRole('agent'); setShowNewPassword(false)
      setNewCompanyScope(['pupik', 'mt', 'grow'])
      setNewAgentErpId('')
      setCreateError('')
    },
    onError: (err: Error) => setCreateError(err.message),
  })

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editUser || !myId) return
      setEditError('')
      const body: Record<string, unknown> = {
        action: 'update',
        id: editUser.id,
        name: editName.trim(),
        email: editEmail.trim(),
        username: editUsername.trim().toLowerCase() || null,
      }
      if (editPassword.trim()) body.password = editPassword
      if (editUser.id !== myId) {
        body.active = editActive
        body.role = editRole
        body.allowed_companies = editCompanyScope
      }
      if (editRole === 'agent' || editRole === 'manager') {
        body.agent_erp_id = editAgentErpId.trim() || null
      }
      await invokeUserManagement(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
      setEditPassword('')
      setShowEditPassword(false)
      setEditError('')
    },
    onError: (err: Error) => setEditError(err.message),
  })

  function openEdit(u: UserProfile) {
    setEditUser(u)
    setEditName(u.name)
    setEditUsername(u.username ?? '')
    setEditEmail(u.email)
    setEditRole(u.role)
    setEditActive(u.active)
    setEditPassword('')
    setShowEditPassword(false)
    setEditError('')
    const scope = u.allowed_companies?.filter(Boolean)
    setEditCompanyScope(
      scope?.length ? [...scope] : [...COMPANY_OPTIONS],
    )
    setEditAgentErpId(u.agent_erp_id?.trim() ?? '')
  }

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      setDeleteError('')
      await invokeUserManagement({ action: 'delete', id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteError('')
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('user_profiles').update({ active: !active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  function togglePw(id: string) {
    setVisiblePws(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const creatableRoles = myRole ? CREATABLE_ROLES[myRole] : []

  const roleColor: Record<UserRole, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin:       'bg-blue-100 text-blue-700',
    manager:     'bg-green-100 text-green-700',
    agent:       'bg-gray-100 text-gray-600',
  }

  function canDeleteRow(u: UserProfile): boolean {
    if (!myRole || !myId) return false
    if (u.id === myId) return false
    return ROLE_RANK[myRole] > ROLE_RANK[u.role]
  }

  function canEditUser(u: UserProfile): boolean {
    if (!myRole || !myId) return false
    if (u.id === myId) return true
    return canDeleteRow(u)
  }

  const editRoleOptions: UserRole[] = editUser && myRole
    ? [...new Set<UserRole>([editUser.role, ...CREATABLE_ROLES[myRole]])]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} users in your hierarchy</p>
        </div>
        {creatableRoles.length > 0 && (
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            <Plus size={16} /> New User
          </button>
        )}
      </div>

      {deleteError && (
        <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{deleteError}</p>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 text-lg">Edit user</h2>
            <p className="text-xs text-gray-500">
              Stored password is the last value set from this console (Supabase Auth never exposes passwords).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-gray-400 font-normal">(used to log in)</span></label>
                <input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="e.g. liron"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {(editRole === 'agent' || editRole === 'manager') && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ERP agent ID</label>
                  <input
                    value={editAgentErpId}
                    onChange={e => setEditAgentErpId(e.target.value)}
                    placeholder="As on Excel (720 / sales agent column)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must match the agent column in synced files so open delivery lines (720) are visible.
                  </p>
                </div>
              )}
              {editUser.id !== myId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as UserRole)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {editRoleOptions.map(r => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={e => setEditActive(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Active
                  </label>
                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">Company access</span>
                    <div className="flex flex-wrap gap-3">
                      {COMPANY_OPTIONS.map(c => (
                        <label key={c} className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={editCompanyScope.includes(c)}
                            onChange={() => toggleCompanySelection(c, editCompanyScope, setEditCompanyScope)}
                            className="rounded border-gray-300"
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password (optional)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(v => !v)}
                    className="shrink-0 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    {showEditPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              {editUser.password_display && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 font-mono break-all">
                  <span className="font-sans font-medium text-gray-500 block mb-1">Last saved password (console)</span>
                  {visiblePws.has(`pw-${editUser.id}`) ? editUser.password_display : '••••••••'}
                  <button
                    type="button"
                    onClick={() => togglePw(`pw-${editUser.id}`)}
                    className="ml-2 text-blue-600 hover:underline font-sans"
                  >
                    {visiblePws.has(`pw-${editUser.id}`) ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              )}
            </div>
            {editError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{editError}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => updateUser.mutate()}
                disabled={updateUser.isPending || !editName.trim() || !editEmail.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2"
              >
                {updateUser.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditUser(null); setEditError('') }}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-ambient p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Create User</h2>
          <p className="text-xs text-gray-500">
            Creates Supabase Auth login and a profile. New users are attached under you in the hierarchy.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-gray-400 font-normal">(used to log in on tablet)</span></label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="e.g. liron"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="flex gap-2 items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  className="shrink-0 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2"
                >
                  {showNewPassword ? (
                    <span className="inline-flex items-center gap-1"><EyeOff size={14} /> Hide</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><Eye size={14} /> Show</span>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {creatableRoles.map(r => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-2">Company access (ERP data visibility)</span>
              <div className="flex flex-wrap gap-3">
                {COMPANY_OPTIONS.map(c => (
                  <label key={c} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={newCompanyScope.includes(c)}
                      onChange={() => toggleCompanySelection(c, newCompanyScope, setNewCompanyScope)}
                      className="rounded border-gray-300"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            {(newRole === 'agent' || newRole === 'manager') && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ERP agent ID (optional)</label>
                <input
                  value={newAgentErpId}
                  onChange={e => setNewAgentErpId(e.target.value)}
                  placeholder="As on Excel exports"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>
          {createError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{createError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => createUser.mutate()}
              disabled={createUser.isPending || !newName || !newEmail || !newPassword}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
            >
              {createUser.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-ambient overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Password</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ERP agent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Companies</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {u.password_display
                      ? (
                        <button
                          type="button"
                          onClick={() => togglePw(`row-${u.id}`)}
                          className="text-left hover:text-gray-900"
                        >
                          {visiblePws.has(`row-${u.id}`) ? u.password_display : '••••••••'}
                        </button>
                      )
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[u.role]}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-[6rem] truncate" title={u.agent_erp_id ?? ''}>
                    {u.agent_erp_id?.trim() ? u.agent_erp_id : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[10rem]">
                    {(u.allowed_companies?.length
                      ? u.allowed_companies.join(', ')
                      : '—')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canEditUser(u) && (
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="text-gray-400 hover:text-gray-700 p-1 rounded"
                          title="Edit user"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {myRole && ROLE_RANK[myRole] > ROLE_RANK[u.role] && (
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: u.id, active: u.active })}
                          className="text-gray-400 hover:text-gray-700 p-1 rounded"
                          title={u.active ? 'Deactivate' : 'Activate'}
                        >
                          {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      )}
                      {canDeleteRow(u) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete ${u.name}? This removes their login and profile.`)) {
                              deleteUser.mutate(u.id)
                            }
                          }}
                          disabled={deleteUser.isPending}
                          className="text-red-400 hover:text-red-600 p-1 rounded disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
