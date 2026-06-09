import type { DashboardData } from '../types/dashboard'

/** Yield so the browser can paint loading UI before heavy JSON parse. */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function extractJsonObject(text: string, objectStart: number): string {
  let i = objectStart
  while (i < text.length && text[i] !== '{') i++
  if (i >= text.length) throw new Error('Dashboard data JSON object not found')

  let depth = 0
  let inString = false
  let escape = false

  for (; i < text.length; i++) {
    const c = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\' && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(objectStart, i + 1)
    }
  }
  throw new Error('Unbalanced dashboard data JSON')
}

export async function parseDashboardLoaderText(text: string): Promise<DashboardData> {
  const debtMatch = text.match(/window\.__DEBT_LAST_UPDATE__\s*=\s*"([^"]*)"/)
  if (debtMatch?.[1]) {
    window.__DEBT_LAST_UPDATE__ = debtMatch[1]
  }

  const marker = 'window.__DASHBOARD_DATA__'
  const idx = text.indexOf(marker)
  if (idx < 0) throw new Error('window.__DASHBOARD_DATA__ missing in loader file')

  const eq = text.indexOf('=', idx)
  if (eq < 0) throw new Error('window.__DASHBOARD_DATA__ assignment missing')

  await yieldToMain()

  const jsonText = extractJsonObject(text, eq + 1)
  const data = JSON.parse(jsonText) as DashboardData
  if (!data?.rows) throw new Error('Dashboard data missing rows array')
  return data
}

export async function fetchDashboardLoader(url: string): Promise<DashboardData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch dashboard data: ${res.status}`)
  const text = await res.text()
  return parseDashboardLoaderText(text)
}
