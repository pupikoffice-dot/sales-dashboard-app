#!/usr/bin/env node
/**
 * Set app_runtime_config.active_version in Supabase (production header badge).
 *
 * Usage:
 *   PROMOTE_VERSION=2.1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-production-version.mjs
 *
 * Or rely on GITHUB_COMMIT_MESSAGE containing "Promote beta v2.1 …"
 */
import { createClient } from '@supabase/supabase-js'
import { parsePromoteVersion, readBetaProductVersion } from './lib/productVersion.mjs'

const promoteFromMsg = parsePromoteVersion(process.env.GITHUB_COMMIT_MESSAGE || '')
const version =
  process.env.PROMOTE_VERSION?.trim() ||
  promoteFromMsg ||
  readBetaProductVersion()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

const supabase = createClient(url, key)

const { data: existing, error: readError } = await supabase
  .from('app_runtime_config')
  .select('active_version')
  .eq('id', true)
  .maybeSingle()

if (readError) {
  console.error('Failed to read app_runtime_config:', readError.message)
  process.exit(1)
}

if (existing?.active_version === version) {
  console.log(`active_version already ${version} — nothing to do.`)
  process.exit(0)
}

const { error: updateError } = await supabase
  .from('app_runtime_config')
  .update({ active_version: version })
  .eq('id', true)

if (updateError) {
  console.error('Failed to update active_version:', updateError.message)
  process.exit(1)
}

console.log(`Updated app_runtime_config.active_version → ${version}`)
