import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const triggeredBy = (profile?.role === 'super_admin' || profile?.role === 'admin') ? 'admin' : 'agent'

    const syncWebhookUrl = Deno.env.get('SYNC_WEBHOOK_URL')
    const syncWebhookSecret = Deno.env.get('SYNC_WEBHOOK_SECRET')
    if (syncWebhookUrl) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (syncWebhookSecret) headers['X-Sync-Secret'] = syncWebhookSecret

      const syncRes = await fetch(syncWebhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ triggered_by: triggeredBy, user_id: user.id }),
      })

      const syncResult = await syncRes.json().catch(() => ({}))
      return new Response(JSON.stringify({ success: syncRes.ok, ...syncResult }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: latestLog } = await supabase
      .from('sync_logs')
      .select('id, started_at, finished_at, status, rows_updated')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    return new Response(JSON.stringify({
      success: true,
      message: 'Sync webhook not configured. Sync runs automatically via scheduled task.',
      last_sync: latestLog ?? null,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
