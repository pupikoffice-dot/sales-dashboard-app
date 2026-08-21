/**
 * Channel vs product version (title badge)
 *
 * - **Version** (1.0, 2.0, 2.1…): which product release line this build belongs to.
 * - **Channel** (production | beta): where you iterate.
 *     - production = stable live
 *     - beta = working iteration of the *next* (or current-in-progress) version
 *
 * Today: production shows live DB `app_runtime_config.active_version` (still 1.0 until
 * promote). Beta shows `BETA_PRODUCT_VERSION` + "beta" (currently 2.0 · beta).
 *
 * After promoting 2.0 to production: set DB active_version to 2.0, then bump
 * BETA_PRODUCT_VERSION here (or VITE_PRODUCT_VERSION) to 2.1 / 3.0 for the next beta.
 *
 * Do NOT flip `app_runtime_config.active_version` just to change the beta title —
 * that row is the live cutover/runtime flag shared by both channels.
 */

export type AppChannel = 'production' | 'beta'

/** Product line currently under construction on the beta channel. */
export const BETA_PRODUCT_VERSION =
  (import.meta.env.VITE_PRODUCT_VERSION as string | undefined)?.trim() || '2.0'

const BETA_HOST_MARKERS = ['pupik-sales-dashboard-beta']
const PRODUCTION_HOST_MARKERS = ['sales-dashboard-app-omega']

export function resolveAppChannel(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): AppChannel {
  const env = (import.meta.env.VITE_APP_CHANNEL as string | undefined)?.trim().toLowerCase()
  if (env === 'beta') return 'beta'
  if (env === 'production') return 'production'

  const host = hostname.toLowerCase()
  if (BETA_HOST_MARKERS.some(m => host.includes(m))) return 'beta'
  if (PRODUCTION_HOST_MARKERS.some(m => host.includes(m))) return 'production'

  // Local dev and unnamed Vercel previews are treated as beta (next-version work).
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
  if (channel === 'beta') return `${BETA_PRODUCT_VERSION} · beta`
  return live
}
