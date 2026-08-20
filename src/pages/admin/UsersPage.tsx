import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { supabase } from '../../lib/supabase'
import { callUserManagement } from '../../lib/userManagement'
import { displayLoginId, isEmailLogin, isInternalAuthEmail } from '../../lib/loginIdentifier'
import { MODULE_REGISTRY } from '../../modules/registry'
import { OVERSITE_MODULE_REGISTRY, type OversiteModuleId } from '../../lib/oversiteModules'
import type { AppLocale } from '../../i18n/types'
import type { DashboardModuleId, LogicalCompany } from '../../types/dashboard'
import { UserPermissionsEditor } from './UserPermissionsEditor'

interface UserRow {
  id: string
  email: string
  username: string | null
  name: string
  role: string
  active: boolean
  password_display: string | null
  agent_erp_id: string | null
  parent_id: string | null
}

const SYSTEM_ROLES = ['agent', 'manager', 'admin'] as const
type SystemRole = (typeof SYSTEM_ROLES)[number]

interface AccessRow {
  user_id: string
  modules: string[]
  companies: string[]
  agents: string[] | null
  default_module: string
  locale?: string
  active: boolean
  show_item_cost?: boolean
  show_client_profit?: boolean
  oversite_modules?: string[] | null
}

const COMPANIES: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

function formatCompanies(companies: string[] | undefined, role: string) {
  if (role === 'super_admin') return 'all'
  if (!companies?.length) return '—'
  return companies.join(', ')
}

function formatAgents(agents: string[] | null | undefined, role: string) {
  if (role === 'super_admin') return 'all'
  if (!agents?.length) return 'all'
  return agents.join(', ')
}

export function UsersPage() {
  const qc = useQueryClient()
  const { isPreviewing, previewUser } = usePreview()
  const { refresh: refreshAccess } = useDashboardAccess()
  const [showCreate, setShowCreate] = useState(false)
  const [newLogin, setNewLogin] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [visiblePwds, setVisiblePwds] = useState<Set<string>>(new Set())
  const [showAllPasswords, setShowAllPasswords] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pwdEditId, setPwdEditId] = useState<string | null>(null)
  const [pwdEditValue, setPwdEditValue] = useState('')

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const [profilesRes, accessRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id,email,username,name,role,active,password_display,agent_erp_id,parent_id')
          .order('name'),
        supabase
          .from('dashboard_user_access')
          .select('user_id, companies, agents, locale'),
      ])
      if (profilesRes.error) throw profilesRes.error
      if (accessRes.error) throw accessRes.error
      const accessMap = new Map(
        (accessRes.data ?? []).map(row => [row.user_id as string, row as AccessRow]),
      )
      return { users: (profilesRes.data ?? []) as UserRow[], accessMap }
    },
  })

  const users = data?.users
  const accessMap = data?.accessMap ?? new Map<string, AccessRow>()

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

  function togglePwdVisible(userId: string) {
    setVisiblePwds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function openPwdEdit(user: UserRow) {
    setPwdEditId(user.id)
    setPwdEditValue(user.password_display ?? '')
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
          <p className="ov-sub">Add users, set passwords, org hierarchy (ERP agent + manager), and access.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="sbar-minimize-btn"
            style={{ marginTop: 0 }}
            onClick={() => {
              setShowAllPasswords(prev => !prev)
              if (showAllPasswords) setVisiblePwds(new Set())
            }}
          >
            {showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
          </button>
          <button
            type="button"
            className="ov-toggle-btn"
            style={{ marginTop: 0, width: 'auto' }}
            onClick={() => { setShowCreate(true); setCreateError(null) }}
          >
            + Add user
          </button>
        </div>
      </div>

      {showCreate && (
        <div
          className="debt-overlay"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div className="debt-modal admin-modal">
            <div className="debt-modal-hdr">
              <span>New user</span>
              <button type="button" className="debt-modal-close" onClick={() => setShowCreate(false)}>
                Close
              </button>
            </div>
            <div className="debt-modal-body">
              <div className="admin-form">
                <label>
                  Login (email or username) *
                  <input
                    className="sbar-search block-input"
                    type="text"
                    value={newLogin}
                    onChange={e => setNewLogin(e.target.value)}
                    placeholder="user@company.com or jsmith"
                    autoComplete="off"
                  />
                </label>
                <label>
                  Display name
                  <input
                    className="sbar-search block-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={isEmailLogin(newLogin) ? 'Optional' : 'Optional — defaults to username'}
                  />
                </label>
                <label>
                  Password *
                  <input
                    className="sbar-search block-input"
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Set login password"
                  />
                </label>
                {createError && <p className="status-msg error" style={{ margin: 0 }}>{createError}</p>}
                <div className="admin-form-actions">
                  <button type="button" className="sbar-minimize-btn" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ov-toggle-btn"
                    style={{ marginTop: 0, width: 'auto' }}
                    disabled={createMutation.isPending || !newLogin.trim() || !newPassword}
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create user'}
                  </button>
                </div>
              </div>
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
              <th>ERP agent</th>
              <th>Reports to</th>
              <th>Companies</th>
              <th>Agents</th>
              <th>Password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => {
              const access = accessMap.get(u.id)
              const hasStoredPwd = !!u.password_display?.trim()
              const pwdVisible = showAllPasswords || visiblePwds.has(u.id)
              return (
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
                <td style={{ fontSize: '.78rem', fontFamily: 'monospace' }}>
                  {u.agent_erp_id?.trim() || '—'}
                </td>
                <td style={{ fontSize: '.78rem' }}>
                  {u.parent_id
                    ? (users?.find(p => p.id === u.parent_id)?.name ?? u.parent_id.slice(0, 8))
                    : '—'}
                </td>
                <td style={{ fontSize: '.78rem', textTransform: 'capitalize' }}>
                  {formatCompanies(access?.companies, u.role)}
                </td>
                <td style={{ fontSize: '.78rem' }}>
                  {formatAgents(access?.agents, u.role)}
                </td>
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '.75rem', color: hasStoredPwd ? undefined : 'var(--muted)' }}>
                        {pwdVisible
                          ? (hasStoredPwd ? u.password_display : 'not recorded')
                          : (hasStoredPwd ? '••••••••' : '—')}
                      </span>
                      {hasStoredPwd && (
                        <button
                          type="button"
                          className="sbar-minimize-btn"
                          style={{ padding: '2px 8px', fontSize: '.65rem' }}
                          onClick={() => togglePwdVisible(u.id)}
                          disabled={showAllPasswords}
                        >
                          {pwdVisible ? 'Hide' : 'Show'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="sbar-minimize-btn"
                        style={{ padding: '2px 8px', fontSize: '.65rem' }}
                        onClick={() => openPwdEdit(u)}
                      >
                        {hasStoredPwd ? 'Change' : 'Set password'}
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
            )})}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>No users yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editId && (
        <EditAccessModal
          userId={editId}
          userName={users?.find(u => u.id === editId)?.name ?? ''}
          users={users ?? []}
          onClose={() => setEditId(null)}
          onSaved={savedUserId => {
            setEditId(null)
            qc.invalidateQueries({ queryKey: ['admin-users'] })
            qc.invalidateQueries({ queryKey: ['admin-users-picker'] })
            // If we're previewing the user whose access just changed, reload it
            // so the live preview reflects the new settings immediately (no
            // dashboard-data refetch needed — all narrowing is client-side).
            if (isPreviewing && previewUser?.id === savedUserId) {
              refreshAccess()
            }
          }}
        />
      )}
    </div>
  )
}

function EditAccessModal({
  userId,
  userName,
  users,
  onClose,
  onSaved,
}: {
  userId: string
  userName: string
  users: UserRow[]
  onClose: () => void
  /** Receives the saved user's id so callers can react (e.g. refresh a live preview). */
  onSaved: (savedUserId: string) => void
}) {
  const [modules, setModules] = useState<DashboardModuleId[]>([])
  const [oversiteModules, setOversiteModules] = useState<OversiteModuleId[]>([])
  const [companies, setCompanies] = useState<LogicalCompany[]>([])
  const [agentsText, setAgentsText] = useState('')
  const [defaultModule, setDefaultModule] = useState<DashboardModuleId>('oversite')
  const [locale, setLocale] = useState<AppLocale>('en')
  const [showItemCost, setShowItemCost] = useState(false)
  const [showClientProfit, setShowClientProfit] = useState(false)
  const [systemRole, setSystemRole] = useState<SystemRole | 'super_admin'>('agent')
  const [agentErpId, setAgentErpId] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLocale()

  const profile = users.find(u => u.id === userId)
  const parentOptions = users.filter(u => u.id !== userId)

  useEffect(() => {
    supabase.from('dashboard_user_access').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as AccessRow
          setModules((row.modules ?? []) as DashboardModuleId[])
          setOversiteModules(
            row.oversite_modules != null
              ? (row.oversite_modules as OversiteModuleId[])
              : OVERSITE_MODULE_REGISTRY.map(m => m.id), // no row saved yet: prefill all-checked (convenience only, not persisted until Save)
          )
          setCompanies((row.companies ?? []) as LogicalCompany[])
          setAgentsText(row.agents?.join(', ') ?? '')
          setDefaultModule((row.default_module as DashboardModuleId) ?? 'oversite')
          setLocale(row.locale === 'he' ? 'he' : 'en')
          setShowItemCost(row.show_item_cost === true)
          setShowClientProfit(row.show_client_profit === true)
        } else {
          setModules(['oversite'])
          setOversiteModules(OVERSITE_MODULE_REGISTRY.map(m => m.id))
          setCompanies(['pupik'])
        }
      })
    const p = users.find(u => u.id === userId)
    if (p) {
      setSystemRole(p.role as SystemRole | 'super_admin')
      setAgentErpId(p.agent_erp_id ?? '')
      setParentId(p.parent_id ?? '')
    }
  }, [userId, users])

  function toggleModule(id: DashboardModuleId) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  function toggleOversiteModule(id: OversiteModuleId) {
    setOversiteModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
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

    if (profile?.role !== 'super_admin') {
      const role = SYSTEM_ROLES.includes(systemRole as SystemRole) ? systemRole : 'agent'
      const erp = agentErpId.trim() || null
      const { error: orgErr } = await supabase
        .from('user_profiles')
        .update({
          role,
          agent_erp_id: erp,
          parent_id: parentId.trim() || null,
        })
        .eq('id', userId)
      if (orgErr) {
        setSaving(false)
        setError(orgErr.message)
        return
      }
    }

    const { error: err } = await supabase.from('dashboard_user_access').upsert({
      user_id: userId,
      modules,
      oversite_modules: oversiteModules,
      companies,
      agents,
      default_module: defaultModule,
      locale,
      active: true,
      show_item_cost: showItemCost,
      show_client_profit: showClientProfit,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) setError(err.message)
    else onSaved(userId)
  }

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal admin-modal">
        <div className="debt-modal-hdr">
          <span>Access — {userName}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="debt-modal-body">
          <div className="admin-form">
            {error && <p className="status-msg error" style={{ margin: 0 }}>{error}</p>}

            {profile?.role !== 'super_admin' && (
              <div>
                <div className="admin-form-section-title">Org hierarchy (Phase 2.5)</div>
                <p className="ov-sub" style={{ margin: '0 0 8px', fontSize: '.72rem' }}>
                  ERP agent ID links this login to sales rows. Reports-to builds the manager subtree for future permission classes.
                </p>
                <label>
                  System role
                  <select
                    className="block-input"
                    value={systemRole}
                    onChange={e => setSystemRole(e.target.value as SystemRole)}
                  >
                    {SYSTEM_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  ERP agent ID
                  <input
                    className="sbar-search block-input"
                    value={agentErpId}
                    onChange={e => setAgentErpId(e.target.value)}
                    placeholder="e.g. 24"
                  />
                </label>
                <label>
                  Reports to
                  <select
                    className="block-input"
                    value={parentId}
                    onChange={e => setParentId(e.target.value)}
                  >
                    <option value="">— none (top level) —</option>
                    {parentOptions.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div>
              <div className="admin-form-section-title">Modules</div>
              <div className="admin-form-checklist">
                {MODULE_REGISTRY.map(m => (
                  <label key={m.id} className="admin-form-check">
                    <input type="checkbox" checked={modules.includes(m.id)} onChange={() => toggleModule(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            {modules.includes('oversite') && (
              <div>
                <div className="admin-form-section-title">Oversight Modules</div>
                <p className="ov-sub" style={{ margin: '0 0 6px', fontSize: '.72rem' }}>
                  Which sections this user sees inside Oversight. Unchecked sections are hidden entirely.
                </p>
                <div className="admin-form-checklist">
                  {OVERSITE_MODULE_REGISTRY.map(m => (
                    <label key={m.id} className="admin-form-check">
                      <input
                        type="checkbox"
                        checked={oversiteModules.includes(m.id)}
                        onChange={() => toggleOversiteModule(m.id)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="admin-form-section-title">Companies</div>
              <div className="admin-form-checkrow">
                {COMPANIES.map(c => (
                  <label key={c} className="admin-form-check capitalize">
                    <input type="checkbox" checked={companies.includes(c)} onChange={() => toggleCompany(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="admin-form-section-title">{t('admin.itemsParameters')}</div>
              <label className="admin-form-check">
                <input
                  type="checkbox"
                  checked={showItemCost}
                  onChange={e => setShowItemCost(e.target.checked)}
                />
                {t('admin.showItemCost')}
              </label>
            </div>

            <div>
              <div className="admin-form-section-title">{t('admin.clientsParameters')}</div>
              <label className="admin-form-check">
                <input
                  type="checkbox"
                  checked={showClientProfit}
                  onChange={e => setShowClientProfit(e.target.checked)}
                />
                {t('admin.showClientProfit')}
              </label>
            </div>

            <label>
              Agents (comma-separated, empty = all)
              <input
                className="sbar-search block-input"
                value={agentsText}
                onChange={e => setAgentsText(e.target.value)}
                placeholder="24, 25, 27"
              />
            </label>

            <div>
              <div className="admin-form-section-title">Class &amp; permission overrides</div>
              <UserPermissionsEditor userId={userId} />
            </div>

            <label>
              Default module
              <select
                className="block-input"
                value={defaultModule}
                onChange={e => setDefaultModule(e.target.value as DashboardModuleId)}
              >
                {MODULE_REGISTRY.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            <label>
              Language
              <select
                className="block-input"
                value={locale}
                onChange={e => setLocale(e.target.value as AppLocale)}
              >
                <option value="en">English</option>
                <option value="he">עברית (Hebrew)</option>
              </select>
            </label>

            <div className="admin-form-actions">
              <button type="button" className="sbar-minimize-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="ov-toggle-btn"
                style={{ marginTop: 0, width: 'auto' }}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
