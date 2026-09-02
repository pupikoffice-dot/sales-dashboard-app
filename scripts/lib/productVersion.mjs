import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const APP_CHANNEL_PATH = join(ROOT, 'src/lib/appChannel.ts')

const BETA_FALLBACK_RE =
  /export const BETA_PRODUCT_VERSION[\s\S]*?\|\|\s*['"]([\d.]+)['"]/

/** Read beta product-line fallback from appChannel.ts (e.g. "2.2"). */
export function readBetaProductVersion(filePath = APP_CHANNEL_PATH) {
  const src = readFileSync(filePath, 'utf8')
  const match = src.match(BETA_FALLBACK_RE)
  if (!match) throw new Error(`Could not parse BETA_PRODUCT_VERSION in ${filePath}`)
  return match[1]
}

/** Bump minor product line: 2.1 → 2.2 */
export function bumpProductVersion(version) {
  const parts = String(version).trim().split('.')
  if (parts.length < 2) throw new Error(`Invalid product version: ${version}`)
  const major = Number(parts[0])
  const minor = Number(parts[1])
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error(`Invalid product version: ${version}`)
  }
  return `${major}.${minor + 1}`
}

/** Parse "Promote beta v2.1 …" from a git commit message. */
export function parsePromoteVersion(commitMessage) {
  if (!commitMessage) return null
  const match = commitMessage.match(/Promote beta v(\d+\.\d+)/i)
  return match?.[1] ?? null
}

/** Write a new BETA_PRODUCT_VERSION fallback into appChannel.ts. */
export function writeBetaProductVersion(nextVersion, filePath = APP_CHANNEL_PATH) {
  const src = readFileSync(filePath, 'utf8')
  const next = src.replace(
    BETA_FALLBACK_RE,
    (block, current) => block.replace(`'${current}'`, `'${nextVersion}'`).replace(`"${current}"`, `"${nextVersion}"`),
  )
  if (next === src) throw new Error('Failed to update BETA_PRODUCT_VERSION fallback')
  writeFileSync(filePath, next, 'utf8')
  return nextVersion
}
