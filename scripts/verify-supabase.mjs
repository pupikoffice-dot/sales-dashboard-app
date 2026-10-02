#!/usr/bin/env node
/**
 * Checks that a Supabase project responds (Auth health + REST reachable).
 * Usage: node scripts/verify-supabase.mjs [path/to/.env]
 * If omitted, tries ../admin-app/.env then ../mobile-app/.env (from repo root).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

function parseEnv(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const i = s.indexOf('=')
    if (i === -1) continue
    const k = s.slice(0, i).trim()
    let v = s.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function pickSupabase(env) {
  const url = env.VITE_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  return { url, key }
}

const arg = process.argv[2]
const candidates = arg
  ? [path.resolve(process.cwd(), arg)]
  : [
      path.join(repoRoot, 'admin-app', '.env'),
      path.join(repoRoot, 'mobile-app', '.env'),
    ]

let env = {}
let usedPath = ''
for (const p of candidates) {
  try {
    env = parseEnv(fs.readFileSync(p, 'utf8'))
    usedPath = p
    break
  } catch {
    /* try next */
  }
}

const { url, key } = pickSupabase(env)
if (!url || !key) {
  console.error('Could not find Supabase URL + anon key.')
  console.error('Expected VITE_SUPABASE_* (admin) or EXPO_PUBLIC_SUPABASE_* (mobile).')
  console.error('Tried:', candidates.join('\n  '))
  console.error('\nUsage: node scripts/verify-supabase.mjs path/to/.env')
  process.exit(1)
}

const origin = url.replace(/\/$/, '')

const apiHeaders = { apikey: key, Authorization: `Bearer ${key}` }

const res = await fetch(`${origin}/auth/v1/health`, { headers: apiHeaders })
const body = await res.text()
console.log(`Env file: ${usedPath}`)
console.log(`Auth /health: ${res.status} ${body.slice(0, 200)}`)

const rest = await fetch(`${origin}/rest/v1/clients?select=id&limit=1`, { headers: apiHeaders })
const restSnippet = (await rest.text()).slice(0, 120)
console.log(`REST clients probe: ${rest.status} ${restSnippet}`)

if (!res.ok) {
  console.error(`\nAuth /health failed (${res.status}). Check URL and anon key.`)
  process.exit(1)
}

if (rest.status === 401) {
  console.error('\nREST returned 401 — anon key likely wrong for this project URL.')
  process.exit(1)
}

if (rest.status === 404) {
  console.log('\nNote: `public.clients` not in schema yet — normal for a brand-new project. After `supabase db push`, run this script again.')
} else if (rest.ok) {
  console.log('\nSchema probe: `clients` table exists.')
}

console.log('\nOK — URL and anon key work for this project (Auth + REST).')
