import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const USERNAME_AUTH_DOMAIN = 'dashboard.local'
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i
/** This Supabase project uses user_role (not dashboard_user_role). */
const VALID_ROLES = ['super_admin', 'admin', 'cco', 'manager', 'agent'] as const

function normalizeRole(role?: string): string {
  if (!role || role === 'viewer') return 'agent'
  if ((VALID_ROLES as readonly string[]).includes(role)) return role
  return 'agent'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function parseLoginInput(raw: string, displayName?: string) {
  const login = raw.trim()
  if (!login) return { error: 'login required' as const }

  if (login.includes('@')) {
    const email = login.toLowerCase()
    const name = displayName?.trim() || email.split('@')[0]
    return { email, username: null as string | null, name }
  }

  const username = normalizeUsername(login)
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 2–32 characters: letters, numbers, . _ -' as const }
  }

  const email = `${username}@${USERNAME_AUTH_DOMAIN}`
  const name = displayName?.trim() || username
  return { email, username, name }
}

async function requireSuperAdmin(callerClient: ReturnType<typeof createClient>) {
  const { data: isSuper, error } = await callerClient.rpc('is_super_admin')
  if (error) return { ok: false as const, response: json({ error: 'Permission check failed: ' + error.message }, 500) }
  if (!isSuper) return { ok: false as const, response: json({ error: 'Super admin only' }, 403) }
  return { ok: true as const }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'No auth header' }, 401)

  const jwt = authHeader.slice(7)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser(jwt)
  if (authErr || !caller) {
    return json({ error: authErr?.message ? `Auth failed: ${authErr.message}` : 'Auth failed' }, 401)
  }

  const gate = await requireSuperAdmin(callerClient)
  if (!gate.ok) return gate.response

  const admin = createClient(supabaseUrl, serviceRoleKey)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* empty */ }
  const action = body.action as string

  if (action === 'list') {
    const { data: profiles, error: profilesErr } = await admin
      .from('user_profiles')
      .select('id,email,username,name,role,active,password_display')
      .order('name')
    if (profilesErr) return json({ error: 'List profiles failed: ' + profilesErr.message }, 500)

    const { data: accessRows, error: accessErr } = await admin
      .from('dashboard_user_access')
      .select('user_id,modules,companies,agents,default_module,locale,active')
    if (accessErr) return json({ error: 'List access failed: ' + accessErr.message }, 500)

    return json({ users: profiles ?? [], access: accessRows ?? [] })
  }

  if (action === 'create') {
    const rawLogin = ((body.login ?? body.email) as string) ?? ''
    const password = body.password as string
    const role = normalizeRole(body.role as string | undefined)
    if (!password) return json({ error: 'password required' }, 400)

    const parsed = parseLoginInput(rawLogin, body.name as string | undefined)
    if ('error' in parsed) return json({ error: parsed.error }, 400)

    const { email, username, name } = parsed

    if (username) {
      const { data: dup } = await admin.from('user_profiles').select('id').ilike('username', username).maybeSingle()
      if (dup) return json({ error: `Username "${username}" is already taken` }, 400)
    } else {
      const { data: dup } = await admin.from('user_profiles').select('id').ilike('email', email).maybeSingle()
      if (dup) return json({ error: `Email "${email}" is already registered` }, 400)
    }

    let uid: string

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, ...(username ? { username } : {}) },
    })

    if (createErr) {
      if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
        if (listErr) return json({ error: 'Could not look up existing user: ' + listErr.message }, 500)
        const existing = users.find(u => u.email?.toLowerCase() === email)
        if (!existing) return json({ error: 'User exists in Auth but could not be found' }, 500)
        uid = existing.id
        await admin.auth.admin.updateUserById(uid, { password, user_metadata: { name, role, ...(username ? { username } : {}) } })
      } else {
        return json({ error: 'Create auth user failed: ' + createErr.message }, 400)
      }
    } else {
      uid = newUser.user.id
    }

    const { error: profileErr } = await admin.from('user_profiles').upsert({
      id: uid,
      email,
      username,
      name,
      role,
      active: true,
      password_display: password,
    }, { onConflict: 'id' })
    if (profileErr) return json({ error: 'Profile save failed: ' + profileErr.message }, 500)

    const { error: accessErr } = await admin.from('dashboard_user_access').upsert({
      user_id: uid,
      modules: ['oversite'],
      companies: ['pupik'],
      agents: null,
      default_module: 'oversite',
      locale: 'en',
      active: true,
      show_item_cost: false,
      show_client_profit: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (accessErr) return json({ error: 'Access save failed: ' + accessErr.message }, 500)

    return json({ success: true, id: uid })
  }

  if (action === 'delete') {
    const id = body.id as string
    if (!id) return json({ error: 'id required' }, 400)
    if (id === caller.id) return json({ error: 'Cannot delete your own account' }, 403)

    const { data: target } = await admin.from('user_profiles').select('role').eq('id', id).maybeSingle()
    if (target?.role === 'super_admin') return json({ error: 'Cannot delete another super admin' }, 403)

    const { error: delErr } = await admin.auth.admin.deleteUser(id)
    if (delErr) return json({ error: 'Delete failed: ' + delErr.message }, 500)
    return json({ success: true })
  }

  if (action === 'update-password') {
    const id = body.id as string
    const password = body.password as string
    if (!id || !password) return json({ error: 'id and password required' }, 400)

    const { error: authUpdateErr } = await admin.auth.admin.updateUserById(id, { password })
    if (authUpdateErr) return json({ error: 'Password update failed: ' + authUpdateErr.message }, 500)

    const { error: profileErr } = await admin
      .from('user_profiles')
      .update({ password_display: password })
      .eq('id', id)
    if (profileErr) return json({ error: 'Profile update failed: ' + profileErr.message }, 500)

    return json({ success: true })
  }

  return json({ error: 'Unknown action: ' + action }, 400)
})
