import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  message: string
  history: ChatMessage[]
  client_id?: string
  /** pupik | mt | grow — disambiguates sales_lines + clients when same erp_client_id exists per company */
  client_company?: string
  voice_mode?: boolean
}

const SALES_PAGE_SIZE = 1000
/** Max lines loaded from DB per client (pagination); avoids missing data vs a low LIMIT. */
const MAX_SALES_LINES_FETCH = 50000
/** Max lines injected into the model prompt (most recent first); full history beyond this is summarized. */
const MAX_SALES_LINES_IN_PROMPT = 8000

type SB = ReturnType<typeof createClient>

/**
 * Collapse exact duplicate sales_lines rows (same client, document, SKU, qty, amount).
 * Re-syncs sometimes append the same ERP line multiple times; without this, the model sees
 * 5× identical lines and reports 5 pcs instead of 1.
 */
function dedupeIdenticalSalesLineRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    const key = [
      r.client_id ?? '',
      r.company ?? '',
      r.doc_num ?? '',
      String(r.line_date ?? ''),
      r.doc_type ?? '',
      r.item_sku ?? '',
      String(r.qty ?? ''),
      String(r.cash ?? ''),
      String(r.item_name ?? ''),
    ].join('\x1e')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/** Paginate sales_lines for one client (newest first). Optionally filter by company (must match ERP sync). */
async function fetchAllSalesLinesForClient(
  supabase: SB,
  opts: {
    client_id: string
    company: string | null | undefined
    excludeOpenOrders: boolean
    /** If true and company set, retry without company when no rows */
    fallbackWithoutCompany: boolean
  },
): Promise<{ rows: Record<string, any>[]; totalInDb: number; promptTruncated: boolean }> {
  const select =
    'line_date, doc_num, doc_type, item_name, item_sku, qty, inner_carton_qty, cash, discount_pct, brand, supplier, company'
  async function pull(withCompany: string | null | undefined): Promise<Record<string, any>[]> {
    const all: Record<string, any>[] = []
    let from = 0
    while (from < MAX_SALES_LINES_FETCH) {
      let q = supabase
        .from('sales_lines')
        .select(select)
        .eq('client_id', opts.client_id)
        .order('line_date', { ascending: false })
        .range(from, from + SALES_PAGE_SIZE - 1)
      if (opts.excludeOpenOrders) {
        q = q.not('doc_type', 'in', '("open_order","open_delivery")')
      }
      if (withCompany) {
        q = q.eq('company', withCompany)
      }
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      all.push(...(data as Record<string, any>[]))
      if (data.length < SALES_PAGE_SIZE) break
      from += SALES_PAGE_SIZE
    }
    return all
  }

  let rows = await pull(opts.company ?? null)
  if (!rows.length && opts.company && opts.fallbackWithoutCompany) {
    rows = await pull(null)
  }

  rows = dedupeIdenticalSalesLineRows(rows as Record<string, unknown>[]) as Record<string, any>[]

  const totalInDb = rows.length
  let promptTruncated = false
  if (rows.length > MAX_SALES_LINES_IN_PROMPT) {
    promptTruncated = true
    rows = rows.slice(0, MAX_SALES_LINES_IN_PROMPT)
  }
  return { rows, totalInDb, promptTruncated }
}

const GLOBAL_MY_SALES_MAX = 3000

/** Paginated "my recent sales" for general chat (replaces a single .limit(500)). */
async function fetchGlobalRecentSalesForAgent(
  supabase: SB,
  opts: { isAdmin: boolean; agentErpIds: string[]; profileName: string },
): Promise<Record<string, any>[]> {
  const select = 'line_date, client_id, client_name, doc_num, doc_type, item_name, item_sku, qty, cash'
  const all: Record<string, any>[] = []
  let from = 0
  while (from < GLOBAL_MY_SALES_MAX) {
    let q = supabase
      .from('sales_lines')
      .select(select)
      .not('doc_type', 'in', '("open_order","open_delivery")')
      .order('line_date', { ascending: false })
      .range(from, from + SALES_PAGE_SIZE - 1)
    q = opts.isAdmin
      ? q.in('agent_erp_id', opts.agentErpIds)
      : q.eq('agent_erp_id', opts.profileName)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as Record<string, any>[]))
    if (data.length < SALES_PAGE_SIZE) break
    from += SALES_PAGE_SIZE
  }
  return dedupeIdenticalSalesLineRows(all as Record<string, unknown>[]) as Record<string, any>[]
}

/** Words to ignore when guessing client names from a free-text question (general chat). */
const CLIENT_NAME_STOP = new Set([
  'מה', 'איך', 'מתי', 'איפה', 'יש', 'אין', 'של', 'על', 'את', 'זה', 'זו', 'כל', 'עם', 'גם',
  'הלקוח', 'לקוח', 'לקוחות', 'כתובת', 'כתובות', 'מידע', 'תן', 'תגיד', 'בבקשה', 'שם', 'עבור', 'למי',
  'הקניה', 'קניה', 'הקנייה', 'קנייה', 'האחרונה', 'אחרונה', 'רכישה', 'הרכישה', 'מוצר', 'המוצר', 'פריט',
  'היתה', 'היה', 'למה', 'כמה',
  'the', 'what', 'is', 'a', 'an', 'for', 'client', 'address', 'customers', 'customer', 'tell', 'me',
  'last', 'purchase', 'product', 'item', 'buy', 'bought',
])

function tokensForClientNameSearch(text: string): string[] {
  const raw = text.match(/[\u0590-\u05FFa-zA-Z][\u0590-\u05FFa-zA-Z0-9\-'"]*/g) ?? []
  const out: string[] = []
  for (const t of raw) {
    const w = t.replace(/^["']|["']$/g, '').trim()
    if (w.length < 2 || w.length > 48) continue
    const lower = w.toLowerCase()
    if (CLIENT_NAME_STOP.has(w) || CLIENT_NAME_STOP.has(lower)) continue
    out.push(w)
  }
  return [...new Set(out)].slice(0, 8)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // PATCH /chat  { log_id, rating: 1 | -1 }  — rate a previous response
  if (req.method === 'PATCH') {
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
      const { data: { user } } = await supabase.auth.getUser(jwt)
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
      const { log_id, rating } = await req.json()
      if (!log_id || ![1, -1].includes(rating)) return new Response(JSON.stringify({ error: 'Invalid' }), { status: 400, headers: CORS })
      await supabase.from('query_logs').update({ rating }).eq('id', log_id).eq('agent_id', user.id)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
    }
  }

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
      .select('id, role, name')
      .eq('id', user.id)
      .single()

    if (!profile) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 403, headers: CORS })

    const { data: deviceCheck } = await supabase
      .from('agent_devices')
      .select('revoked')
      .eq('agent_id', user.id)
      .eq('revoked', true)
      .limit(1)

    if (deviceCheck && deviceCheck.length > 0) {
      return new Response(JSON.stringify({ error: 'Device revoked. Contact your administrator.' }), { status: 403, headers: CORS })
    }

    const { message, history = [], client_id, client_company, voice_mode = false }: ChatRequest = await req.json()

    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['ai_provider', 'ai_model', 'queries_per_agent_limit'])

    const cfg = Object.fromEntries((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
    const provider = cfg['ai_provider'] ?? 'gemini'
    const modelRaw = cfg['ai_model'] ?? 'gemini-2.5-flash'
    const model    = provider === 'gemini' ? mapLegacyGeminiModel(modelRaw) : modelRaw
    const limit    = parseInt(cfg['queries_per_agent_limit'] ?? '500', 10)

    const thisMonth = new Date()
    const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString()
    const { count: queryCount } = await supabase
      .from('query_logs')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', user.id)
      .gte('created_at', monthStart)

    if ((queryCount ?? 0) >= limit) {
      return new Response(JSON.stringify({ error: 'Monthly query limit reached. Contact your manager.' }), { status: 429, headers: CORS })
    }

    const contextParts: string[] = []

    if (client_id) {
      // ── CLIENT INFO ────────────────────────────────────────────────────────
      let client: Record<string, unknown> | null = null
      if (client_company) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('erp_client_id', client_id)
          .eq('company', client_company)
          .maybeSingle()
        client = data
      }
      if (!client) {
        const { data } = await supabase.from('clients').select('*').eq('erp_client_id', client_id).limit(1)
        client = (data?.[0] as Record<string, unknown>) ?? null
      }

      if (client) {
        const c = client as Record<string, unknown>
        const addrCity = [c.address, c.city].filter(Boolean).join(', ')
        const regionStr = typeof c.region === 'string' ? c.region.trim() : ''
        let locationPara: string
        if (addrCity) {
          locationPara =
            `Address & city: ${addrCity}` +
            (regionStr && !addrCity.includes(regionStr) ? `\nRegion (אזור): ${regionStr}` : '')
        } else if (regionStr) {
          locationPara = `Location (ERP region / אזור — no separate street/city in DB yet): ${regionStr}`
        } else {
          locationPara =
            'Address/city/region: not in database. Run sync from acc101 client export (or refresh clients) to load addresses.'
        }
        contextParts.push(
          `CLIENT INFO:\nName: ${client.name}\nClient #: ${client_id}\nPhone: ${client.phone ?? 'N/A'}\n` +
            `${locationPara}\nCompany: ${client.company}`
        )
      }

      // ── RECENT INVOICES (891 / rep891 files) ──────────────────────────────
      // Each row = one item line in an invoice. cash = net total for that line (VAT-excl).
      // Filter by company when known — sales_lines.company must match ERP company or rows are missing.
      // Paginate so we are not limited to 200 rows; prompt cap is MAX_SALES_LINES_IN_PROMPT.
      const salesCompany =
        client_company ??
        (client && typeof (client as Record<string, unknown>).company === 'string'
          ? ((client as Record<string, unknown>).company as string)
          : null)
      const {
        rows: recentSales,
        totalInDb: salesTotalFetched,
        promptTruncated: salesPromptTruncated,
      } = await fetchAllSalesLinesForClient(supabase, {
        client_id,
        company: salesCompany,
        excludeOpenOrders: true,
        fallbackWithoutCompany: true,
      })

      if (recentSales && recentSales.length > 0) {
        const invoiceMap = new Map<string, { date: string; doc_type: string; lines: typeof recentSales; total: number }>()
        for (const s of recentSales as Record<string, any>[]) {
          // Group by doc_num when available; fall back to line_date so "last invoice" still works even when doc_num is null
          const key = s.doc_num ? `${s.doc_num}|${s.doc_type}|${s.line_date}` : `date:${s.line_date}`
          if (!invoiceMap.has(key)) invoiceMap.set(key, { date: s.line_date, doc_type: s.doc_type, lines: [], total: 0 })
          const inv = invoiceMap.get(key)!
          inv.lines.push(s)
          inv.total += Number(s.cash ?? 0)
        }
        const invoices = [...invoiceMap.entries()].slice(0, 30)
        const salesText = invoices.map(([key, inv]) => {
          const docNum = key.startsWith('date:') ? null : key.split('|')[0]
          const header = `Invoice ${docNum ?? '(grouped by date)'} | ${inv.date} | type:${inv.doc_type ?? 'invoice'} | total:₪${inv.total.toFixed(2)}`
          const lines = (inv.lines as Record<string, any>[]).map(l => {
            const unitPrice = l.qty && l.qty > 0 ? (Number(l.cash) / Number(l.qty)).toFixed(2) : (l.inner_carton_qty && l.inner_carton_qty > 0 ? (Number(l.cash) / Number(l.inner_carton_qty)).toFixed(2) + '~' : '—')
            const disc = l.discount_pct ? ` | discount:${l.discount_pct}%` : ''
            const carton = l.inner_carton_qty ? ` | carton:${l.inner_carton_qty}` : ''
            return `  - ${l.item_name} (${l.item_sku}) | qty:${l.qty}${carton} | unit_price:₪${unitPrice} | line_total:₪${l.cash}${disc}`
          }).join('\n')
          return `${header}\n${lines}`
        }).join('\n\n')
        const truncNote = salesPromptTruncated
          ? `\n(Note: ${salesTotalFetched} lines exist for this client; only the ${recentSales.length} most recent lines are shown here for the model.)`
          : ''
        contextParts.push(
          `RECENT INVOICES — last ${invoices.length} documents, ${recentSales.length} lines loaded (amounts VAT-exclusive):${truncNote}\n${salesText}`,
        )
      } else {
        contextParts.push(`RECENT INVOICES: No invoice history found for this client (check client_id + company match in sales_lines).`)
      }

      // ── OPEN ORDERS (721 files) ────────────────────────────────────────────
      // Items the client ordered but not yet delivered/invoiced.
      let openQ = supabase
        .from('sales_lines')
        .select('line_date, doc_num, item_name, item_sku, qty, cash')
        .eq('client_id', client_id)
        .in('doc_type', ['open_order', 'open_delivery'])
        .order('line_date', { ascending: false })
        .limit(200)
      if (salesCompany) {
        openQ = openQ.eq('company', salesCompany)
      }
      const { data: openOrders } = await openQ

      if (openOrders && openOrders.length > 0) {
        const ordersText = (openOrders as Record<string, any>[]).map(s =>
          `${s.line_date} | doc:${s.doc_num} | ${s.item_name} (${s.item_sku}) | qty:${s.qty} | ₪${s.cash}`
        ).join('\n')
        contextParts.push(`OPEN ORDERS / PENDING DELIVERIES (not yet invoiced):\n${ordersText}`)
      } else {
        contextParts.push(`OPEN ORDERS: No open orders for this client.`)
      }

      // ── DEBT / AGING (debt files) ──────────────────────────────────────────
      // Each row = one monthly aging bucket. Amounts are VAT-INCLUSIVE (÷1.18 for net).
      const { data: debtRows } = await supabase
        .from('client_debt_lines')
        .select('bucket_date, amount, note, company')
        .eq('erp_client_id', client_id)
        .order('bucket_date', { ascending: false })
        .limit(24)

      if (debtRows && debtRows.length > 0) {
        const totalDebt = (debtRows as Record<string, any>[]).reduce((s, d) => s + Number(d.amount ?? 0), 0)
        const totalNet = (totalDebt / 1.18).toFixed(2)
        const debtText = (debtRows as Record<string, any>[]).map(d =>
          `${d.bucket_date ?? '—'} | ₪${Number(d.amount ?? 0).toFixed(2)} incl. VAT (÷1.18=₪${(Number(d.amount ?? 0)/1.18).toFixed(2)} net)${d.note ? ' | note: ' + d.note : ''}`
        ).join('\n')
        contextParts.push(`OPEN DEBT (from debt aging report — amounts VAT-inclusive):\nTotal owed: ₪${totalDebt.toFixed(2)} incl. VAT = ₪${totalNet} net\n${debtText}`)
      } else {
        contextParts.push(`OPEN DEBT: No open debt recorded for this client.`)
      }

      // ── PAYMENT RECEIPTS (collect008 files) ───────────────────────────────
      // Collection receipts — what the client has paid. Amounts VAT-inclusive (÷1.18 for net).
      const { data: receipts } = await supabase
        .from('client_payment_receipts')
        .select('receipt_issued_date, payment_due_date, receipt_num, amount_paid')
        .eq('erp_client_id', client_id)
        .order('receipt_issued_date', { ascending: false })
        .limit(12)

      if (receipts && receipts.length > 0) {
        const receiptsText = (receipts as Record<string, any>[]).map(r =>
          `${r.receipt_issued_date ?? '—'} | receipt#:${r.receipt_num ?? '—'} | paid:₪${Number(r.amount_paid ?? 0).toFixed(2)} incl. VAT (÷1.18=₪${(Number(r.amount_paid ?? 0)/1.18).toFixed(2)} net) | due:${r.payment_due_date ?? '—'}`
        ).join('\n')
        contextParts.push(`PAYMENT HISTORY (collection receipts — amounts VAT-inclusive):\n${receiptsText}`)
      }

      // ── STOCK LEVELS for items this client buys (000 files) ───────────────
      // Cross-reference: find SKUs this client has bought, then check current stock.
      if (recentSales && recentSales.length > 0) {
        const clientSkus = [...new Set((recentSales as Record<string, any>[]).map(s => s.item_sku).filter(Boolean))].slice(0, 30)
        const { data: stockRows } = await supabase
          .from('inventory')
          .select('sku, name, qty_on_hand')
          .in('sku', clientSkus)

        if (stockRows && stockRows.length > 0) {
          const stockText = (stockRows as Record<string, any>[]).map(s =>
            `${s.sku} | ${s.name} | stock:${s.qty_on_hand ?? 0}`
          ).join('\n')
          contextParts.push(`CURRENT STOCK LEVELS (for items this client buys):\n${stockText}`)
        }

        // ── PRICE LIST for items this client buys (rep907 files) ──────────
        // list_price = P01 customer pricelist price (VAT-exclusive). Compare to unit_price in invoices to see discount.
        const { data: priceRows } = await supabase
          .from('item_pricing')
          .select('sku, list_price')
          .in('sku', clientSkus)

        if (priceRows && priceRows.length > 0) {
          const priceText = (priceRows as Record<string, any>[]).map(p =>
            `${p.sku} | list_price:₪${p.list_price ?? '—'}`
          ).join('\n')
          contextParts.push(`PRICELIST (P01 standard price, VAT-exclusive — compare to unit_price in invoices to see actual discount given):\n${priceText}`)
        }
      }

    } else {
      // ── GENERAL CHAT — agent overview ─────────────────────────────────────
      const isAdmin = profile.role === 'manager' || profile.role === 'admin' || profile.role === 'super_admin'
      let agentIds: string[] = [user.id]
      let agentErpIds: string[] = [profile.name]

      if (isAdmin) {
        const { data: subtreeIds } = await supabase.rpc('get_subtree_agent_ids', { p_user_id: user.id })
        if (subtreeIds) agentIds = subtreeIds

        // For admins, get all agent ERP IDs to filter sales/debt tables correctly
        const { data: agentProfiles } = await supabase
          .from('user_profiles')
          .select('name')
          .in('role', ['agent', 'manager'])
          .not('name', 'is', null)
        agentErpIds = (agentProfiles ?? []).map((p: { name: string }) => p.name).filter(Boolean)
      }

      // Client list with stats
      const clientsQuery = supabase
        .from('clients')
        .select(`id, erp_client_id, name, company, phone, address, city, region,
          client_stats ( monthly_sales, total_debt, last_order_date )`)
        .eq('active', true)
        .order('name')
        .limit(500)

      const { data: myClients } = isAdmin
        ? await clientsQuery
        : await clientsQuery.in('assigned_agent_id', agentIds)

      if (myClients && myClients.length > 0) {
        const clientList = (myClients as Record<string, any>[]).map(c => {
          const stats = c.client_stats as Record<string, any> | null
          const sales = stats?.monthly_sales ? `sales this month:₪${Number(stats.monthly_sales).toFixed(0)}` : 'no sales this month'
          const debt = stats?.total_debt && Number(stats.total_debt) > 0 ? ` | debt:₪${Number(stats.total_debt).toFixed(0)}` : ''
          const lastOrder = stats?.last_order_date ? ` | last order:${stats.last_order_date}` : ''
          const location =
            [c.address, c.city].filter(Boolean).join(', ') ||
            (typeof c.region === 'string' && c.region.trim() ? c.region.trim() : '')
          const loc = location ? ` | ${location}` : ''
          return `${c.name} (${c.erp_client_id}) — ${c.company} | ${sales}${debt}${lastOrder}${loc}`
        }).join('\n')
        contextParts.push(`MY CLIENTS (${myClients.length} total, capped at 500 by name — location may appear after the last " | "):\n${clientList}`)
      }

      // General chat: user often asks "what is X client's address?" without selecting client context.
      // MY CLIENTS may omit clients beyond the cap or bury location; search name by tokens from the question.
      const nameTokens = tokensForClientNameSearch(message)
      if (nameTokens.length > 0) {
        const orParts = nameTokens.map((t) => {
          const safe = t.replace(/%/g, '').replace(/,/g, '')
          return `name.ilike.%${safe}%`
        })
        let nameHitQ = supabase
          .from('clients')
          .select('erp_client_id, name, company, phone, address, city, region')
          .eq('active', true)
          .or(orParts.join(','))
          .limit(30)
        if (!isAdmin) nameHitQ = nameHitQ.in('assigned_agent_id', agentIds)
        const { data: nameHits } = await nameHitQ
        if (nameHits && nameHits.length > 0) {
          const lines = (nameHits as Record<string, unknown>[]).map((c) => {
            const addrCity = [c.address, c.city].filter(Boolean).join(', ')
            const regionStr = typeof c.region === 'string' ? c.region.trim() : ''
            let loc: string
            if (addrCity) {
              loc = `Address & city: ${addrCity}` + (regionStr && !addrCity.includes(regionStr) ? ` | Region: ${regionStr}` : '')
            } else if (regionStr) {
              loc = `Location (region / אזור): ${regionStr}`
            } else {
              loc = 'No street/city/region in database for this client — run acc101 client sync.'
            }
            return `${c.name} (${c.erp_client_id}) — ${c.company} | ${loc} | phone:${c.phone ?? '—'}`
          })
          contextParts.push(
            `CLIENTS MATCHING WORDS IN THE QUESTION (use this for address / location — especially in general chat):\n${lines.join('\n')}`,
          )

          // MY RECENT SALES below is only the last 500 lines globally — a client may have no lines there.
          // Pull invoice lines for matched client IDs so "last purchase" / items questions work in general chat.
          const erpIds = (nameHits as { erp_client_id: string }[])
            .map((c) => c.erp_client_id)
            .filter((id): id is string => Boolean(id))
          if (erpIds.length > 0) {
            const baseSelect =
              'line_date, client_id, client_name, doc_num, doc_type, item_name, item_sku, qty, cash, agent_erp_id'
            const formatMatchedSales = (rows: Record<string, any>[]) =>
              rows
                .map((s) => {
                  const unitPrice =
                    s.qty && Number(s.qty) > 0
                      ? (Number(s.cash) / Number(s.qty)).toFixed(2)
                      : '—'
                  return `${s.line_date} | ${s.client_name ?? s.client_id} | doc:${s.doc_num ?? '—'} | ${s.item_name} (${s.item_sku}) | qty:${s.qty} | unit:₪${unitPrice} | line:₪${s.cash}`
                })
                .join('\n')

            let salesForMatched = supabase
              .from('sales_lines')
              .select(baseSelect)
              .in('client_id', erpIds)
              .not('doc_type', 'in', '("open_order","open_delivery")')
              .order('line_date', { ascending: false })
              .limit(150)

            if (isAdmin) {
              salesForMatched = salesForMatched.in('agent_erp_id', agentErpIds)
            } else {
              salesForMatched = salesForMatched.eq('agent_erp_id', profile.name)
            }

            let { data: matchedSales } = await salesForMatched

            if ((!matchedSales || matchedSales.length === 0) && isAdmin && profile.role === 'super_admin') {
              const { data: fallbackSales } = await supabase
                .from('sales_lines')
                .select(baseSelect)
                .in('client_id', erpIds)
                .not('doc_type', 'in', '("open_order","open_delivery")')
                .order('line_date', { ascending: false })
                .limit(150)
              matchedSales = fallbackSales
            }

            if (matchedSales && matchedSales.length > 0) {
              const matchedDeduped = dedupeIdenticalSalesLineRows(matchedSales as Record<string, unknown>[]) as Record<
                string,
                any
              >[]
              contextParts.push(
                `RECENT INVOICE LINES FOR CLIENT(S) MATCHING YOUR QUESTION (most recent first — use for "last purchase", "last product", pricing; amounts VAT-exclusive):\n${formatMatchedSales(matchedDeduped)}`,
              )
            }
          }
        }
      }

      // Clients with open debt
      const debtQuery = supabase
        .from('client_debt_lines')
        .select('erp_client_id, client_name, amount')

      const { data: debtSummary } = isAdmin
        ? await debtQuery.in('agent_erp_id', agentErpIds)
        : await debtQuery.eq('agent_erp_id', profile.name)

      if (debtSummary && debtSummary.length > 0) {
        const debtByClient = new Map<string, { name: string; total: number }>()
        for (const d of debtSummary as Record<string, any>[]) {
          if (!debtByClient.has(d.erp_client_id)) debtByClient.set(d.erp_client_id, { name: d.client_name, total: 0 })
          debtByClient.get(d.erp_client_id)!.total += Number(d.amount ?? 0)
        }
        const debtText = [...debtByClient.entries()]
          .filter(([, v]) => v.total > 0)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([id, v]) => `${v.name} (${id}) | ₪${v.total.toFixed(2)} incl. VAT = ₪${(v.total/1.18).toFixed(2)} net`)
          .join('\n')
        if (debtText) contextParts.push(`CLIENTS WITH OPEN DEBT (amounts VAT-inclusive):\n${debtText}`)
      }

      // Recent sales — paginated up to GLOBAL_MY_SALES_MAX (was a single .limit(500))
      const recentSales = await fetchGlobalRecentSalesForAgent(supabase, {
        isAdmin,
        agentErpIds,
        profileName: profile.name,
      })

      if (recentSales && recentSales.length > 0) {
        const salesText = (recentSales as Record<string, any>[]).map(s => {
          const unitPrice = s.qty && s.qty > 0 ? (Number(s.cash) / Number(s.qty)).toFixed(2) : '—'
          return `${s.line_date} | ${s.client_name ?? s.client_id} | doc:${s.doc_num} | ${s.item_name} (${s.item_sku}) | qty:${s.qty} | unit:₪${unitPrice} | total:₪${s.cash}`
        }).join('\n')
        contextParts.push(
          `MY RECENT SALES (up to ${GLOBAL_MY_SALES_MAX} most recent lines across all clients for this scope):\n${salesText}`,
        )
      }

      // Stock snapshot
      const { data: stockRows } = await supabase
        .from('inventory')
        .select('sku, name, qty_on_hand')
        .gt('qty_on_hand', 0)
        .order('qty_on_hand', { ascending: false })
        .limit(100)

      if (stockRows && stockRows.length > 0) {
        const stockText = (stockRows as Record<string, any>[]).map(s =>
          `${s.sku} | ${s.name} | qty:${s.qty_on_hand}`
        ).join('\n')
        contextParts.push(`CURRENT WAREHOUSE STOCK (items with qty > 0):\n${stockText}`)
      }
    }

    const systemPrompt = buildSystemPrompt(profile.name, contextParts, voice_mode)

    let replyText: string
    if (provider === 'gemini') {
      replyText = await callGemini(model, systemPrompt, history, message)
    } else if (provider === 'claude') {
      replyText = await callClaude(model, systemPrompt, history, message)
    } else if (provider === 'openai') {
      replyText = await callOpenAI(model, systemPrompt, history, message)
    } else {
      replyText = await callGemini('gemini-2.5-flash', systemPrompt, history, message)
    }

    const { data: logRow } = await supabase.from('query_logs').insert({
      agent_id: user.id,
      provider,
      model,
      message,
      reply: replyText,
      client_id: client_id ?? null,
      voice_mode,
    }).select('id').single()

    return new Response(JSON.stringify({ reply: replyText, log_id: logRow?.id ?? null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})

function buildSystemPrompt(agentName: string, contextParts: string[], voiceMode = false): string {
  const voiceRules = voiceMode ? `
VOICE MODE — CRITICAL:
You are being read aloud by text-to-speech. Use plain spoken words and numbers ONLY.
- No markdown: no *, **, #, |, -, bullet points, or table formatting
- No special characters: no currency symbols (write "shekel" or just the number), no colons used as separators, no slashes
- No abbreviations that sound wrong when spoken: write "quantity 3" not "qty:3", "document number" not "doc_num"
- Write numbers as words when natural: "twenty five" for quantities, plain digits for prices and IDs
- Use short natural sentences. One fact per sentence. No lists.
- Example good response: "The last invoice was from March 10th. The client bought 3 units of the Vtech Hebrew toy at 45 shekel each. Total was 135 shekel."
- Example bad response: "| item | qty | price | ..."
` : ''

  const rules = `You are a sales assistant for field sales agent: ${agentName}.
${voiceRules}

DATA SOURCES EXPLAINED:
- RECENT INVOICES: Sales history from ERP invoices (rep891 files). One row per item per invoice. Amounts are VAT-EXCLUSIVE net amounts.
- OPEN ORDERS: Items the client ordered but not yet delivered or invoiced (721 files). Shows what is pending.
- OPEN DEBT: Aging report showing how much each client owes per month bucket (debt files). Amounts are VAT-INCLUSIVE — divide by 1.18 to get net amount excluding VAT.
- PAYMENT HISTORY: Collection receipts — actual payments the client has made (collect008 files). Amounts are VAT-INCLUSIVE — divide by 1.18 for net.
- CURRENT STOCK LEVELS: Warehouse snapshot of available inventory (000 files). qty_on_hand = units available right now.
- PRICELIST: Standard customer list prices from rep907 (P01 price, VAT-exclusive). Compare with unit_price in invoices to see the actual discount given to a client.
- MY CLIENTS: All clients assigned to this agent with monthly sales, debt, last order date, and optional location at the end of each line.
- CLIENTS MATCHING WORDS IN THE QUESTION: When present, lists clients whose name matches words from the user's message — includes full address/city/region fields. Use this for "what is the address of client X?" in general chat (no client selected).
- RECENT INVOICE LINES FOR CLIENT(S) MATCHING YOUR QUESTION: In general chat, this is the authoritative source for that client's purchases (last invoice, last product, prices). MY RECENT SALES is only the latest 500 lines across all clients and may omit a given client entirely.

FORMATTING RULES — CRITICAL:
- RECENT INVOICES data is deduplicated server-side: each row is a distinct ERP line. Do not duplicate rows in your table and do not infer higher quantities than shown in qty / line_total.
- Whenever the answer contains multiple data rows, numbers, or a comparison — ALWAYS format as a markdown table with | column | headers |.
- ALWAYS use the FULL item name exactly as it appears in the data — never shorten, abbreviate, or truncate product names.
- When showing invoice details: ALWAYS include a table with columns: מס׳ שורה | שם פריט | מק״ט | כמות | מחיר יחידה | סה״כ שורה.
- When showing invoice headers: include doc_num (מספר מסמך), date, and total.

PRICING RULES — HOW TO ANSWER "WHAT WAS THE LAST PRICE THE CLIENT PAID FOR [ITEM]?":
STEP 1: Look through ALL lines in RECENT INVOICES for this client.
STEP 2: Filter to lines where item_name or item_sku matches the requested item (partial/fuzzy match is fine).
STEP 3: Ignore any lines where cash ≤ 0 or qty ≤ 0 (those are returns/credit notes — never use them for pricing).
STEP 4: From the remaining matching lines, pick the one with the most recent line_date.
STEP 5: Compute unit_price = cash ÷ qty. That is the price the client paid per unit on that invoice.
STEP 6: Report: item name, invoice date, doc_num, qty, unit price (cash÷qty), line total (cash).
STEP 7: If PRICELIST data is available for that SKU, also show the standard list_price so the agent can see the discount.
NEVER say "no data" or "I don't have pricing information" if the item appears anywhere in RECENT INVOICES — the price is always cash ÷ qty.

INVOICE DETAIL RULES — HOW TO ANSWER "WHAT WAS THE LAST INVOICE FOR THIS CLIENT?":
STEP 1: Look through ALL lines in RECENT INVOICES. Find the most recent line_date.
STEP 2: Find the doc_num that belongs to that most recent date. If multiple invoices share the same date, pick the highest doc_num.
STEP 3: Collect ALL lines that share that exact doc_num (same invoice = same document number).
STEP 4: Present a summary header: Invoice # (doc_num), date, total (sum of all cash values).
STEP 5: Present a full line-by-line table — every single line, nothing omitted:
  | שם פריט | מק״ט | כמות | מחיר יחידה | סה״כ שורה |
  where מחיר יחידה = cash ÷ qty for each line.
STEP 6: At the bottom show the invoice total.
NEVER summarize or omit lines. NEVER say "I don't have invoice details" if RECENT INVOICES has data.

GENERAL PRICING FACTS:
- unit_price = cash ÷ qty on that line — this is the actual price per unit after discount.
- list_price from PRICELIST = standard catalogue price (P01). If unit_price < list_price, a discount was given.
- All sales line amounts (cash) are VAT-exclusive.
- Debt and collection receipt amounts are VAT-inclusive — always divide by 1.18 for the net amount and state both.

DEBT RULES:
- If OPEN DEBT section says "No open debt recorded" → the client has no debt.
- If debt exists, report total and break it down by month bucket in a table.
- Always mention whether amounts include VAT and show the net equivalent.
- The debt aging report shows monthly buckets, not individual invoices. It does NOT contain invoice document numbers. If the agent needs the specific invoice number for a debt, refer them to the RECENT INVOICES section — unpaid invoices will appear there.

PRODUCT / STOCK SEARCH RULES:
- If asked about a product, search RECENT INVOICES for that item name or SKU first.
- To check availability, use CURRENT STOCK LEVELS — look up the SKU and report qty_on_hand.
- If asked about price, use PRICELIST for standard price and RECENT INVOICES for what the client actually paid.
- For fuzzy searches (partial name), look through all item_name fields for partial matches and list what you find.
- Item SKU prefix (first 4 chars) identifies the supplier, e.g. VTHH = Vtech Hebrew.

CRITICAL — NEVER SAY "NO DATA" WHEN DATA EXISTS:
- If RECENT INVOICES has ANY lines for this client, you have pricing data. Use it.
- If you cannot find an exact item match, say "I found these similar items:" and list them.
- Only say "no data" if the RECENT INVOICES section explicitly states "No invoice history found for this client."

GENERAL RULES:
- Answer in the same language the agent uses (Hebrew or English).
- Address / location in general chat: First check "CLIENTS MATCHING WORDS IN THE QUESTION" if present; otherwise search "MY CLIENTS" lines for a name match and use the text after the last " | " as location when present.
- Last purchase / last product / invoice history in general chat: Use "RECENT INVOICE LINES FOR CLIENT(S) MATCHING YOUR QUESTION" when present — NOT "MY RECENT SALES" alone. Pick the top line (most recent line_date) for "last purchase"; use PRICING RULES (cash÷qty) on those lines.
- Be factual. If data is not in the context, say so clearly — do not guess or invent numbers.
- When showing money amounts, always state whether VAT is included or excluded.
- If multiple documents exist for a client, show the most recent ones first.
- For open orders, always mention the order date and items so the agent knows what is pending.

${contextParts.join('\n\n')}`

  return rules
}

function mapLegacyGeminiModel(id: string): string {
  const m: Record<string, string> = {
    'gemini-2.0-flash': 'gemini-2.5-flash',
    'gemini-2.0-flash-thinking': 'gemini-2.5-flash',
    'gemini-1.5-pro': 'gemini-2.5-pro',
  }
  return m[id] ?? id
}

async function callGemini(model: string, system: string, history: ChatMessage[], message: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const contents = [
    ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callClaude(model: string, system: string, history: ChatMessage[], message: string): Promise<string> {
  const apiKey = Deno.env.get('CLAUDE_API_KEY')
  if (!apiKey) throw new Error('CLAUDE_API_KEY not configured')

  const messages = [
    ...history,
    { role: 'user', content: message },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Claude error')
  return data.content?.[0]?.text ?? ''
}

async function callOpenAI(model: string, system: string, history: ChatMessage[], message: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: message },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.3 }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI error')
  return data.choices?.[0]?.message?.content ?? ''
}
