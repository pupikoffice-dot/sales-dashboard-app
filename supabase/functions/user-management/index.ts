import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent'

const RANK: Record<UserRole, number> = {
  agent: 0, manager: 1, admin: 2, super_admin: 3,
}

const CREATABLE: Record<UserRole, UserRole[]> = {
  super_admin: ['admin', 'manager', 'agent'],
  admin:       ['manager', 'agent'],
  manager:     ['agent'],
  agent:       [],
}

const VALID_COMPANIES = ['pupik', 'mt', 'grow', 'gold'] as const

function parseUsername(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw !== 'string') throw new Error('username must be a string or null')
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (!/^[a-z0-9_\-\.]+$/.test(t)) throw new Error('username may only contain letters, numbers, _ - .')
  return t
}

function parseAgentErpId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw !== 'string') throw new Error('agent_erp_id must be a string or null')
  const t = raw.trim()
  return t.length ? t : null
}

function parseAllowedCompanies(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) throw new Error('allowed_companies must be an array')
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') throw new Error('allowed_companies entries must be strings')
    const c = x.trim().toLowerCase()
    if (!VALID_COMPANIES.includes(c as (typeof VALID_COMPANIES)[number]))
      throw new Error(`Invalid company: ${c}`)
    if (!out.includes(c)) out.push(c)
  }
  if (out.length === 0) throw new Error('allowed_companies cannot be empty')
  return out
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function isManagedBy(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  targetId: string,
): Promise<boolean> {
  if (callerId === targetId) return false
  let id: string | null = targetId
  for (let i = 0; i < 32 && id; i++) {
    const { data: row } = await admin
      .from('user_profiles')
      .select('parent_id')
      .eq('id', id)
      .maybeSingle()
    if (!row) return false
    if (row.parent_id === callerId) return true
    id = row.parent_id
  }
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'No auth header' }, 401)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser()
  if (authErr || !caller) return json({ error: 'Auth failed: ' + (authErr?.message ?? 'no user') }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerProfile, error: cpErr } = await admin
    .from('user_profiles')
    .select('id, role')
    .eq('id', caller.id)
    .maybeSingle()

  if (cpErr || !callerProfile) return json({ error: 'Profile not found' }, 403)

  const callerRole = callerProfile.role as UserRole

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = body.action as string

  if (action === 'create') {
    const email    = (body.email as string)?.trim()
    const password = body.password as string
    const name     = (body.name as string)?.trim()
    const role     = body.role as UserRole

    if (!email || !password || !name) return json({ error: 'email, password, and name required' }, 400)
    if (!role) return json({ error: 'role required' }, 400)

    const creatableRoles = CREATABLE[callerRole] ?? []
    if (!creatableRoles.includes(role)) return json({ error: 'You cannot create this role' }, 403)

    let uid: string

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      const msg = createErr.message ?? ''
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
        if (listErr) return json({ error: 'Could not look up existing user: ' + listErr.message }, 500)
        const existing = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!existing) return json({ error: 'User exists in Auth but could not be found' }, 500)
        uid = existing.id
        await admin.auth.admin.updateUserById(uid, { password })
      } else {
        return json({ error: 'Create auth user failed: ' + createErr.message }, 400)
      }
    } else {
      uid = newUser.user.id
    }

    let companyScope: string[] | undefined
    try {
      companyScope = parseAllowedCompanies(body.allowed_companies)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Invalid allowed_companies' }, 400)
    }

    const profileRow: Record<string, unknown> = {
      id: uid,
      email,
      name,
      role,
      parent_id: caller.id,
      active: true,
      password_display: password,
    }
    if (companyScope) profileRow.allowed_companies = companyScope

    try {
      const uname = parseUsername(body.username)
      if (uname !== undefined) profileRow.username = uname
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Invalid username' }, 400)
    }

    try {
      const erp = parseAgentErpId(body.agent_erp_id)
      if (erp !== undefined) profileRow.agent_erp_id = erp
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Invalid agent_erp_id' }, 400)
    }

    const { error: upErr } = await admin.from('user_profiles').upsert(profileRow, { onConflict: 'id' })
    if (upErr) return json({ error: 'Profile upsert failed: ' + upErr.message }, 500)

    return json({ success: true, id: uid })
  }

  if (action === 'update') {
    const id = body.id as string
    if (!id) return json({ error: 'id required' }, 400)

    const { data: target, error: tErr } = await admin
      .from('user_profiles')
      .select('id, role, email')
      .eq('id', id)
      .maybeSingle()
    if (tErr || !target) return json({ error: 'User not found' }, 404)

    const targetRole = target.role as UserRole

    const patch: Record<string, unknown> = {}

    const applyNameEmailPassword = async () => {
      const name = (body.name as string | undefined)?.trim()
      const email = (body.email as string | undefined)?.trim()
      const password = body.password as string | undefined

      if (name) patch.name = name
      if (email) {
        patch.email = email
        const { error: eErr } = await admin.auth.admin.updateUserById(id, { email })
        if (eErr) throw new Error('Auth email update: ' + eErr.message)
      }
      if (typeof password === 'string' && password.length > 0) {
        const { error: pErr } = await admin.auth.admin.updateUserById(id, { password })
        if (pErr) throw new Error('Auth password update: ' + pErr.message)
        patch.password_display = password
      }
      if (body.username !== undefined) {
        try {
          const uname = parseUsername(body.username)
          patch.username = uname
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid username')
        }
      }
    }

    if (id === caller.id) {
      if (body.allowed_companies !== undefined && body.allowed_companies !== null) {
        return json({ error: 'Cannot change allowed_companies on your own account here' }, 400)
      }
      try {
        await applyNameEmailPassword()
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Update failed' }, 400)
      }
      if (body.agent_erp_id !== undefined) {
        try {
          patch.agent_erp_id = parseAgentErpId(body.agent_erp_id) ?? null
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : 'Invalid agent_erp_id' }, 400)
        }
      }
      if (Object.keys(patch).length === 0) return json({ error: 'No fields to update' }, 400)
      const { error: upErr } = await admin.from('user_profiles').update(patch).eq('id', id)
      if (upErr) return json({ error: upErr.message }, 500)
      return json({ success: true })
    }

    if (RANK[callerRole] <= RANK[targetRole]) {
      return json({ error: 'Cannot edit this role level' }, 403)
    }
    const managed = await isManagedBy(admin, caller.id, id)
    if (!managed && callerRole !== 'super_admin') {
      return json({ error: 'Not allowed to edit this user' }, 403)
    }

    const active = body.active
    const newRole = body.role as UserRole | undefined

    if (typeof active === 'boolean') patch.active = active

    if (newRole !== undefined) {
      const allowed = CREATABLE[callerRole] ?? []
      if (!allowed.includes(newRole)) return json({ error: 'You cannot assign this role' }, 403)
      if (RANK[newRole] >= RANK[callerRole]) return json({ error: 'Invalid role' }, 403)
      patch.role = newRole
    }

    try {
      await applyNameEmailPassword()
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Update failed' }, 400)
    }

    if (body.allowed_companies !== undefined && body.allowed_companies !== null) {
      try {
        patch.allowed_companies = parseAllowedCompanies(body.allowed_companies)
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Invalid allowed_companies' }, 400)
      }
    }

    if (body.agent_erp_id !== undefined) {
      try {
        patch.agent_erp_id = parseAgentErpId(body.agent_erp_id) ?? null
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Invalid agent_erp_id' }, 400)
      }
    }

    if (Object.keys(patch).length === 0) return json({ error: 'No fields to update' }, 400)

    const { error: upErr } = await admin.from('user_profiles').update(patch).eq('id', id)
    if (upErr) return json({ error: upErr.message }, 500)

    return json({ success: true })
  }

  if (action === 'delete') {
    const id = body.id as string
    if (!id) return json({ error: 'id required' }, 400)
    if (id === caller.id) return json({ error: 'Cannot delete your own account' }, 403)

    const { data: target, error: tErr } = await admin
      .from('user_profiles')
      .select('id, role')
      .eq('id', id)
      .maybeSingle()
    if (tErr || !target) return json({ error: 'User not found' }, 404)

    const targetRole = target.role as UserRole
    if (RANK[callerRole] <= RANK[targetRole]) return json({ error: 'Cannot delete this role level' }, 403)

    const { count, error: cErr } = await admin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id)
    if (cErr) return json({ error: 'Check subordinates failed: ' + cErr.message }, 500)
    if ((count ?? 0) > 0) {
      return json({ error: 'Remove or reassign subordinate users first' }, 400)
    }

    const managed = await isManagedBy(admin, caller.id, id)
    if (!managed && callerRole !== 'super_admin') {
      return json({ error: 'Not allowed to delete this user' }, 403)
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(id)
    if (delErr) return json({ error: 'Auth delete failed: ' + delErr.message }, 500)

    return json({ success: true })
  }

  return json({ error: 'Unknown action: ' + action }, 400)
})
