#!/usr/bin/env node
/**
 * After a promote, bump beta's next product line (2.1 promoted → 2.2 on beta).
 *
 * Usage:
 *   PROMOTED_VERSION=2.1 node scripts/bump-beta-product-version.mjs
 *   (or pass version from Promote commit message via GITHUB_COMMIT_MESSAGE)
 */
import { execSync } from 'node:child_process'
import {
  bumpProductVersion,
  parsePromoteVersion,
  readBetaProductVersion,
  writeBetaProductVersion,
} from './lib/productVersion.mjs'

const promoted =
  process.env.PROMOTED_VERSION?.trim() ||
  parsePromoteVersion(process.env.GITHUB_COMMIT_MESSAGE || '')

if (!promoted) {
  console.error('Set PROMOTED_VERSION or use a Promote beta vX.Y commit message.')
  process.exit(1)
}

const nextBeta = bumpProductVersion(promoted)
const current = readBetaProductVersion()

if (current === nextBeta) {
  console.log(`Beta product line already ${nextBeta} — nothing to do.`)
  process.exit(0)
}

writeBetaProductVersion(nextBeta)
console.log(`Bumped BETA_PRODUCT_VERSION fallback: ${current} → ${nextBeta}`)

if (process.env.GIT_COMMIT === '1') {
  execSync('git add src/lib/appChannel.ts', { stdio: 'inherit' })
  execSync(`git commit -m "Bump beta product line to ${nextBeta} after v${promoted} promote."`, {
    stdio: 'inherit',
  })
}
