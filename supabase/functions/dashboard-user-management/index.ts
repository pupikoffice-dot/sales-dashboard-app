import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser()
  if (authErr || !caller) return json({ error: 'Auth failed' }, 401)

  const gate = await requireSuperAdmin(callerClient)
  if (!gate.ok) return gate.response

  const admin = createClient(supabaseUrl, serviceRoleKey)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* empty */ }
  const action = body.action as string

  if (action === 'create') {
    const email = (body.email as string)?.trim()
    const password = body.password as string
    const name = (body.name as string)?.trim() || email.split('@')[0]
    const role = (body.role as string) || 'viewer'
    if (!email || !password) return json({ error: 'email and password required' }, 400)

    let uid: string

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (createErr) {
      if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
        if (listErr) return json({ error: 'Could not look up existing user: ' + listErr.message }, 500)
        const existing = users.find(u => u.email === email)
        if (!existing) return json({ error: 'User exists in Auth but could not be found' }, 500)
        uid = existing.id
        await admin.auth.admin.updateUserById(uid, { password, user_metadata: { name, role } })
      } else {
        return json({ error: 'Create auth user failed: ' + createErr.message }, 400)
      }
    } else {
      uid = newUser.user.id
    }

    await admin.from('user_profiles').upsert({
      id: uid,
      email,
      name,
      role,
      active: true,
      password_display: password,
    }, { onConflict: 'id' })

    await admin.from('dashboard_user_access').upsert({
      user_id: uid,
      modules: ['oversite'],
      companies: ['pupik'],
      agents: null,
      default_module: 'oversite',
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

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
