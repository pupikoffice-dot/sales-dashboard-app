/**
 * Channel vs product version (title badge)
 *
 * - **Version** (1.0, 2.0, 2.1…): which product release line this build belongs to.
 * - **Channel** (production | beta | legacy): where the build runs.
 *     - production = stable live (org default URL)
 *     - beta = next-version iteration
 *     - legacy = frozen prior stable (backup / rollback reference)
 *
 * Production shows live DB `app_runtime_config.active_version` (2.0 after promote).
 * Beta shows `BETA_PRODUCT_VERSION` + "beta" (2.1 · beta).
 * Legacy shows `LEGACY_PRODUCT_VERSION` + "legacy" (1.0 · legacy), not DB.
 *
 * Do NOT flip `app_runtime_config.active_version` just to relabel beta — that row is
 * the shared live cutover/runtime flag for production.
 */

export type AppChannel = 'production' | 'beta' | 'legacy'

/** Product line currently under construction on the beta channel. */
export const BETA_PRODUCT_VERSION =
  (import.meta.env.VITE_PRODUCT_VERSION as string | undefined)?.trim() || '2.1'

/** Frozen product line on the legacy backup channel. */
export const LEGACY_PRODUCT_VERSION = '1.0'

const BETA_HOST_MARKERS = ['pupik-sales-dashboard-beta', 'sales-dashboard-app-git-beta-']
const LEGACY_HOST_MARKERS = ['pupik-sales-dashboard-legacy', 'sales-dashboard-app-git-legacy-']
const PRODUCTION_HOST_MARKERS = [
  'sales-dashboard-app-omega',
  'sales-dashboard-app-git-main-',
  'sales-dashboard-app-pupikoffice-dots-projects.vercel.app',
]

export function resolveAppChannel(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): AppChannel {
  const env = (import.meta.env.VITE_APP_CHANNEL as string | undefined)?.trim().toLowerCase()
  if (env === 'beta') return 'beta'
  if (env === 'legacy') return 'legacy'
  if (env === 'production') return 'production'

  const host = hostname.toLowerCase()
  if (LEGACY_HOST_MARKERS.some(m => host.includes(m))) return 'legacy'
  if (BETA_HOST_MARKERS.some(m => host.includes(m))) return 'beta'
  if (PRODUCTION_HOST_MARKERS.some(m => host.includes(m))) return 'production'

  // Local dev and unnamed Vercel previews default to beta (next-version work).
  if (host === 'localhost' || host === '127.0.0.1') return 'beta'
  if (host.endsWith('.vercel.app')) return 'beta'

  return 'production'
}

/**
 * Header badge text.
 * @param liveActiveVersion from `app_runtime_config.active_version` (production cutover).
 */
export function formatHeaderVersionBadge(liveActiveVersion: string, channel = resolveAppChannel()): string {
  const live = liveActiveVersion.trim() || '1.0'
  if (channel === 'legacy') return `${LEGACY_PRODUCT_VERSION} · legacy`
  if (channel === 'beta') return `${BETA_PRODUCT_VERSION} · beta`
  return live
}
