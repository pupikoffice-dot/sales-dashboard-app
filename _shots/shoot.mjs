import { chromium } from 'playwright-core'
const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'
const OUT = 'C:/dev/wt-layout-options/_shots'
const BASE = 'http://localhost:5199'
const args = process.argv.slice(2)
const only = args[0] ? args[0].split(',') : ['current', 'ledger', 'calm', 'console']
const jobs = args[1] ? args[1].split(',') : null

// ---- synthetic fixture (screenshots only; invented demo data) ----
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const pick = a => a[Math.floor(rnd() * a.length)]
const companies = ['pupik', 'mt', 'grow', 'gold']
const agents = ['Dana L.', 'Yossi K.', 'Noa B.', 'Avi M.']
const clients = ['Toys Center', 'שלמה משחקים', 'Kids World', 'אלפא חנויות', 'Super Fun', 'המשחקייה', 'Hobby Hub', 'צעצועי דרום']
const items = [
  ['FK-1001', 'Funko Pop Mandalorian', 'Figures', 'Funko'],
  ['LG-2040', 'Lego City Fire Truck', 'Building', 'Lego'],
  ['HT-310', 'Hot Wheels 10-pack', 'Cars', 'Mattel'],
  ['BB-77', 'בובת באבלס', 'Dolls', 'Mattel'],
  ['PL-512', 'Playmobil Castle', 'Building', 'Playmobil'],
  ['NR-88', 'Nerf Elite Blaster', 'Outdoor', 'Hasbro'],
]
const iso = d => d.toISOString().slice(0, 10)
const rows = []
const today = new Date('2026-11-04T12:00:00')
for (let i = 0; i < 900; i++) {
  const d = new Date(today)
  d.setDate(today.getDate() - Math.floor(rnd() * 400))
  const it = pick(items)
  const cl = pick(clients)
  rows.push({ company: pick(companies), date: iso(d), year: d.getFullYear(), month: d.getMonth() + 1, agent: pick(agents), clientID: String(100 + clients.indexOf(cl)), clientName: cl, docNum: String(5000 + Math.floor(i / 3)), itemSKU: it[0], itemName: it[1], tabletCat: it[2], groupCat: it[2], qty: 1 + Math.floor(rnd() * 20), cash: Math.round(200 + rnd() * 6000), supplier: it[3] })
}
for (let i = 0; i < 60; i++) {
  const it = pick(items)
  rows.push({ company: pick(['openorders', 'openorders-mt', 'openorders-gold']), date: iso(today), year: 2026, month: 11, agent: pick(agents), clientID: '101', clientName: pick(clients), docNum: String(9000 + i), itemSKU: it[0], itemName: it[1], tabletCat: it[2], groupCat: it[2], qty: 2 + Math.floor(rnd() * 30), cash: Math.round(300 + rnd() * 5000), supplier: it[3] })
}
const aux = {
  debtRows: clients.map((n, i) => ({ company: companies[i % 4], agent: pick(agents), clientID: String(100 + i), clientName: n, oldDebt: 1000 + i * 900, months: [{ label: 'Oct', amount: 2000 + i * 300 }, { label: 'Nov', amount: 900 + i * 120 }] })),
  wmsRows: items.flatMap(it => companies.map(c => ({ company: c, itemSKU: it[0], itemName: it[1], qtyInStock: Math.floor(rnd() * 400) }))),
  syncTimes: Object.fromEntries(companies.map(c => [c, { sales: '2026-11-04T09:00:00Z', debt: '2026-11-04T07:00:00Z' }])),
}

const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', exp: 4102444800, role: 'authenticated' })).toString('base64url') + '.sig'
const session = {
  access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })

async function setup(ctx) {
  await ctx.route('http://127.0.0.1:54321/**', route => {
    const u = route.request().url()
    const m = route.request().method()
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const fn = (u.match(/\/rpc\/([a-z_0-9]+)/) || [])[1]
    if (fn === 'is_super_admin') return json(route, true)
    if (fn === 'get_dashboard_sales_boundaries') return json(route, { boundaries: [0], max_id: 1 })
    if (fn === 'get_dashboard_sales_range') return json(route, { rows })
    if (fn === 'get_dashboard_aux') return json(route, aux)
    if (fn === 'get_dashboard_sales_years') return json(route, [])
    if (fn) return json(route, { code: 'PGRST202', message: 'not found' }, 404)
    if (u.includes('/rest/v1/')) return json(route, m === 'GET' ? [] : {})
    return json(route, {})
  })
}

const shots = [
  ['ov-dark-desk', '/oversite', 'dark', 'en', 1440, 900],
  ['ov-light-desk', '/oversite', 'light', 'en', 1440, 900],
  ['orders-dark-desk', '/orders', 'dark', 'en', 1440, 900],
  ['open-light-desk', '/open-orders', 'light', 'en', 1440, 900],
  ['ov-he-rtl-desk', '/oversite', 'dark', 'he', 1440, 900],
  ['ov-dark-380', '/oversite', 'dark', 'en', 380, 800],
  ['orders-light-380', '/orders', 'light', 'en', 380, 800],
  ['ov-he-380', '/oversite', 'light', 'he', 380, 800],
  ['menu-he-380', '/oversite', 'dark', 'he', 380, 800, 'menu'],
]
const browser = await chromium.launch({ executablePath: EXE })
for (const style of only) {
  for (const [name, path, theme, loc, w, h, extra] of shots) {
    if (jobs && !jobs.includes(name)) continue
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    await setup(ctx)
    await ctx.addInitScript(([s, theme, loc, style]) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(s))
      localStorage.setItem('dash-sidebar-legend-seen', '1'); localStorage.setItem('dashboard-theme', theme)
      localStorage.setItem('dashboard-locale', loc)
      localStorage.setItem('dashboard-layout-style', style)
    }, [session, theme, loc, style])
    const page = await ctx.newPage()
    page.on('pageerror', e => console.log('PAGEERR', style, name, e.message.slice(0, 150)))
    await page.goto(BASE + path, { waitUntil: 'load' })
    await page.waitForTimeout(3500)
    if (extra === 'menu') {
      await page.click('.mobile-menu-btn').catch(() => {})
      await page.waitForTimeout(600)
    }
    await page.screenshot({ path: `${OUT}/${style}__${name}.png`, fullPage: false })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    console.log(style, name, overflow ? 'H-OVERFLOW' : 'ok')
    await ctx.close()
  }
}
await browser.close()
